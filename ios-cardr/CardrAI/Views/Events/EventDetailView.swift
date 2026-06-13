import SwiftUI
import UIKit
import PhotosUI
import UniformTypeIdentifiers

/// Native event detail mirroring the web event view — header, recap summary,
/// linked contacts, and a picker to tag more contacts to the event.
struct EventDetailView: View {
    let event: Event
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var showAddContacts = false
    @State private var showSummary = false
    @State private var showDeleteConfirm = false
    @State private var files: [EventFile] = []
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var showPhotoPicker = false
    @State private var showFileImporter = false
    @State private var uploading = false

    private var linkedContacts: [Contact] {
        data.contacts(forEvent: event.id)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                summaryButton
                filesSection
                contactsSection
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle(event.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(role: .destructive) { showDeleteConfirm = true } label: {
                        Label("Delete event", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .task { files = await data.loadEventFiles(event.id) }
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoItems, maxSelectionCount: 5, matching: .images)
        .onChange(of: photoItems) { _, items in handlePhotoSelection(items) }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.pdf], allowsMultipleSelection: true) { result in
            handleFileImport(result)
        }
        .sheet(isPresented: $showAddContacts) {
            AddEventContactsSheet(event: event)
        }
        .sheet(isPresented: $showSummary) {
            EventSummarySheet(text: data.summary(forEvent: event))
        }
        .confirmationDialog("Delete this event?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    await data.deleteEvent(event)
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the event and its contact links. Your contacts are kept.")
        }
    }

