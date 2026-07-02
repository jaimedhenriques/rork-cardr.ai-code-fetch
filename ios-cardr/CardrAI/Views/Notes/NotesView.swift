import SwiftUI

/// The notes hub — mirrors the web `Notes` page: three tabs (Conversations,
/// Calendar, Action Items), an upcoming-meetings "Coming up" rail, full-recall
/// search with labelled snippets, filters/sort, and ask-anything AI chat.
struct NotesView: View {
    @Environment(DataStore.self) private var data

    @State private var showComposer = false
    @State private var composerTitle: String?
    @State private var composerAutoStart = false
    @State private var query = ""
    @State private var tab: NoteTab = .conversations
    @State private var filters = NoteFilterState()
    @State private var showFilters = false
    @State private var showChat = false
    @State private var exportURL: URL?
    @State private var showSettings = false

    enum NoteTab: String, CaseIterable, Identifiable {
        case conversations, calendar, actions
        var id: String { rawValue }
        var label: String {
            switch self {
            case .conversations: return "Conversations"
            case .calendar: return "Calendar"
            case .actions: return "Action Items"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16, pinnedViews: []) {
                    header
                    segmentedControl
                    switch tab {
                    case .conversations: conversationsTab
                    case .calendar: calendarTab
                    case .actions: actionItemsTab
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 120)
            }
            .background(Theme.background)
            .navigationTitle("Notes")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: MeetingNote.self) { NoteDetailView(note: $0) }
            .refreshable { await data.loadNotes(); await data.loadEvents() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { DrawerMenuButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 4) {
                        Button { showSettings = true } label: {
                            Image(systemName: "slider.horizontal.3")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Button { openComposer() } label: {
                            Image(systemName: "plus.circle.fill")
                        }
                    }
                }
            }
            .sheet(isPresented: $showComposer) {
                NoteComposerView(prefillTitle: composerTitle, autoStart: composerAutoStart)
            }
            .sheet(isPresented: $showFilters) {
                NoteFiltersView(filters: $filters, categories: availableCategories)
            }
            .sheet(isPresented: $showChat) {
                NavigationStack { AIChatView() }
            }
            .sheet(item: $exportURL) { url in
                ShareSheet(items: [url])
            }
            .sheet(isPresented: $showSettings) {
                NoteSettingsView()
            }
            .overlay(alignment: .bottom) { bottomBar }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("My Notes")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Theme.ink)
                    if pendingActions.count > 0 {
                        Text("\(pendingActions.count) pending action\(pendingActions.count == 1 ? "" : "s")")
                            .font(.footnote)
                            .foregroundStyle(Theme.primary)
                    }
                }
                Spacer()
                Button { exportNotes() } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary)
                        .frame(width: 36, height: 36)
                        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var segmentedControl: some View {
        Picker("View", selection: $tab) {
            ForEach(NoteTab.allCases) { item in
                Text(item.label).tag(item)
            }
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Conversations tab

    @ViewBuilder
    private var conversationsTab: some View {
        comingUpSection
        searchBar
        if filters.activeCount > 0 { activeFilterChips }

        if data.isLoadingNotes && data.notes.isEmpty {
            ProgressView().padding(.top, 40)
        } else if filteredNotes.isEmpty {
            emptyNotes
        } else {
            ForEach(noteGroups, id: \.label) { group in
                VStack(alignment: .leading, spacing: 8) {
                    Text(group.label.uppercased())
                        .font(.caption2.weight(.bold))
                        .tracking(0.8)
                        .foregroundStyle(Theme.inkSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                    ForEach(group.notes) { note in
                        NavigationLink(value: note) {
                            NoteCard(note: note, matches: searchMatches[note.id] ?? [], folder: noteFolder(note.id), tags: noteTagList(note.id))
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(role: .destructive) {
                                Task { await data.deleteNote(note) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var comingUpSection: some View {
        let upcoming = upcomingEvents
        VStack(alignment: .leading, spacing: 8) {
            Text("COMING UP")
                .font(.caption2.weight(.bold))
                .tracking(0.8)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            if upcoming.isEmpty {
                CardSurface(padding: 14) {
                    HStack(spacing: 10) {
                        Image(systemName: "calendar")
                            .foregroundStyle(Theme.inkSecondary.opacity(0.5))
                        Text("No upcoming meetings")
                            .font(.subheadline)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }
            } else {
                ForEach(upcoming) { event in
                    CardSurface(padding: 14) {
                        HStack(spacing: 12) {
                            Image(systemName: "calendar")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.primary)
                                .frame(width: 36, height: 36)
                                .background(Theme.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(event.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.ink)
                                    .lineLimit(1)
                                Text(event.formattedDate)
                                    .font(.caption2)
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                            Spacer()
                            Button { openComposer(title: event.title, autoStart: true) } label: {
                                Label("Record", systemImage: "mic.fill")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .background(Theme.primary.opacity(0.1), in: Capsule())
                            }
                            .buttonStyle(PressableButtonStyle())
                        }
                    }
                }
            }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.inkSecondary)
                TextField("Search notes, summaries, transcripts", text: $query)
                    .font(.subheadline)
                    .autocorrectionDisabled()
                if !query.isEmpty {
                    Button { query = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))

            Button { showFilters = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 14, weight: .semibold))
                    if filters.activeCount > 0 {
                        Text("\(filters.activeCount)")
                            .font(.caption.weight(.bold))
                    }
                }
                .foregroundStyle(filters.activeCount > 0 ? .white : Theme.ink)
                .padding(.horizontal, 12)
                .frame(height: 40)
                .background(
                    filters.activeCount > 0 ? AnyShapeStyle(Theme.primary) : AnyShapeStyle(Theme.surface),
                    in: RoundedRectangle(cornerRadius: 12)
                )
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(filters.activeCount > 0 ? .clear : Theme.border, lineWidth: 1))
            }
            .buttonStyle(PressableButtonStyle())
        }
    }

    private var activeFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if filters.sortBy != .newest {
                    chip(filters.sortBy.label) { filters.sortBy = .newest }
                }
                if filters.hasActions {
                    chip("Has actions") { filters.hasActions = false }
                }
                ForEach(Array(filters.categories), id: \.self) { category in
                    chip(category) { filters.categories.remove(category) }
                }
                ForEach(Array(filters.folderIds), id: \.self) { fid in
                    if let folder = data.folders.first(where: { $0.id == fid }) {
                        chip("\(folder.emoji ?? "📁") \(folder.name)") { filters.folderIds.remove(fid) }
                    }
                }
                ForEach(Array(filters.tagIds), id: \.self) { tid in
                    if let tag = data.tags.first(where: { $0.id == tid }) {
                        chip(tag.name) { filters.tagIds.remove(tid) }
                    }
                }
                Button("Clear") { filters = NoteFilterState() }
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.destructive)
            }
        }
    }

    private func chip(_ text: String, onRemove: @escaping () -> Void) -> some View {
        Button(action: onRemove) {
            HStack(spacing: 4) {
                Text(text).font(.caption.weight(.medium))
                Image(systemName: "xmark").font(.system(size: 8, weight: .bold))
            }
            .foregroundStyle(Theme.primary)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(Theme.primary.opacity(0.1), in: Capsule())
        }
    }

    // MARK: - Calendar tab

    @ViewBuilder
    private var calendarTab: some View {
        let upcoming = upcomingEvents
        VStack(alignment: .leading, spacing: 8) {
            Text("My Agenda")
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
            if upcoming.isEmpty {
                emptyState(icon: "calendar", title: "No upcoming meetings",
                           subtitle: "Events you create appear here with a record shortcut.")
            } else {
                ForEach(upcoming) { event in
                    CardSurface {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(event.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Text(event.formattedDate)
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                            if let location = event.location, !location.isEmpty {
                                Text(location)
                                    .font(.caption2)
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                            HStack(spacing: 8) {
                                if let website = event.website, let url = URL(string: website) {
                                    Link(destination: url) {
                                        Label("Join", systemImage: "video.fill")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(Theme.primary)
                                            .padding(.horizontal, 10).padding(.vertical, 5)
                                            .background(Theme.primary.opacity(0.1), in: Capsule())
                                    }
                                }
                                Button { openComposer(title: event.title, autoStart: true) } label: {
                                    Label("Record", systemImage: "mic.fill")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Theme.primary)
                                        .padding(.horizontal, 10).padding(.vertical, 5)
                                        .background(Theme.primary.opacity(0.1), in: Capsule())
                                }
                                .buttonStyle(PressableButtonStyle())
                            }
                            .padding(.top, 2)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Action items tab

    @ViewBuilder
    private var actionItemsTab: some View {
        if allActionItems.isEmpty {
            emptyState(icon: "checkmark.circle", title: "No action items yet",
                       subtitle: "Record or write a note and we'll extract the to-dos.")
        } else {
            VStack(spacing: 8) {
                ForEach(allActionItems) { item in
                    NavigationLink(value: data.notes.first { $0.id == item.noteId } ?? data.notes[0]) {
                        CardSurface(padding: 14) {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: "circle")
                                    .font(.system(size: 18))
                                    .foregroundStyle(Theme.primary.opacity(0.5))
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.task)
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.ink)
                                        .multilineTextAlignment(.leading)
                                    Text("from \(item.noteTitle)")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.inkSecondary)
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Bottom bar

    private var bottomBar: some View {
        HStack(spacing: 10) {
            Button { showChat = true } label: {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                    Text("Ask anything")
                        .font(.subheadline)
                }
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Theme.surface, in: Capsule())
                .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                .shadow(color: Theme.ink.opacity(0.08), radius: 10, y: 4)
            }
            .buttonStyle(PressableButtonStyle())

            Button { openComposer() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus")
                    Text("New note").font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .frame(height: 48)
                .background(Theme.brandGradient, in: Capsule())
                .shadow(color: Theme.primary.opacity(0.35), radius: 12, y: 5)
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
    }

    // MARK: - Empty states

    private var emptyNotes: some View {
        emptyState(icon: query.isEmpty ? "note.text" : "magnifyingglass",
                   title: query.isEmpty ? "No notes yet" : "No matching notes",
                   subtitle: query.isEmpty ? "Record or write your first note." : "Try a different search term.")
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.largeTitle)
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 50)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Data

    private var upcomingEvents: [Event] {
        data.events
            .filter { $0.isUpcoming }
            .sorted { ($0.startsAt ?? .distantFuture) < ($1.startsAt ?? .distantFuture) }
            .prefix(5)
            .map { $0 }
    }

    private var availableCategories: [String] {
        Array(Set(data.notes.compactMap { $0.category?.isEmpty == false ? $0.category : nil })).sorted()
    }

    private var allActionItems: [NoteActionItem] {
        data.notes.flatMap { note in
            (note.actionItems ?? []).map {
                NoteActionItem(action: $0, noteId: note.id, noteTitle: note.title, date: note.createdDate)
            }
        }
    }

    /// Only the not-yet-done action items, for the pending count + tab.
    private var pendingActions: [NoteActionItem] {
        allActionItems.filter { !$0.action.isDone }
    }

    /// Notes after search + filters, plus the matched snippets per note.
    private var searchMatches: [String: [NoteSearchMatch]] {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return [:] }
        let q = query.lowercased()
        var result: [String: [NoteSearchMatch]] = [:]
        for note in data.notes {
            var hits: [NoteSearchMatch] = []
            func test(_ field: String, _ text: String?) {
                guard let text, text.lowercased().contains(q) else { return }
                hits.append(NoteSearchMatch(field: field, snippet: snippet(text, query: q)))
            }
            test("Title", note.title)
            test("Summary", note.summary)
            test("Notes", note.manualNotes)
            test("Category", note.category)
            (note.keyTopics ?? []).forEach { test("Topic", $0) }
            (note.actionItems ?? []).forEach { test("Action", $0.task) }
            (note.followUps ?? []).forEach { test("Follow-up", $0.description) }
            (note.decisions ?? []).forEach { test("Decision", $0) }
            (note.insights ?? []).forEach { test("Insight", $0) }
            (note.openQuestions ?? []).forEach { test("Question", $0) }
            (note.mentionedPeople ?? []).forEach { test("Person", "\($0.name)\($0.role.map { " (\($0))" } ?? "")") }
            test("Transcript", note.transcript)
            if !hits.isEmpty { result[note.id] = Array(hits.prefix(3)) }
        }
        return result
    }

    private func snippet(_ text: String, query q: String) -> String {
        let lower = text.lowercased()
        guard let range = lower.range(of: q) else { return String(text.prefix(80)) }
        let start = text.index(range.lowerBound, offsetBy: -20, limitedBy: text.startIndex) ?? text.startIndex
        let end = text.index(range.upperBound, offsetBy: 40, limitedBy: text.endIndex) ?? text.endIndex
        let prefix = start > text.startIndex ? "…" : ""
        let suffix = end < text.endIndex ? "…" : ""
        return prefix + String(text[start..<end]) + suffix
    }

    private var filteredNotes: [MeetingNote] {
        var list = data.notes
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            let matched = searchMatches
            list = list.filter { matched[$0.id] != nil }
        }
        if !filters.categories.isEmpty {
            list = list.filter { note in
                guard let category = note.category else { return false }
                return filters.categories.contains(category)
            }
        }
        if !filters.folderIds.isEmpty {
            list = list.filter { note in
                guard let fid = note.folderId else { return false }
                return filters.folderIds.contains(fid)
            }
        }
        if !filters.tagIds.isEmpty {
            let noteTagMap = Dictionary(grouping: data.noteTags, by: { $0.noteId })
            list = list.filter { note in
                let tids = Set(noteTagMap[note.id]?.map(\.tagId) ?? [])
                return filters.tagIds.allSatisfy { tids.contains($0) }
            }
        }
        if filters.hasActions {
            list = list.filter { !($0.actionItems?.isEmpty ?? true) }
        }
        switch filters.sortBy {
        case .newest: list.sort { ($0.createdDate ?? .distantPast) > ($1.createdDate ?? .distantPast) }
        case .oldest: list.sort { ($0.createdDate ?? .distantPast) < ($1.createdDate ?? .distantPast) }
        case .longest: list.sort { ($0.durationSeconds ?? 0) > ($1.durationSeconds ?? 0) }
        case .shortest: list.sort { ($0.durationSeconds ?? 0) < ($1.durationSeconds ?? 0) }
        }
        return list
    }

    private struct NoteGroup { let label: String; let notes: [MeetingNote] }

    private var noteGroups: [NoteGroup] {
        let calendar = Calendar.current
        var today: [MeetingNote] = []
        var yesterday: [MeetingNote] = []
        var week: [MeetingNote] = []
        var older: [(String, MeetingNote)] = []
        let monthFormatter = DateFormatter()
        monthFormatter.dateFormat = "MMMM yyyy"

        for note in filteredNotes {
            guard let date = note.createdDate else { older.append(("Earlier", note)); continue }
            if calendar.isDateInToday(date) { today.append(note) }
            else if calendar.isDateInYesterday(date) { yesterday.append(note) }
            else if calendar.isDate(date, equalTo: Date(), toGranularity: .weekOfYear) { week.append(note) }
            else { older.append((monthFormatter.string(from: date), note)) }
        }

        var groups: [NoteGroup] = []
        if !today.isEmpty { groups.append(NoteGroup(label: "Today", notes: today)) }
        if !yesterday.isEmpty { groups.append(NoteGroup(label: "Yesterday", notes: yesterday)) }
        if !week.isEmpty { groups.append(NoteGroup(label: "This Week", notes: week)) }
        let olderByMonth = Dictionary(grouping: older, by: { $0.0 })
        for (label, items) in olderByMonth.sorted(by: { ($0.value.first?.1.createdDate ?? .distantPast) > ($1.value.first?.1.createdDate ?? .distantPast) }) {
            groups.append(NoteGroup(label: label, notes: items.map { $0.1 }))
        }
        return groups
    }

    // MARK: - Actions

    private func openComposer(title: String? = nil, autoStart: Bool = false) {
        composerTitle = title
        composerAutoStart = autoStart
        showComposer = true
    }

    private func noteFolder(_ noteId: String) -> Folder? {
        guard let fid = data.notes.first(where: { $0.id == noteId })?.folderId else { return nil }
        return data.folders.first { $0.id == fid }
    }

    private func noteTagList(_ noteId: String) -> [Tag] {
        data.tags(forNote: noteId)
    }

    private func exportNotes() {
        let text = data.notes.map { note -> String in
            var lines = ["# \(note.title)"]
            if let summary = note.summary, !summary.isEmpty { lines.append(summary) }
            if let items = note.actionItems, !items.isEmpty {
                lines.append("Action items:")
                lines.append(contentsOf: items.map { "- [\($0.isDone ? "x" : " ")] \($0.task)" })
            }
            return lines.joined(separator: "\n")
        }.joined(separator: "\n\n---\n\n")
        guard !text.isEmpty else { return }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("cardr-notes.txt")
        try? text.data(using: .utf8)?.write(to: url)
        exportURL = url
    }
}

// MARK: - Note card

private struct NoteCard: View {
    let note: MeetingNote
    let matches: [NoteSearchMatch]
    var folder: Folder?
    var tags: [Tag] = []

    var body: some View {
        CardSurface(padding: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: note.isRecorded ? "mic.fill" : "doc.text.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.primary)
                    .frame(width: 34, height: 34)
                    .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 5) {
                    Text(note.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text(note.timeLabel)
                        if let duration = note.durationLabel { Text("· \(duration)") }
                        if note.openActionCount > 0 {
                            Text("· \(note.openActionCount) actions").foregroundStyle(Theme.primary)
                        }
                    }
                    .font(.caption2)
                    .foregroundStyle(Theme.inkSecondary)

                    if let category = note.category, !category.isEmpty {
                        Text(category)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.inkSecondary)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(Theme.surfaceMuted, in: Capsule())
                    }
                    if let folder {
                        Text("\(folder.emoji ?? "📁") \(folder.name)")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.primary)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(Theme.primary.opacity(0.1), in: Capsule())
                    }
                    ForEach(tags.prefix(3)) { tag in
                        HStack(spacing: 3) {
                            Circle().fill(Color(hex: tag.hexValue)).frame(width: 5, height: 5)
                            Text(tag.name)
                        }
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(Color(hex: tag.hexValue))
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Color(hex: tag.hexValue).opacity(0.1), in: Capsule())
                    }

                    if matches.isEmpty {
                        if let summary = note.summary, !summary.isEmpty {
                            Text(summary)
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                                .lineLimit(2)
                        }
                    } else {
                        ForEach(matches) { match in
                            HStack(alignment: .top, spacing: 6) {
                                Text(match.field.uppercased())
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 5).padding(.vertical, 2)
                                    .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 4))
                                Text(match.snippet)
                                    .font(.caption)
                                    .foregroundStyle(Theme.inkSecondary)
                                    .lineLimit(2)
                            }
                        }
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.5))
                    .padding(.top, 4)
            }
        }
    }
}
