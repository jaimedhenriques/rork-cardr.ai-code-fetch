import Foundation
import AVFoundation
import Vision
import UIKit
import Observation

/// Drives the real-time card/badge scanner: a live AVFoundation capture session
/// with smart auto-capture (Vision rectangle detection) and instant QR/barcode
/// reading. UI state lives on the main actor; capture callbacks bounce back to it.
@MainActor
@Observable
final class LiveScannerService: NSObject {
    // MARK: - Published UI state
    var isAuthorized = false
    var isRunning = false
    var torchOn = false
    /// 0...1 confidence the card is framed well enough to auto-capture.
    var framingProgress: CGFloat = 0
    /// Bounding box of the detected card in normalized preview coordinates.
    var detectedRect: CGRect?
    var capturedImages: [UIImage] = []
    /// A QR/barcode payload read live from the viewfinder.
    var detectedCode: String?
    var lastCapture: UIImage?
    var isCapturing = false

    /// Whether a physical camera exists (false on the cloud simulator).
    var cameraAvailable: Bool {
        !AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera],
            mediaType: .video,
            position: .unspecified
        ).devices.isEmpty
    }

    let session = AVCaptureSession()

    private let sessionQueue = DispatchQueue(label: "cardr.scanner.session")
    private let videoOutput = AVCaptureVideoDataOutput()
    private let photoOutput = AVCapturePhotoOutput()
    private let metadataOutput = AVCaptureMetadataOutput()
    private var device: AVCaptureDevice?
    private var configured = false

    /// Consecutive frames where a well-framed card was seen (drives auto-capture).
    private var stableFrames = 0
    private var autoCaptureArmed = true
    private var pendingPhotoHandler: ((UIImage?) -> Void)?

    // MARK: - Lifecycle

    func requestAccess() async {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            isAuthorized = true
        case .notDetermined:
            isAuthorized = await AVCaptureDevice.requestAccess(for: .video)
        default:
            isAuthorized = false
        }
    }

    func start() {
        guard cameraAvailable, isAuthorized else { return }
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if !self.configured { self.configure() }
            if !self.session.isRunning { self.session.startRunning() }
            Task { @MainActor in self.isRunning = true }
        }
    }

    func stop() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if self.session.isRunning { self.session.stopRunning() }
            Task { @MainActor in
                self.isRunning = false
                self.torchOn = false
            }
        }
    }

    func toggleTorch() {
        guard let device, device.hasTorch else { return }
        sessionQueue.async { [weak self] in
            guard let self else { return }
            try? device.lockForConfiguration()
            let next = device.torchMode != .on
            device.torchMode = next ? .on : .off
            device.unlockForConfiguration()
            Task { @MainActor in self.torchOn = next }
        }
    }

    /// Re-arms auto-capture after a card was added to the tray (batch mode).
    func rearm() {
        stableFrames = 0
        autoCaptureArmed = true
        framingProgress = 0
        detectedRect = nil
    }

    func clearTray() {
        capturedImages.removeAll()
    }

    // MARK: - Capture

    /// Manually trigger a capture (shutter button).
    func capturePhoto() {
        guard !isCapturing else { return }
        triggerCapture()
    }

    private func triggerCapture() {
        autoCaptureArmed = false
        isCapturing = true
        sessionQueue.async { [weak self] in
            guard let self else { return }
            let settings = AVCapturePhotoSettings()
            self.photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    // MARK: - Session configuration

    private func configure() {
        session.beginConfiguration()
        session.sessionPreset = .photo

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
            ?? AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera) else {
            session.commitConfiguration()
            return
        }
        device = camera
        if session.canAddInput(input) { session.addInput(input) }

        videoOutput.setSampleBufferDelegate(self, queue: DispatchQueue(label: "cardr.scanner.video"))
        videoOutput.alwaysDiscardsLateVideoFrames = true
        if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }

        if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }

        if session.canAddOutput(metadataOutput) {
            session.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue(label: "cardr.scanner.meta"))
            let wanted: [AVMetadataObject.ObjectType] = [.qr, .code128, .pdf417, .aztec, .ean13]
            metadataOutput.metadataObjectTypes = wanted.filter {
                metadataOutput.availableMetadataObjectTypes.contains($0)
            }
        }

        session.commitConfiguration()
        configured = true
    }
}

// MARK: - Live frame analysis (Vision rectangle detection for auto-capture)

extension LiveScannerService: AVCaptureVideoDataOutputSampleBufferDelegate {
    nonisolated func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let request = VNDetectRectanglesRequest()
        request.minimumAspectRatio = 0.3
        request.maximumAspectRatio = 1.0
        request.minimumSize = 0.25
        request.minimumConfidence = 0.7
        request.maximumObservations = 1

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .right, options: [:])
        try? handler.perform([request])

        guard let observation = (request.results)?.first else {
            Task { @MainActor in self.noCardSeen() }
            return
        }

        // Vision's coordinate space is bottom-left; flip Y for the preview overlay.
        let box = observation.boundingBox
        let rect = CGRect(x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
        let area = box.width * box.height

        Task { @MainActor in self.cardSeen(rect: rect, area: area) }
    }

    private func cardSeen(rect: CGRect, area: CGFloat) {
        detectedRect = rect
        // Need the card to fill a good chunk of the frame before auto-capturing.
        let target: CGFloat = 0.32
        let progress = min(1, max(0, (area - 0.15) / (target - 0.15)))
        framingProgress = progress

        guard autoCaptureArmed, !isCapturing else { return }
        if area >= target {
            stableFrames += 1
            if stableFrames >= 8 {
                triggerCapture()
            }
        } else {
            stableFrames = max(0, stableFrames - 1)
        }
    }

    private func noCardSeen() {
        detectedRect = nil
        stableFrames = max(0, stableFrames - 1)
        framingProgress = max(0, framingProgress - 0.1)
    }
}

// MARK: - Photo capture delegate

extension LiveScannerService: AVCapturePhotoCaptureDelegate {
    nonisolated func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        let image = photo.fileDataRepresentation().flatMap { UIImage(data: $0) }
        Task { @MainActor in self.finishCapture(image) }
    }

    private func finishCapture(_ image: UIImage?) {
        isCapturing = false
        stableFrames = 0
        framingProgress = 0
        guard let image else {
            autoCaptureArmed = true
            return
        }
        lastCapture = image
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        pendingPhotoHandler?(image)
        pendingPhotoHandler = nil
    }

    /// Registers a one-shot handler called when the next capture completes.
    func onNextCapture(_ handler: @escaping (UIImage?) -> Void) {
        pendingPhotoHandler = handler
    }
}

// MARK: - QR / barcode delegate

extension LiveScannerService: AVCaptureMetadataOutputObjectsDelegate {
    nonisolated func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = object.stringValue, !value.isEmpty else { return }
        Task { @MainActor in
            if self.detectedCode != value {
                self.detectedCode = value
                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
            }
        }
    }
}
