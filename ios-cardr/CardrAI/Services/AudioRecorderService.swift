import Foundation
import AVFoundation
import Observation

/// Records microphone audio to a local m4a file and tracks elapsed time.
/// Used by the meeting-notes recorder to capture audio for AI transcription.
@MainActor
@Observable
final class AudioRecorderService: NSObject {
    var isRecording = false
    var isPaused = false
    var duration: TimeInterval = 0
    var permissionDenied = false

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var fileURL: URL?

    /// Whether audio recording is available on this device/simulator.
    var isSupported: Bool {
        !AVAudioSession.sharedInstance().availableInputs.isNilOrEmpty
    }

    func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func start() async -> Bool {
        let granted = await requestPermission()
        guard granted else {
            permissionDenied = true
            return false
        }
        permissionDenied = false

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)
        } catch {
            return false
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("cardr-recording-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]

        do {
            let newRecorder = try AVAudioRecorder(url: url, settings: settings)
            newRecorder.delegate = self
            guard newRecorder.record() else { return false }
            recorder = newRecorder
            fileURL = url
            isRecording = true
            isPaused = false
            duration = 0
            startTimer()
            return true
        } catch {
            return false
        }
    }

    func pause() {
        guard isRecording, !isPaused else { return }
        recorder?.pause()
        isPaused = true
        timer?.invalidate()
    }

    func resume() {
        guard isRecording, isPaused else { return }
        recorder?.record()
        isPaused = false
        startTimer()
    }

    /// Stops recording and returns the captured audio data + final duration.
    func stop() -> (data: Data?, duration: Int) {
        timer?.invalidate()
        timer = nil
        recorder?.stop()
        let finalDuration = Int(duration.rounded())
        isRecording = false
        isPaused = false

        var data: Data?
        if let url = fileURL {
            data = try? Data(contentsOf: url)
            try? FileManager.default.removeItem(at: url)
        }
        recorder = nil
        fileURL = nil
        try? AVAudioSession.sharedInstance().setActive(false)
        return (data, finalDuration)
    }

    func cancel() {
        timer?.invalidate()
        timer = nil
        recorder?.stop()
        if let url = fileURL { try? FileManager.default.removeItem(at: url) }
        recorder = nil
        fileURL = nil
        isRecording = false
        isPaused = false
        duration = 0
        try? AVAudioSession.sharedInstance().setActive(false)
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRecording, !self.isPaused else { return }
                self.duration += 0.1
            }
        }
    }
}

extension AudioRecorderService: AVAudioRecorderDelegate {
    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {}
}

private extension Optional where Wrapped == [AVAudioSessionPortDescription] {
    var isNilOrEmpty: Bool {
        self?.isEmpty ?? true
    }
}
