import SwiftUI
import PhotosUI
import UIKit

/// Real badge & card scanning — mirrors the web `ScanBadge` flow. Capture a card
/// with the camera or pick one from the library, read it via the `scan-badge`
/// edge function, detect duplicates, save the contact, auto-assign it to the
/// active event, and group the run into an exportable scanning session.
struct ScanView: View {
    @Environment(DataStore.self) private var data

    @State private var animate = false
    @State private var phase: Phase = .idle
    @State private var photoItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var showAddContact = false
    @State private var prefillDraft: ContactDraft?
    @State private var createdContact: Contact?
    @State private var failureMessage: String?
    @State private var batchProgress: (current: Int, total: Int)?
    @State private var batchSavedCount = 0

    // Parity flows
    @State private var duplicateMatch: DuplicateContext?
    @State private var postSaveContact: Contact?
    @State private var showSessionExport = false
    @State private var showEventPicker = false

    private struct DuplicateContext: Identifiable {
        let id = UUID()
        let existing: Contact
        let result: DataStore.ScanResult
        let reason: String
    }

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
                    activeEventCard
                    actionCard
                    if !data.sessionContacts.isEmpty { sessionTray }
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
                AddContactView(prefill: prefillDraft) { contact in
                    finishSavedContact(contact)
                }
            }
            .sheet(item: $duplicateMatch) { ctx in
                duplicateSheet(ctx)
            }
            .sheet(item: $postSaveContact) { contact in
                postSaveSheet(contact)
            }
            .sheet(isPresented: $showSessionExport) {
                SessionExportView()
            }
            .sheet(isPresented: $showEventPicker) {
                ActiveEventPickerView()
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
                    if let raw = try? await newItem.loadTransferable(type: Data.self),
                       let image = UIImage(data: raw) {
                        handle(image)
                    }
                    photoItem = nil
                }
            }
            .overlay {
                if phase == .reading { readingOverlay }
            }
            .alert("Couldn't read the card", isPresented: failureBinding) {
                Button("Add manually") { openManual(with: nil) }
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

    // MARK: - Active event

    private var activeEventCard: some View {
        CardSurface(padding: 14) {
            VStack(spacing: 12) {
                Button {
                    showEventPicker = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "calendar")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                            .frame(width: 38, height: 38)
                            .background(Theme.primary.opacity(0.12), in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(data.activeEvent?.title ?? "No active event")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                                .lineLimit(1)
                            Text(data.activeEvent == nil ? "Tap to choose where scans go" : "New scans link to this event")
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }
                .buttonStyle(PressableButtonStyle())

                Toggle(isOn: Binding(
                    get: { data.autoAssignToEvent },
                    set: { data.autoAssignToEvent = $0 }
                )) {
                    Text("Auto-assign scans to active event")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.inkSecondary)
                }
                .tint(Theme.primary)
            }
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

    // MARK: - Session tray

    private var sessionTray: some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("This session")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Theme.ink)
                        Text("\(data.sessionContacts.count) contact\(data.sessionContacts.count == 1 ? "" : "s") scanned")
                            .font(.caption)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer()
                    Button {
                        withAnimation { data.clearSession() }
                    } label: {
                        Text("Clear")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }

                VStack(spacing: 8) {
                    ForEach(data.sessionContacts.prefix(4)) { contact in
                        HStack(spacing: 10) {
                            Text(contact.initials)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.white)
                                .frame(width: 30, height: 30)
                                .background(Theme.brandGradient, in: Circle())
                            VStack(alignment: .leading, spacing: 1) {
                                Text(contact.name)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.ink)
                                    .lineLimit(1)
                                if !contact.subtitle.isEmpty {
                                    Text(contact.subtitle)
                                        .font(.caption2)
                                        .foregroundStyle(Theme.inkSecondary)
                                        .lineLimit(1)
                                }
                            }
                            Spacer()
                        }
                    }
                    if data.sessionContacts.count > 4 {
                        Text("+ \(data.sessionContacts.count - 4) more")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.inkSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                Button {
                    showSessionExport = true
                } label: {
                    Label("Export session", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(Theme.primary)
                        .background(Theme.primary.opacity(0.1))
                        .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
    }

    private var manualLink: some View {
        Button {
            openManual(with: nil)
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

    // MARK: - Duplicate sheet

    private func duplicateSheet(_ ctx: DuplicateContext) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.warning)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Possible duplicate")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.ink)
                            Text(ctx.reason)
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                    }

                    duplicateCard(title: "Existing contact", name: ctx.existing.name,
                                  detail: ctx.existing.subtitle, email: ctx.existing.email)
                    duplicateCard(title: "Just scanned", name: ctx.result.name,
                                  detail: [ctx.result.title, ctx.result.company].compactMap { $0 }.joined(separator: " · "),
                                  email: ctx.result.email)

                    VStack(spacing: 10) {
                        Button {
                            duplicateMatch = nil
                            Task {
                                if let merged = await data.mergeScanned(ctx.result, into: ctx.existing) {
                                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                                    data.addToSession(merged.id)
                                    createdContact = merged
                                }
                            }
                        } label: {
                            primaryLabel("Merge into existing", icon: "arrow.triangle.merge")
                        }
                        .buttonStyle(PressableButtonStyle())

                        Button {
                            let result = ctx.result
                            duplicateMatch = nil
                            Task { await saveScanned(result) }
                        } label: {
                            secondaryLabel("Save as new contact", icon: "person.badge.plus")
                        }
                        .buttonStyle(PressableButtonStyle())
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { duplicateMatch = nil }
                }
            }
        }
    }

    private func duplicateCard(title: String, name: String, detail: String, email: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)
            Text(name)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.ink)
            if !detail.isEmpty {
                Text(detail).font(.caption).foregroundStyle(Theme.inkSecondary)
            }
            if let email, !email.isEmpty {
                Text(email).font(.caption2).foregroundStyle(Theme.inkSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Post-save review

    private func postSaveSheet(_ contact: Contact) -> some View {
        NavigationStack {
            VStack(spacing: 20) {
                ZStack {
                    Circle().fill(Theme.success.opacity(0.15)).frame(width: 76, height: 76)
                    Image(systemName: "checkmark")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(Theme.success)
                }
                .padding(.top, 24)

                VStack(spacing: 6) {
                    Text("\(contact.name) saved")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Theme.ink)
                    if let event = data.activeEvent, data.autoAssignToEvent {
                        Text("Added to \(event.title)")
                            .font(.subheadline)
                            .foregroundStyle(Theme.inkSecondary)
                    } else {
                        Text("Added to your contacts")
                            .font(.subheadline)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }

                Spacer()

                VStack(spacing: 10) {
                    Button {
                        postSaveContact = nil
                        createdContact = contact
                    } label: {
                        primaryLabel("Open contact", icon: "arrow.up.right")
                    }
                    .buttonStyle(PressableButtonStyle())

                    Button {
                        postSaveContact = nil
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        showCamera = true
                    } label: {
                        secondaryLabel("Scan another", icon: "camera.fill")
                    }
                    .buttonStyle(PressableButtonStyle())
                }
                .padding(.bottom, 20)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity)
            .background(Theme.background)
            .navigationTitle("Saved")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { postSaveContact = nil }
                }
            }
        }
        .presentationDetents([.medium])
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
                    data.addToSession(contact.id)
                    await data.linkScannedContactToActiveEvent(contact)
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
            Task { await processResult(result) }
        } else {
            openManual(with: nil)
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
            withAnimation { phase = .idle }
            guard let result else {
                failureMessage = data.loadError
                data.loadError = nil
                return
            }
            await processResult(result)
        }
    }

    /// Routes a scan result: duplicate → review sheet; partial info → manual
    /// prefill; otherwise auto-save.
    private func processResult(_ result: DataStore.ScanResult) async {
        if let dup = data.findDuplicate(for: result) {
            duplicateMatch = DuplicateContext(existing: dup.existing, result: result, reason: dup.reason)
            return
        }
        let hasStrongId = [result.email, result.phone, result.linkedin].contains { ($0?.isEmpty == false) }
        let hasCompanyAndTitle = (result.company?.isEmpty == false) && (result.title?.isEmpty == false)
        if hasStrongId || hasCompanyAndTitle {
            await saveScanned(result)
        } else {
            var draft = ContactDraft()
            draft.name = result.name
            draft.company = result.company ?? ""
            draft.title = result.title ?? ""
            draft.email = result.email ?? ""
            draft.phone = result.phone ?? ""
            draft.website = result.website ?? ""
            draft.linkedin = result.linkedin ?? ""
            draft.location = result.location ?? ""
            openManual(with: draft)
        }
    }

    /// Saves a scanned result as a new contact, links it to the active event, adds
    /// it to the session, kicks off enrichment, and shows the post-save review.
    private func saveScanned(_ result: DataStore.ScanResult) async {
        withAnimation { phase = .reading }
        let contact = await data.addScannedContact(result)
        withAnimation { phase = .idle }
        guard let contact else {
            failureMessage = data.loadError ?? "Could not save the contact."
            data.loadError = nil
            return
        }
        finishSavedContact(contact)
    }

    /// Shared post-save handling for both scanned and manually entered contacts.
    private func finishSavedContact(_ contact: Contact) {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        data.addToSession(contact.id)
        data.enrichInBackground(contact)
        Task { await data.linkScannedContactToActiveEvent(contact) }
        postSaveContact = contact
    }

    private func openManual(with draft: ContactDraft?) {
        prefillDraft = draft
        showAddContact = true
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
