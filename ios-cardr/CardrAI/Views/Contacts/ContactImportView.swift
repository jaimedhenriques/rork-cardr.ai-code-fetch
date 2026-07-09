import SwiftUI
import UniformTypeIdentifiers

/// A single contact parsed from an imported CSV/VCF file.
nonisolated struct ParsedImportContact: Identifiable, Hashable {
    let id = UUID()
    var name: String
    var email: String?
    var phone: String?
    var company: String?
    var title: String?
    var linkedin: String?
    var website: String?
    var location: String?
    var notes: String?
    var eventName: String?
    var selected: Bool = true

    var detailLine: String {
        [title, company, email].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

/// Imports contacts from a CSV or VCF/vCard file, mirroring the web
/// `ContactImportModal`: file pick → preview with selection, event mapping and
/// duplicate handling → batch import with progress.
struct ContactImportView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    enum Step { case upload, preview }

    @State private var step: Step = .upload
    @State private var rows: [ParsedImportContact] = []
    @State private var showFileImporter = false
    @State private var importing = false
    @State private var errorMessage: String?

    // Event mapping
    private static let eventAuto = "__auto__"
    private static let eventNone = "__none__"
    private static let eventNew = "__new__"
    @State private var eventChoice = ContactImportView.eventNone
    @State private var newEventName = ""

    @State private var mergeMode: DataStore.ImportMergeMode = .merge

    private var csvHasEventColumn: Bool { rows.contains { ($0.eventName?.isEmpty == false) } }
    private var selectedCount: Int { rows.filter(\.selected).count }
    private var allSelected: Bool { !rows.isEmpty && rows.allSatisfy(\.selected) }

    var body: some View {
        NavigationStack {
            Group {
                switch step {
                case .upload: uploadStep
                case .preview: previewStep
                }
            }
            .background(Theme.background)
            .navigationTitle("Import Contacts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .fileImporter(
                isPresented: $showFileImporter,
                allowedContentTypes: importableTypes,
                allowsMultipleSelection: false
            ) { handleFileResult($0) }
        }
    }

    private var importableTypes: [UTType] {
        var types: [UTType] = [.commaSeparatedText, .text, .plainText]
        if let vcf = UTType(filenameExtension: "vcf") { types.append(vcf) }
        if let vcard = UTType(filenameExtension: "vcard") { types.append(vcard) }
        if let csv = UTType(filenameExtension: "csv") { types.append(csv) }
        return types
    }

    // MARK: - Upload step

    private var uploadStep: some View {
        ScrollView {
            VStack(spacing: 14) {
                sourceCard(
                    title: "CSV File",
                    subtitle: "From CardrAI export, spreadsheets, CRM",
                    icon: "doc.text.fill",
                    tint: Theme.primary
                )
                sourceCard(
                    title: "VCF / vCard File",
                    subtitle: "Export from iPhone, Android, Outlook",
                    icon: "person.crop.square.filled.and.at.rectangle",
                    tint: Theme.accent
                )

                VStack(alignment: .leading, spacing: 6) {
                    Label("Tip", systemImage: "info.circle.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                    Text("Add an Event column to your CSV to auto-organize rows into event folders.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                    Text("Recognized columns: Name, Email, Phone, Company, Title, LinkedIn, Website, Location, Notes, Event.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(16)
        }
    }

    private func sourceCard(title: String, subtitle: String, icon: String, tint: Color) -> some View {
        Button {
            errorMessage = nil
            showFileImporter = true
        } label: {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 44, height: 44)
                    .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.doc")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary)
            }
            .padding(16)
            .frame(maxWidth: .infinity)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(tint.opacity(0.3), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            )
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Preview step

    private var previewStep: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 14) {
                    eventMappingCard
                    mergeModeCard
                    selectionHeader
                    contactList
                }
                .padding(16)
            }
            footerBar
        }
    }

    private var eventMappingCard: some View {
        CardSurface(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                Label("Add to event folder", systemImage: "calendar")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Picker("Event", selection: $eventChoice) {
                    if csvHasEventColumn {
                        Text("Auto from CSV (Event column)").tag(Self.eventAuto)
                    }
                    Text("No event — import as-is").tag(Self.eventNone)
                    ForEach(data.events) { event in
                        Text(event.title).tag(event.id)
                    }
                    Text("+ Create new event…").tag(Self.eventNew)
                }
                .pickerStyle(.menu)
                .tint(Theme.primary)
                .frame(maxWidth: .infinity, alignment: .leading)

                if eventChoice == Self.eventNew {
                    TextField("New event name", text: $newEventName)
                        .textFieldStyle(.roundedBorder)
                }
                if eventChoice == Self.eventAuto && csvHasEventColumn {
                    Text("New events are created automatically when names don't match existing ones.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
        }
    }

    private var mergeModeCard: some View {
        CardSurface(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Duplicate handling (matched by email)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                HStack(spacing: 10) {
                    mergeChip("Merge (fill blanks)", mode: .merge)
                    mergeChip("Skip duplicates", mode: .skip)
                }
            }
        }
    }

    private func mergeChip(_ label: String, mode: DataStore.ImportMergeMode) -> some View {
        let active = mergeMode == mode
        return Button { mergeMode = mode } label: {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(active ? .white : Theme.inkSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(active ? Theme.primary : Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var selectionHeader: some View {
        HStack {
            Text("\(selectedCount) of \(rows.count) selected")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Spacer()
            Button(allSelected ? "Deselect All" : "Select All") { toggleAll() }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.primary)
        }
    }

    private var contactList: some View {
        VStack(spacing: 6) {
            ForEach($rows) { $row in
                Button { row.selected.toggle() } label: {
                    HStack(spacing: 12) {
                        Image(systemName: row.selected ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 20))
                            .foregroundStyle(row.selected ? Theme.primary : Theme.inkSecondary.opacity(0.4))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.name)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.ink)
                                .lineLimit(1)
                            if !row.detailLine.isEmpty {
                                Text(row.detailLine)
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.inkSecondary)
                                    .lineLimit(1)
                            }
                        }
                        Spacer(minLength: 0)
                        if let event = row.eventName, !event.isEmpty {
                            Text(event)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Theme.accent)
                                .lineLimit(1)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(Theme.accent.opacity(0.15), in: Capsule())
                        }
                    }
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(row.selected ? Theme.primary.opacity(0.06) : Theme.surfaceMuted.opacity(0.5))
                    )
                    .opacity(row.selected ? 1 : 0.6)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var footerBar: some View {
        VStack(spacing: 8) {
            if importing, let progress = data.importProgress {
                Text("Importing \(progress.current) / \(progress.total)…")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.inkSecondary)
                    .monospacedDigit()
            }
            HStack(spacing: 12) {
                Button {
                    rows = []
                    step = .upload
                } label: {
                    Label("Back", systemImage: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .foregroundStyle(Theme.ink)
                        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .disabled(importing)

                Button(action: runImport) {
                    HStack(spacing: 8) {
                        if importing {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "square.and.arrow.down.fill")
                        }
                        Text(importing ? "Importing…" : "Import \(selectedCount)")
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .foregroundStyle(.white)
                    .background(Theme.brandGradient, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(importing || selectedCount == 0 || (eventChoice == Self.eventNew && newEventName.trimmingCharacters(in: .whitespaces).isEmpty))
            }
        }
        .padding(16)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Divider() }
    }

    // MARK: - File handling

    private func handleFileResult(_ result: Result<[URL], Error>) {
        errorMessage = nil
        guard case .success(let urls) = result, let url = urls.first else { return }
        let needsStop = url.startAccessingSecurityScopedResource()
        defer { if needsStop { url.stopAccessingSecurityScopedResource() } }
        do {
            let text = try String(contentsOf: url, encoding: .utf8)
            let lowerName = url.lastPathComponent.lowercased()
            let parsed: [ParsedImportContact]
            if lowerName.hasSuffix(".vcf") || lowerName.hasSuffix(".vcard") {
                parsed = ContactFileParser.parseVCF(text)
            } else {
                parsed = ContactFileParser.parseCSV(text)
            }
            guard !parsed.isEmpty else {
                errorMessage = "No contacts found in this file."
                return
            }
            rows = parsed
            eventChoice = parsed.contains { $0.eventName?.isEmpty == false } ? Self.eventAuto : Self.eventNone
            step = .preview
        } catch {
            errorMessage = "Could not read that file. Use a UTF-8 CSV or VCF."
        }
    }

    private func toggleAll() {
        let select = !allSelected
        for index in rows.indices { rows[index].selected = select }
    }

    private func runImport() {
        let selected = rows.filter(\.selected)
        guard !selected.isEmpty else { return }
        let choice: DataStore.ImportEventChoice
        switch eventChoice {
        case Self.eventAuto: choice = .auto
        case Self.eventNone: choice = .none
        case Self.eventNew: choice = .new(newEventName.trimmingCharacters(in: .whitespaces))
        default: choice = .existing(eventChoice)
        }
        importing = true
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        Task {
            _ = await data.importContacts(selected, eventChoice: choice, mergeMode: mergeMode)
            importing = false
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss()
        }
    }
}
