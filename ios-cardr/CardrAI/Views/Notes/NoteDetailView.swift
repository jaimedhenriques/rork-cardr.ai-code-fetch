import SwiftUI

/// A rich, editable meeting-note detail. Tap Edit to revise the summary, check
/// off and add action items / follow-ups / decisions, and rename the note —
/// all persisted back to the meeting note.
struct NoteDetailView: View {
    @Environment(DataStore.self) private var data
    let note: MeetingNote

    @State private var draft: MeetingNote
    @State private var completed: Set<String> = []
    @State private var isEditing = false
    @State private var isSaving = false

    init(note: MeetingNote) {
        self.note = note
        _draft = State(initialValue: note)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if isEditing {
                    editSummaryCard
                } else if let summary = draft.summary, !summary.isEmpty {
                    section("Summary", body: summary)
                }
                checklistCard("Action items", icon: "checkmark.circle.fill", tint: Theme.primary,
                              items: bindingFor(\.actionItems), checkable: true)
                checklistCard("Follow-ups", icon: "bell.badge.fill", tint: Theme.warning,
                              items: bindingFor(\.followUps), checkable: true)
                checklistCard("Decisions", icon: "flag.fill", tint: Theme.success,
                              items: bindingFor(\.decisions), checkable: false)
                if let topics = draft.keyTopics, !topics.isEmpty {
                    chips("Key topics", items: topics)
                }
                if let manual = draft.manualNotes, !manual.isEmpty {
                    section("Notes", body: manual)
                }
                if let transcript = draft.transcript, !transcript.isEmpty {
                    section("Transcript", body: transcript)
                }
                if isEmptyNote {
                    Text("This note has no content yet.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.background)
        .navigationTitle(draft.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if isSaving {
                    ProgressView()
                } else if isEditing {
                    Button("Done") { Task { await save() } }
                        .fontWeight(.semibold)
                } else {
                    Button("Edit") {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { isEditing = true }
                    }
                }
            }
        }
    }

    private var isEmptyNote: Bool {
        (draft.summary?.isEmpty ?? true) && (draft.manualNotes?.isEmpty ?? true)
            && (draft.transcript?.isEmpty ?? true)
            && (draft.actionItems?.isEmpty ?? true) && (draft.followUps?.isEmpty ?? true)
            && (draft.decisions?.isEmpty ?? true)
    }

    // MARK: - Header

    @ViewBuilder
    private var header: some View {
        if isEditing {
            CardSurface {
                VStack(alignment: .leading, spacing: 8) {
                    Text("TITLE")
                        .font(.caption2.weight(.bold)).tracking(1)
                        .foregroundStyle(Theme.inkSecondary)
                    TextField("Meeting title", text: $draft.title)
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                }
            }
        } else if let category = draft.category, !category.isEmpty {
            Text(category.uppercased())
                .font(.caption2.weight(.bold))
                .tracking(1)
                .foregroundStyle(Theme.primary)
        }
    }

    private var editSummaryCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 8) {
                Text("Summary")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                TextField("Add a summary…", text: Binding(
                    get: { draft.summary ?? "" },
                    set: { draft.summary = $0 }
                ), axis: .vertical)
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(3...12)
            }
        }
    }

    // MARK: - Editable checklist

    private func bindingFor(_ keyPath: WritableKeyPath<MeetingNote, [String]?>) -> Binding<[String]> {
        Binding(
            get: { draft[keyPath: keyPath] ?? [] },
            set: { draft[keyPath: keyPath] = $0.isEmpty ? nil : $0 }
        )
    }

    @ViewBuilder
    private func checklistCard(_ title: String, icon: String, tint: Color, items: Binding<[String]>, checkable: Bool) -> some View {
        if !items.wrappedValue.isEmpty || isEditing {
            CardSurface {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 6) {
                        Image(systemName: icon)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(tint)
                        Text(title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Spacer(minLength: 0)
                        if !items.wrappedValue.isEmpty {
                            Text("\(items.wrappedValue.count)")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(tint)
                                .padding(.horizontal, 7).padding(.vertical, 2)
                                .background(tint.opacity(0.12))
                                .clipShape(.capsule)
                        }
                    }

                    if items.wrappedValue.isEmpty {
                        Text("Nothing yet.")
                            .font(.footnote)
                            .foregroundStyle(Theme.inkSecondary)
                    }

                    ForEach(Array(items.wrappedValue.enumerated()), id: \.offset) { index, item in
                        HStack(alignment: .top, spacing: 10) {
                            if checkable {
                                Button {
                                    toggleComplete(item)
                                } label: {
                                    Image(systemName: completed.contains(item) ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 18))
                                        .foregroundStyle(completed.contains(item) ? tint : Theme.inkSecondary)
                                }
                                .buttonStyle(.plain)
                            } else {
                                Image(systemName: icon)
                                    .font(.system(size: 13))
                                    .foregroundStyle(tint)
                                    .padding(.top, 2)
                            }

                            if isEditing {
                                TextField("Item", text: Binding(
                                    get: { index < items.wrappedValue.count ? items.wrappedValue[index] : "" },
                                    set: { newValue in
                                        var arr = items.wrappedValue
                                        if index < arr.count { arr[index] = newValue; items.wrappedValue = arr }
                                    }
                                ))
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.ink)
                                Button {
                                    var arr = items.wrappedValue
                                    if index < arr.count { arr.remove(at: index); items.wrappedValue = arr }
                                } label: {
                                    Image(systemName: "minus.circle.fill")
                                        .foregroundStyle(Theme.destructive.opacity(0.7))
                                }
                                .buttonStyle(.plain)
                            } else {
                                Text(item)
                                    .font(.subheadline)
                                    .foregroundStyle(completed.contains(item) ? Theme.inkSecondary : Theme.ink)
                                    .strikethrough(completed.contains(item))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }

                    if isEditing {
                        Button {
                            items.wrappedValue.append("")
                        } label: {
                            Label("Add item", systemImage: "plus.circle.fill")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(tint)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func toggleComplete(_ item: String) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            if completed.contains(item) { completed.remove(item) } else { completed.insert(item) }
        }
    }

    private func save() async {
        isSaving = true
        // Drop empty items entered during editing.
        draft.actionItems = draft.actionItems?.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        draft.followUps = draft.followUps?.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        draft.decisions = draft.decisions?.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        if draft.summary?.trimmingCharacters(in: .whitespaces).isEmpty == true { draft.summary = nil }
        await data.updateNote(draft)
        isSaving = false
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { isEditing = false }
    }

    // MARK: - Reusable display blocks

    private func section(_ title: String, body: String) -> some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(body)
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }

    private func chips(_ title: String, items: [String]) -> some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 10) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                NoteFlowLayout(spacing: 8) {
                    ForEach(items, id: \.self) { topic in
                        Text(topic)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.primary)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Theme.primary.opacity(0.1))
                            .clipShape(.capsule)
                    }
                }
            }
        }
    }
}

/// Minimal wrapping flow layout for topic chips.
private struct NoteFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0
        var isFirstInRow = true

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if !isFirstInRow && x + size.width > maxWidth {
                totalHeight += rowHeight + spacing
                rowHeight = 0
                x = 0
                isFirstInRow = true
            }
            x += size.width + (isFirstInRow ? 0 : spacing)
            rowHeight = max(rowHeight, size.height)
            isFirstInRow = false
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