    private var header: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    Text(event.title)
                        .font(.system(size: 19, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    Spacer(minLength: 8)
                    if let type = event.eventType, !type.isEmpty {
                        Text(type.capitalized)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Theme.primary.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
                if let description = event.description, !description.isEmpty {
                    Text(description)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.inkSecondary)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Label(event.formattedDate, systemImage: "calendar")
                    if let location = event.location, !location.isEmpty {
                        Label(location, systemImage: "mappin.and.ellipse")
                    }
                    if let website = event.website, !website.isEmpty,
                       let url = URL(string: website.hasPrefix("http") ? website : "https://\(website)") {
                        Link(destination: url) {
                            Label(website, systemImage: "globe")
                                .foregroundStyle(Theme.primary)
                        }
                    }
                }
                .font(.system(size: 12))
                .foregroundStyle(Theme.inkSecondary)
            }
        }
    }

    private var filesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Event Passes (\(files.count))", systemImage: "doc.text")
                    .font(.system(size: 11, weight: .bold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.primary)
                Spacer()
                Menu {
                    Button { showPhotoPicker = true } label: {
                        Label("Choose images", systemImage: "photo")
                    }
                    Button { showFileImporter = true } label: {
                        Label("Choose PDF", systemImage: "doc")
                    }
                } label: {
                    if uploading {
                        HStack(spacing: 5) {
                            ProgressView().controlSize(.mini)
                            Text("Uploading…")
                        }
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary)
                    } else {
                        Label("Upload", systemImage: "square.and.arrow.up")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                    }
                }
                .disabled(uploading)
            }
            .padding(.leading, 4)

            if files.isEmpty {
                Button { showPhotoPicker = true } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 22, weight: .light))
                            .foregroundStyle(Theme.inkSecondary.opacity(0.45))
                        Text("Upload event passes, badges, or tickets")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.inkSecondary)
                        Text("PDF or images · Max 10MB each")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.inkSecondary.opacity(0.7))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 22)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(style: StrokeStyle(lineWidth: 1, dash: [5]))
                            .foregroundStyle(Theme.border)
                    )
                }
                .buttonStyle(PressableButtonStyle())
            } else {
                VStack(spacing: 8) {
                    ForEach(files) { file in
                        fileRow(file)
                    }
                }
            }
        }
    }

    private func fileRow(_ file: EventFile) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Theme.primary.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: file.isPdf ? "doc.text" : "photo")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(file.fileName)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                if !file.formattedSize.isEmpty {
                    Text(file.formattedSize)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            Spacer(minLength: 8)
            Link(destination: data.eventFileURL(file)) {
                Image(systemName: "eye")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.primary)
                    .frame(width: 32, height: 32)
            }
            Button {
                Task {
                    await data.deleteEventFile(file)
                    files.removeAll { $0.id == file.id }
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.destructive)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
    }

    private func handlePhotoSelection(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        uploading = true
        Task {
            defer {
                uploading = false
                photoItems = []
            }
            for item in items {
                guard let bytes = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: bytes),
                      let jpeg = image.jpegData(compressionQuality: 0.85) else { continue }
                if let created = await data.uploadEventFile(
                    eventId: event.id,
                    fileName: "photo-\(Int(Date().timeIntervalSince1970)).jpg",
                    fileExtension: "jpg",
                    contentType: "image/jpeg",
                    isPdf: false,
                    bytes: jpeg
                ) {
                    files.insert(created, at: 0)
                }
            }
        }
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        guard case let .success(urls) = result, !urls.isEmpty else { return }
        uploading = true
        Task {
            defer { uploading = false }
            for url in urls {
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                guard let bytes = try? Data(contentsOf: url) else { continue }
                if let created = await data.uploadEventFile(
                    eventId: event.id,
                    fileName: url.lastPathComponent,
                    fileExtension: "pdf",
                    contentType: "application/pdf",
                    isPdf: true,
                    bytes: bytes
                ) {
                    files.insert(created, at: 0)
                }
            }
        }
    }

    private var summaryButton: some View {
        Button { showSummary = true } label: {
            Label("Generate recap", systemImage: "sparkles")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.primary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Theme.primary.opacity(0.1))
                .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var contactsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Contacts (\(linkedContacts.count))")
                    .font(.system(size: 11, weight: .bold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.primary)
                Spacer()
                Button { showAddContacts = true } label: {
                    Label("Tag", systemImage: "plus")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                }
                .buttonStyle(.plain)
            }
            .padding(.leading, 4)

            if linkedContacts.isEmpty {
                CardSurface {
                    VStack(spacing: 8) {
                        Image(systemName: "person.2")
                            .font(.system(size: 24, weight: .light))
                            .foregroundStyle(Theme.inkSecondary.opacity(0.5))
                        Text("No contacts tagged yet")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                        Text("Tag the people you met at this event.")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
            } else {
                VStack(spacing: 0) {
                    ForEach(linkedContacts) { contact in
                        contactRow(contact)
                        if contact.id != linkedContacts.last?.id {
                            Divider().background(Theme.border).padding(.leading, 56)
                        }
                    }
                }
                .background(Theme.surface)
                .clipShape(.rect(cornerRadius: Theme.cardRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cardRadius).stroke(Theme.border, lineWidth: 1)
                )
                .shadow(color: Theme.ink.opacity(0.04), radius: 10, y: 5)
            }
        }
    }

    private func contactRow(_ contact: Contact) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(Theme.primary.opacity(0.12))
                .frame(width: 40, height: 40)
                .overlay {
                    Text(contact.initials)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(contact.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.ink)
                if !contact.subtitle.isEmpty {
                    Text(contact.subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            Button {
                Task { await data.toggleContact(contact.id, on: event.id) }
            } label: {
                Image(systemName: "minus.circle")
                    .font(.system(size: 18))
                    .foregroundStyle(Theme.destructive)
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

/// Sheet to tag existing contacts to an event.
private struct AddEventContactsSheet: View {
    let event: Event
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var search = ""

    private var available: [Contact] {
        let linked = Set(data.eventContacts.filter { $0.eventId == event.id }.map(\.contactId))
        let pool = data.contacts.filter { !linked.contains($0.id) }
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return pool }
        return pool.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.company?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 0) {
                    if available.isEmpty {
                        Text(search.isEmpty ? "All your contacts are already tagged." : "No matches.")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.inkSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                    } else {
                        ForEach(available) { contact in
                            Button {
                                Task { await data.toggleContact(contact.id, on: event.id) }
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            } label: {
                                HStack(spacing: 12) {
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(Theme.primary.opacity(0.12))
                                        .frame(width: 36, height: 36)
                                        .overlay {
                                            Text(contact.initials)
                                                .font(.system(size: 13, weight: .semibold))
                                                .foregroundStyle(Theme.primary)
                                        }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(contact.name)
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundStyle(Theme.ink)
                                        if !contact.subtitle.isEmpty {
                                            Text(contact.subtitle)
                                                .font(.system(size: 12))
                                                .foregroundStyle(Theme.inkSecondary)
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer(minLength: 8)
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 20))
                                        .foregroundStyle(Theme.primary)
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            Divider().background(Theme.border).padding(.leading, 56)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
            .background(Theme.background)
            .navigationTitle("Tag contacts")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search contacts")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }
}

/// Sheet showing the generated event recap text with a share action.
private struct EventSummarySheet: View {
    let text: String
    @Environment(\.dismiss) private var dismiss
    @State private var showShare = false

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(text)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Event Recap")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showShare = true } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
            .sheet(isPresented: $showShare) {
                ShareSheet(items: [text])
            }
        }
    }
}
