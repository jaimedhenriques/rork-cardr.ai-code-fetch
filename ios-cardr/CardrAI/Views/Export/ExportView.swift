import SwiftUI

/// Native export screen mirroring the web `Export` page — pick contacts or notes,
/// filter by time range, then export via email, CSV, or vCard using the share sheet.
struct ExportView: View {
    @Environment(DataStore.self) private var data

    enum ExportTab: String, CaseIterable, Identifiable {
        case contacts, notes
        var id: String { rawValue }
        var label: String { rawValue.capitalized }
        var icon: String { self == .contacts ? "person.crop.rectangle" : "doc.text" }
    }

    enum DatePreset: String, CaseIterable, Identifiable {
        case all, today, week, month
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: "All time"
            case .today: "Today"
            case .week: "7 days"
            case .month: "30 days"
            }
        }
        /// The earliest date included, or nil for "all".
        var since: Date? {
            let cal = Calendar.current
            switch self {
            case .all: return nil
            case .today: return cal.startOfDay(for: Date())
            case .week: return Date().addingTimeInterval(-7 * 24 * 3600)
            case .month: return Date().addingTimeInterval(-30 * 24 * 3600)
            }
        }
    }

    @State private var tab: ExportTab = .contacts
    @State private var preset: DatePreset = .all
    @State private var selectedContacts: Set<String> = []
    @State private var selectedNotes: Set<String> = []
    @State private var includeNotes = true
    @State private var shareItems: [Any] = []
    @State private var showShare = false

    private let iso = ISO8601DateFormatter()

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                tabPicker
                filtersCard
                selectionCard
                actions
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Export")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: preset) { _, _ in clearSelection() }
        .onChange(of: tab) { _, _ in clearSelection() }
        .sheet(isPresented: $showShare) {
            ShareSheet(items: shareItems)
        }
    }

    // MARK: - Filtering

    private func inRange(_ raw: String?) -> Bool {
        guard let since = preset.since else { return true }
        guard let raw, let date = iso.date(from: raw) else { return true }
        return date >= since
    }

    private var filteredContacts: [Contact] {
        data.contacts.filter { inRange($0.scannedAt ?? $0.createdAt) }
    }

    private var filteredNotes: [MeetingNote] {
        data.notes.filter { inRange($0.createdAt) }
    }

    private func clearSelection() {
        selectedContacts.removeAll()
        selectedNotes.removeAll()
    }

    // MARK: - Tabs

    private var tabPicker: some View {
        HStack(spacing: 8) {
            ForEach(ExportTab.allCases) { item in
                let isActive = tab == item
                let count = item == .contacts ? filteredContacts.count : filteredNotes.count
                Button {
                    withAnimation(.snappy(duration: 0.2)) { tab = item }
                } label: {
                    Label("\(item.label) (\(count))", systemImage: item.icon)
                        .font(.system(size: 13, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(isActive ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.surfaceMuted.opacity(0.7)))
                        .foregroundStyle(isActive ? .white : Theme.inkSecondary)
                        .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
    }

    // MARK: - Filters

    private var filtersCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 12) {
                Label("Time range", systemImage: "calendar")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary)
                HStack(spacing: 8) {
                    ForEach(DatePreset.allCases) { p in
                        let isActive = preset == p
                        Button { preset = p } label: {
                            Text(p.label)
                                .font(.system(size: 12, weight: .semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(isActive ? Theme.primary : Theme.surfaceMuted.opacity(0.7))
                                .foregroundStyle(isActive ? .white : Theme.inkSecondary)
                                .clipShape(.capsule)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if tab == .contacts {
                    Divider().background(Theme.border)
                    Toggle(isOn: $includeNotes) {
                        Label("Include notes", systemImage: "note.text")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.ink)
                    }
                    .tint(Theme.primary)
                }
            }
        }
    }

    // MARK: - Selection list

    private var selectionCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(tab == .contacts ? "\(filteredContacts.count) contacts" : "\(filteredNotes.count) notes")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                    Button(action: toggleAll) {
                        Label(allSelected ? "Deselect all" : "Select all",
                              systemImage: allSelected ? "checkmark.square.fill" : "square")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                    }
                    .buttonStyle(.plain)
                }

                if tab == .contacts {
                    if filteredContacts.isEmpty {
                        emptyRow("No contacts match this range")
                    } else {
                        ForEach(filteredContacts) { c in
                            selectRow(
                                isOn: selectedContacts.contains(c.id),
                                title: c.name,
                                subtitle: c.subtitle.isEmpty ? (c.email ?? "") : c.subtitle
                            ) { toggle(&selectedContacts, c.id) }
                        }
                    }
                } else {
                    if filteredNotes.isEmpty {
                        emptyRow("No notes match this range")
                    } else {
                        ForEach(filteredNotes) { n in
                            selectRow(
                                isOn: selectedNotes.contains(n.id),
                                title: n.title.isEmpty ? "Untitled meeting" : n.title,
                                subtitle: n.summary ?? (n.durationLabel ?? "")
                            ) { toggle(&selectedNotes, n.id) }
                        }
                    }
                }
            }
        }
    }

    private func emptyRow(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(Theme.inkSecondary.opacity(0.7))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
    }

    private func selectRow(isOn: Bool, title: String, subtitle: String, toggle: @escaping () -> Void) -> some View {
        Button(action: toggle) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(isOn ? AnyShapeStyle(Theme.primary) : AnyShapeStyle(Theme.surfaceMuted))
                    .frame(width: 22, height: 22)
                    .overlay {
                        if isOn {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    if !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.inkSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
            .background(isOn ? Theme.primary.opacity(0.08) : Color.clear)
            .clipShape(.rect(cornerRadius: 12))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var allSelected: Bool {
        if tab == .contacts {
            return !filteredContacts.isEmpty && filteredContacts.allSatisfy { selectedContacts.contains($0.id) }
        }
        return !filteredNotes.isEmpty && filteredNotes.allSatisfy { selectedNotes.contains($0.id) }
    }

    private func toggleAll() {
        if tab == .contacts {
            selectedContacts = allSelected ? [] : Set(filteredContacts.map(\.id))
        } else {
            selectedNotes = allSelected ? [] : Set(filteredNotes.map(\.id))
        }
    }

    private func toggle(_ set: inout Set<String>, _ id: String) {
        if set.contains(id) { set.remove(id) } else { set.insert(id) }
    }

    // MARK: - Actions

    private var totalSelected: Int { selectedContacts.count + selectedNotes.count }

    private var actions: some View {
        VStack(spacing: 10) {
            if totalSelected > 0 {
                Text("\(totalSelected) selected")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.primary)
            }
            Button(action: shareEmailText) {
                Label("Share / email", systemImage: "envelope")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.brandGradient)
                    .foregroundStyle(.white)
                    .clipShape(.rect(cornerRadius: 14))
                    .shadow(color: Theme.primary.opacity(0.4), radius: 14, y: 8)
                    .opacity(totalSelected == 0 ? 0.35 : 1)
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(totalSelected == 0)

            if tab == .contacts && !selectedContacts.isEmpty {
                HStack(spacing: 10) {
                    fileButton("CSV", icon: "tablecells", tint: Theme.primary) { shareFile(csvString(), ext: "csv") }
                    fileButton("vCard", icon: "person.crop.rectangle", tint: Theme.success) { shareFile(vCardString(), ext: "vcf") }
                }
            }
        }
    }

    private func fileButton(_ label: String, icon: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(tint.opacity(0.3), lineWidth: 1))
                .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Export builders

    private func selectedContactList() -> [Contact] {
        filteredContacts.filter { selectedContacts.contains($0.id) }
    }

    private func selectedNoteList() -> [MeetingNote] {
        filteredNotes.filter { selectedNotes.contains($0.id) }
    }

    private func emailBody() -> String {
        var body = ""
        let contacts = selectedContactList()
        if !contacts.isEmpty {
            body += "CONTACTS (\(contacts.count))\n" + String(repeating: "—", count: 24) + "\n\n"
            body += contacts.map { c in
                var line = "• \(c.name)"
                if let t = c.title, !t.isEmpty { line += " — \(t)" }
                if let co = c.company, !co.isEmpty { line += " at \(co)" }
                if let e = c.email, !e.isEmpty { line += "\n  Email: \(e)" }
                if let p = c.phone, !p.isEmpty { line += "\n  Phone: \(p)" }
                if let l = c.linkedin, !l.isEmpty { line += "\n  LinkedIn: \(l)" }
                if includeNotes, let n = c.notes, !n.isEmpty { line += "\n  Notes: \(n)" }
                return line
            }.joined(separator: "\n\n")
        }
        let notes = selectedNoteList()
        if !notes.isEmpty {
            if !body.isEmpty { body += "\n\n\n" }
            body += "MEETING NOTES (\(notes.count))\n" + String(repeating: "—", count: 24) + "\n\n"
            body += notes.map { n in
                var line = "📝 \(n.title)"
                if let s = n.summary, !s.isEmpty { line += "\n  Summary: \(s)" }
                if let m = n.manualNotes, !m.isEmpty { line += "\n  Notes: \(m)" }
                return line
            }.joined(separator: "\n\n")
        }
        return body
    }

    private func shareEmailText() {
        guard totalSelected > 0 else { return }
        shareItems = [emailBody()]
        showShare = true
    }

    private func csvString() -> String {
        func esc(_ v: String?) -> String { "\"\((v ?? "").replacingOccurrences(of: "\"", with: "\"\""))\"" }
        var header = "Name,Title,Company,Email,Phone,LinkedIn,Website,Location"
        if includeNotes { header += ",Notes" }
        let rows = selectedContactList().map { c -> String in
            var cols = [esc(c.name), esc(c.title), esc(c.company), esc(c.email), esc(c.phone), esc(c.linkedin), esc(c.website), esc(c.location)]
            if includeNotes { cols.append(esc(c.notes)) }
            return cols.joined(separator: ",")
        }
        return ([header] + rows).joined(separator: "\n")
    }

    private func vCardString() -> String {
        selectedContactList().map { c in
            let parts = c.name.split(separator: " ")
            let last = parts.last.map(String.init) ?? ""
            let first = parts.dropLast().joined(separator: " ")
            var v = "BEGIN:VCARD\nVERSION:3.0\nN:\(last);\(first);;;\nFN:\(c.name)"
            if let co = c.company, !co.isEmpty { v += "\nORG:\(co)" }
            if let t = c.title, !t.isEmpty { v += "\nTITLE:\(t)" }
            if let e = c.email, !e.isEmpty { v += "\nEMAIL:\(e)" }
            if let p = c.phone, !p.isEmpty { v += "\nTEL:\(p)" }
            if let w = c.website, !w.isEmpty { v += "\nURL:\(w)" }
            if includeNotes, let n = c.notes, !n.isEmpty {
                v += "\nNOTE:\(n.replacingOccurrences(of: "\n", with: "\\n"))"
            }
            v += "\nEND:VCARD"
            return v
        }.joined(separator: "\n")
    }

    private func shareFile(_ content: String, ext: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let name = "cardr-contacts-\(formatter.string(from: Date())).\(ext)"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try content.data(using: .utf8)?.write(to: url)
            shareItems = [url]
            showShare = true
        } catch {
            shareItems = [content]
            showShare = true
        }
    }
}
