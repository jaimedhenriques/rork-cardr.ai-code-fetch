import SwiftUI
import PhotosUI
import UIKit

/// Real badge & card scanning — mirrors the web `ScanBadge` flow. Capture a card
/// with the camera or pick one from the library, read it via the `scan-badge`
/// edge function, save the contact instantly, and enrich it in the background.
struct ScanView: View {
    @Environment(DataStore.self) private var data

    @State private var animate = false
    @State private var phase: Phase = .idle
    @State private var photoItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var showAddContact = false
    @State private var createdContact: Contact?
    @State private var failureMessage: String?
    @State private var batchProgress: (current: Int, total: Int)?
    @State private var batchSavedCount = 0

    private enum Phase: Equatable {
        case idle, reading
    }

    private var cameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    scannerArt
                    headline
                    actionCard
                    manualLink
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 40)
            }
            .frame(maxWidth: .infinity)
            .background(Theme.background)
            .navigationTitle("Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    DrawerMenuButton()
                }
            }
            .onAppear { animate = true }
            .navigationDestination(item: $createdContact) { ContactDetailView(contact: $0) }
            .sheet(isPresented: $showAddContact) {
                AddContactView()
            }
            .fullScreenCover(isPresented: $showCamera) {
                LiveScannerView(
                    onCapture: { images in handleBatch(images) },
                    onCode: { code in handleCode(code) }
                )
            }
            .onChange(of: photoItem) { _, newItem in
                guard let newItem else { return }
                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        handle(image)
                    }
                    photoItem = nil
                }
            }
            .overlay {
                if phase == .reading { readingOverlay }
            }
            .alert("Couldn't read the card", isPresented: failureBinding) {
                Button("Add manually") { showAddContact = true }
                Button("Try again", role: .cancel) {}
            } message: {
                Text(failureMessage ?? "We couldn't find contact details in that image. Try a clearer, well-lit photo of the card.")
            }
        }
    }

    private var failureBinding: Binding<Bool> {
        Binding(get: { failureMessage != nil }, set: { if !$0 { failureMessage = nil } })
    }

    // MARK: - Scanner art

    private var scannerArt: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28)
                .stroke(Theme.primary.opacity(0.4), style: StrokeStyle(lineWidth: 2, dash: [10, 8]))
                .frame(width: 240, height: 150)
                .scaleEffect(animate ? 1.03 : 0.97)
                .animation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true), value: animate)
            Image(systemName: "person.crop.rectangle.stack")
                .font(.system(size: 54, weight: .light))
                .foregroundStyle(Theme.primary)
        }
        .padding(.top, 12)
    }

    private var headline: some View {
        VStack(spacing: 10) {
            Text("Scan a card or badge")
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.ink)
            Text("Snap a business card or event badge and we'll read it, save the contact, and enrich it with AI automatically.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
        }
    }

    // MARK: - Actions

    private var actionCard: some View {
        CardSurface(padding: 18) {
            VStack(spacing: 12) {
                if cameraAvailable {
                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        showCamera = true
                    } label: {
                        primaryLabel("Scan with camera", icon: "camera.fill")
                    }
                    .buttonStyle(PressableButtonStyle())
                } else {
                    cameraUnavailableNote
                }

                PhotosPicker(selection: $photoItem, matching: .images, photoLibrary: .shared()) {
                    secondaryLabel(cameraAvailable ? "Upload a photo" : "Choose a photo", icon: "photo.on.rectangle")
                }
                .buttonStyle(PressableButtonStyle())
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func primaryLabel(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.brandGradient)
            .foregroundStyle(.white)
            .clipShape(.rect(cornerRadius: 14))
            .shadow(color: Theme.primary.opacity(0.4), radius: 14, y: 8)
    }

    private func secondaryLabel(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(Theme.primary)
            .background(Theme.primary.opacity(0.1))
            .clipShape(.rect(cornerRadius: 14))
    }

    private var cameraUnavailableNote: some View {
        VStack(spacing: 6) {
            Image(systemName: "camera.metering.unknown")
                .font(.title2)
                .foregroundStyle(Theme.inkSecondary)
            Text("Install this app on your device via the Rork App to use the camera.")
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var manualLink: some View {
        Button {
            showAddContact = true
        } label: {
            Text("Prefer to type it in? Add a contact manually")
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.inkSecondary)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Reading overlay

    private var readingOverlay: some View {
        ZStack {
            Color.black.opacity(0.35).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)
                Text(batchProgress != nil ? "Reading cards…" : "Reading card…")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                if let batchProgress {
                    Text("\(batchProgress.current) of \(batchProgress.total)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                } else {
                    Text("Enriching with AI in the background")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                }
            }
            .padding(28)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
        }
        .transition(.opacity)
    }

    // MARK: - Flow

    /// Processes a batch of captured card images sequentially, saving + enriching
    /// each. For a single image, falls back to the original navigate-to-contact flow.
    private func handleBatch(_ images: [UIImage]) {
        guard !images.isEmpty else { return }
        if images.count == 1 {
            handle(images[0])
            return
        }
        withAnimation { phase = .reading }
        batchSavedCount = 0
        Task {
            for (index, image) in images.enumerated() {
                batchProgress = (index + 1, images.count)
                guard let jpeg = downscaledJPEG(image) else { continue }
                guard let result = await data.scanBadge(imageData: jpeg) else { continue }
                if let contact = await data.addScannedContact(result) {
                    batchSavedCount += 1
                    data.enrichInBackground(contact)
                }
            }
            batchProgress = nil
            withAnimation { phase = .idle }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            if batchSavedCount == 0 {
                failureMessage = "We couldn't read any of those cards. Try clearer, well-lit photos."
            }
        }
    }

    /// Handles a QR/badge code read live from the scanner. vCard payloads create a
    /// contact directly; URLs and other text fall back to a manual add prefilled flow.
    private func handleCode(_ code: String) {
        if let result = ScanResultParser.parseVCard(code) {
            withAnimation { phase = .reading }
            Task {
                let contact = await data.addScannedContact(result)
                withAnimation { phase = .idle }
                if let contact {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    data.enrichInBackground(contact)
                    createdContact = contact
                } else {
                    failureMessage = data.loadError ?? "Could not save the contact."
                    data.loadError = nil
                }
            }
        } else {
            showAddContact = true
        }
    }

    private func handle(_ image: UIImage) {
        guard let jpeg = downscaledJPEG(image) else {
            failureMessage = "That image couldn't be processed. Please try another."
            return
        }
        withAnimation { phase = .reading }
        Task {
            let result = await data.scanBadge(imageData: jpeg)
            guard let result else {
                withAnimation { phase = .idle }
                failureMessage = data.loadError
                data.loadError = nil
                return
            }
            let contact = await data.addScannedContact(result)
            withAnimation { phase = .idle }
            if let contact {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                data.enrichInBackground(contact)
                createdContact = contact
            } else {
                failureMessage = data.loadError ?? "Could not save the contact."
                data.loadError = nil
            }
        }
    }

    /// Downscales to a max edge of 1600px and JPEG-compresses to keep the
    /// upload payload small and fast.
    private func downscaledJPEG(_ image: UIImage, maxEdge: CGFloat = 1600) -> Data? {
        let size = image.size
        let scale = min(1, maxEdge / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: target)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return resized.jpegData(compressionQuality: 0.7)
    }
}

/// A thin wrapper around `UIImagePickerController` for live camera capture.
struct CameraPicker: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    let onCapture: (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            let image = info[.originalImage] as? UIImage
            parent.dismiss()
            if let image { parent.onCapture(image) }
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
