import SwiftUI
import UIKit

/// A rich, Granola/Otter-class meeting-note detail. Shows summary, analytics,
/// key topics, structured action items (owner / deadline / checkbox), follow-ups,
/// decisions, insights, people mentioned and open questions — each editable in
/// place — plus re-analyze, copy, share and PDF export.
struct NoteDetailView: View {
    @Environment(DataStore.self) private var data
    let note: MeetingNote

    @State private var draft: MeetingNote
    @State private var isEditing = false
    @State private var isSaving = false
    @State private var isAnalyzing = false
    @State private var didAutoEnhance = false
    @State private var template: NoteTemplate = .default
    @State private var participants: [MeetingParticipant] = []
    @State private var showContactPicker = false
    @State private var isLinking = false
    @State private var shareURL: URL?
    @State private var showDeleteConfirm = false
    @State private var copied = false
    @State private var showChat = false
    @State private var showFolderPicker = false
    @State private var showTagPicker = false
    @State private var showCategoryPicker = false
    @State private var generatingShareLink = false
    @State private var showEventLinker = false
    @State private var speakerNames: [String: String] = [:]
    @State private var editingSpeaker: String?
    @State private var speakerDraft = ""
    @Environment(\.dismiss) private var dismiss

    init(note: MeetingNote) {
        self.note = note
        _draft = State(initialValue: note)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if isAnalyzing { analyzingBanner }
                if draft.hasInsights && draft.hasContent && !isEditing { toolbarRow }
                if draft.hasContent && !isEditing { askButton }

                summaryCard
                analyticsCard
                topicsCard
                actionItemsCard
                followUpsCard
                decisionsCard
                insightsCard
                peopleCard
                openQuestionsCard
                linkedContactsCard

                if let manual = draft.manualNotes, !manual.isEmpty, !isEditing {
                    readSection("Notes", icon: "pencil", body: manual)
                }
                if let transcript = draft.transcript, !transcript.isEmpty, !isEditing {
                    transcriptCard(transcript)
                }
                if isEmptyNote && !isEditing {
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
        .task { participants = await data.participants(for: note.id) }
        .task { await autoEnhanceIfNeeded() }
        .sheet(isPresented: $showContactPicker) {
            NoteContactPickerView(
                linkedContactIds: Set(participants.compactMap { $0.contactId }),
                hasActionItems: !(draft.actionItems?.isEmpty ?? true)
            ) { contact, createTasks in
                await link(contact, createTasks: createTasks)
            }
        }
        .sheet(item: $shareURL) { url in ShareSheet(items: [url]) }
        .sheet(isPresented: $showChat) { NoteChatView(note: draft) }
        .sheet(isPresented: $showFolderPicker) {
            NoteFolderPickerView(noteId: note.id, currentFolderId: draft.folderId)
        }
        .sheet(isPresented: $showTagPicker) {
            NoteTagPickerView(noteId: note.id)
        }
        .sheet(isPresented: $showCategoryPicker) {
            NoteCategoryPickerView(noteId: note.id, currentCategory: draft.category)
        }
        .sheet(isPresented: $showEventLinker) {
            NoteEventLinkerView(noteId: note.id, currentEventId: draft.calendarEventId)
        }
        .confirmationDialog("Delete this note?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await data.deleteNote(note); dismiss() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if isSaving {
                    ProgressView()
                } else if isEditing {
                    Button("Done") { Task { await save() } }.fontWeight(.semibold)
                } else {
                    Menu {
                        Button { withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { isEditing = true } } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        Button { copyToClipboard() } label: { Label("Copy as text", systemImage: "doc.on.doc") }
                        Button { shareURL = NoteExport.textFile(draft) } label: { Label("Share as file", systemImage: "square.and.arrow.up") }
                        Button { shareURL = NoteExport.pdf(draft) } label: { Label("Export PDF", systemImage: "arrow.down.doc") }
                        Button { Task { await generateShareLink() } } label: {
                            if generatingShareLink {
                                Label("Generating…", systemImage: "link")
                            } else {
                                Label("Share link", systemImage: "link")
                            }
                        }
                        Divider()
                        Button { showFolderPicker = true } label: { Label("Move to folder", systemImage: "folder") }
                        Button { showCategoryPicker = true } label: { Label("Set category", systemImage: "tag") }
                        Button { showTagPicker = true } label: { Label("Manage tags", systemImage: "number") }
                        Button { showEventLinker = true } label: { Label("Link event", systemImage: "calendar.badge.plus") }
                        Button { showContactPicker = true } label: { Label("Link contact", systemImage: "person.crop.circle.badge.plus") }
                        Divider()
                        Button(role: .destructive) { showDeleteConfirm = true } label: { Label("Delete", systemImage: "trash") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
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
        } else {
            VStack(alignment: .leading, spacing: 6) {
                if let category = draft.category, !category.isEmpty {
                    Text(category.uppercased())
                        .font(.caption2.weight(.bold)).tracking(1)
                        .foregroundStyle(Theme.primary)
                }
                Text(draft.title)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.ink)
                HStack(spacing: 6) {
                    Text(draft.fullDateLabel)
                    if let dur = draft.durationLabel { Text("· \(dur)") }
                }
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
            }
        }
    }

    /// Prominent entry point to chat with this meeting (Granola/Plaud signature feature).
    private var askButton: some View {
        Button { showChat = true } label: {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Theme.brandGradient, in: RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Ask this meeting")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text("Chat with the summary, transcript & action items")
                        .font(.caption2)
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            }
            .padding(12)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.primary.opacity(0.25), lineWidth: 1))
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var analyzingBanner: some View {
        CardSurface {
            HStack(spacing: 12) {
                ProgressView()
                VStack(alignment: .leading, spacing: 2) {
                    Text("Enhancing with AI…")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text("Pulling out the summary, action items and insights.")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
        }
    }

    private var toolbarRow: some View {
        HStack(spacing: 10) {
            Menu {
                ForEach(NoteTemplate.all) { item in
                    Button {
                        template = item
                    } label: {
                        Label("\(item.emoji)  \(item.label)", systemImage: template.id == item.id ? "checkmark" : "")
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Text(template.emoji)
                    Text(template.label).font(.caption.weight(.medium)).lineLimit(1)
                }
                .foregroundStyle(Theme.inkSecondary)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Theme.surfaceMuted, in: Capsule())
            }
            Spacer()
            Button { Task { await reanalyze() } } label: {
                Label("Re-analyze", systemImage: "arrow.triangle.2.circlepath")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.primary)
            }
            .disabled(isAnalyzing)
        }
    }

    // MARK: - Summary

    @ViewBuilder
    private var summaryCard: some View {
        if isEditing {
            sectionCard("Summary", icon: "lightbulb.fill", tint: Theme.primary) {
                TextField("Add a summary…", text: Binding(
                    get: { draft.summary ?? "" },
                    set: { draft.summary = $0 }
                ), axis: .vertical)
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(3...12)
            }
        } else if let summary = draft.summary, !summary.isEmpty {
            sectionCard("Summary", icon: "lightbulb.fill", tint: Theme.primary) {
                Text(summary)
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink.opacity(0.85))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - Analytics

    @ViewBuilder
    private var analyticsCard: some View {
        if !isEditing, let analytics = draft.analytics, analytics.hasContent {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                    Text("Meeting Analytics")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                }
                if let metrics = analytics.keyMetrics, !metrics.isEmpty {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(metrics) { metric in
                            CardSurface(padding: 12) {
                                HStack(spacing: 10) {
                                    Image(systemName: iconName(metric.icon))
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(Theme.primary)
                                        .frame(width: 36, height: 36)
                                        .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 9))
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(metric.value)
                                            .font(.headline)
                                            .foregroundStyle(Theme.ink)
                                            .lineLimit(1)
                                        Text(metric.label.uppercased())
                                            .font(.system(size: 9, weight: .semibold))
                                            .foregroundStyle(Theme.inkSecondary)
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                }
                            }
                        }
                    }
                }
                if let ratio = analytics.talkTimeRatio, ratio.count > 1 {
                    talkTimeBar(ratio)
                }
            }
        }
    }

    private func talkTimeBar(_ ratio: [String: Double]) -> some View {
        let palette: [Color] = [Theme.primary, Theme.success, Theme.warning, Theme.destructive.opacity(0.7), Theme.primary.opacity(0.6)]
        let entries = ratio.sorted { $0.value > $1.value }
        return CardSurface(padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Text("TALK TIME")
                    .font(.system(size: 10, weight: .bold)).tracking(0.8)
                    .foregroundStyle(Theme.inkSecondary)
                GeometryReader { geo in
                    HStack(spacing: 0) {
                        ForEach(Array(entries.enumerated()), id: \.element.key) { index, entry in
                            palette[index % palette.count]
                                .frame(width: max(2, geo.size.width * entry.value))
                        }
                    }
                }
                .frame(height: 12)
                .clipShape(.capsule)
                FlowChips(items: entries.enumerated().map { index, entry in
                    "\(entry.key) · \(Int(entry.value * 100))%"
                })
            }
        }
    }

    // MARK: - Key topics

    @ViewBuilder
    private var topicsCard: some View {
        if isEditing {
            editableStringList("Key Topics", icon: "number", tint: Theme.primary,
                               binding: optionalBinding(\.keyTopics), placeholder: "Topic")
        } else if let topics = draft.keyTopics, !topics.isEmpty {
            sectionCard("Key Topics", icon: "number", tint: Theme.primary) {
                FlowChips(items: topics)
            }
        }
    }

    // MARK: - Action items

    @ViewBuilder
    private var actionItemsCard: some View {
        let actions = draft.actionItems ?? []
        if !actions.isEmpty || isEditing {
            sectionCard("Action Items", icon: "checkmark.circle.fill", tint: Theme.primary,
                        trailing: actions.isEmpty ? nil : "\(actions.filter { $0.isDone }.count)/\(actions.count)") {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(actions.enumerated()), id: \.element.id) { index, action in
                        if isEditing {
                            editableActionRow(index)
                        } else {
                            actionRow(index, action)
                        }
                    }
                    if isEditing {
                        Button {
                            draft.actionItems = (draft.actionItems ?? []) + [NoteAction(task: "")]
                        } label: {
                            Label("Add action", systemImage: "plus.circle.fill")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.primary)
                        }
                    } else if actions.isEmpty {
                        Text("Nothing yet.").font(.footnote).foregroundStyle(Theme.inkSecondary)
                    }
                }
            }
        }
    }

    private func actionRow(_ index: Int, _ action: NoteAction) -> some View {
        Button { Task { await toggleAction(index) } } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: action.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 18))
                    .foregroundStyle(action.isDone ? Theme.primary : Theme.inkSecondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(action.task)
                        .font(.subheadline)
                        .foregroundStyle(action.isDone ? Theme.inkSecondary : Theme.ink)
                        .strikethrough(action.isDone)
                        .multilineTextAlignment(.leading)
                    if action.owner?.isEmpty == false || action.deadline?.isEmpty == false {
                        HStack(spacing: 4) {
                            if let owner = action.owner, !owner.isEmpty {
                                Text(owner).fontWeight(.medium)
                            }
                            if action.owner?.isEmpty == false, action.deadline?.isEmpty == false { Text("·") }
                            if let deadline = action.deadline, !deadline.isEmpty { Text("by \(deadline)") }
                        }
                        .font(.caption2)
                        .foregroundStyle(Theme.inkSecondary)
                    }
                }
                Spacer(minLength: 0)
                if let priority = action.priority, !priority.isEmpty {
                    Text(priority.uppercased())
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(priorityColor(priority))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(priorityColor(priority).opacity(0.12), in: Capsule())
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func editableActionRow(_ index: Int) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                TextField("Task", text: actionBinding(index, \.task))
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                Button {
                    draft.actionItems?.remove(at: index)
                } label: {
                    Image(systemName: "minus.circle.fill").foregroundStyle(Theme.destructive.opacity(0.7))
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 8) {
                TextField("Owner", text: actionBinding(index, \.owner))
                    .font(.caption)
                TextField("Deadline", text: actionBinding(index, \.deadline))
                    .font(.caption)
            }
            .foregroundStyle(Theme.inkSecondary)
        }
        .padding(10)
        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Follow-ups

    @ViewBuilder
    private var followUpsCard: some View {
        let followUps = draft.followUps ?? []
        if !followUps.isEmpty || isEditing {
            sectionCard("Follow-Ups", icon: "arrow.turn.down.right", tint: Theme.warning) {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(followUps.enumerated()), id: \.element.id) { index, followUp in
                        if isEditing {
                            HStack(spacing: 8) {
                                TextField("Follow-up", text: followUpBinding(index, \.description))
                                    .font(.subheadline)
                                TextField("With", text: followUpBinding(index, \.with))
                                    .font(.caption)
                                    .frame(maxWidth: 90)
                                Button { draft.followUps?.remove(at: index) } label: {
                                    Image(systemName: "minus.circle.fill").foregroundStyle(Theme.destructive.opacity(0.7))
                                }
                                .buttonStyle(.plain)
                            }
                        } else {
                            HStack(alignment: .top, spacing: 8) {
                                Circle().fill(Theme.warning).frame(width: 6, height: 6).padding(.top, 6)
                                Text(followUp.description)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.ink.opacity(0.85))
                                + Text(followUp.with.map { " — \($0)" } ?? "")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.warning)
                            }
                        }
                    }
                    if isEditing {
                        Button {
                            draft.followUps = (draft.followUps ?? []) + [NoteFollowUp(description: "")]
                        } label: {
                            Label("Add follow-up", systemImage: "plus.circle.fill")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.warning)
                        }
                    } else if followUps.isEmpty {
                        Text("Nothing yet.").font(.footnote).foregroundStyle(Theme.inkSecondary)
                    }
                }
            }
        }
    }

    // MARK: - Decisions

    @ViewBuilder
    private var decisionsCard: some View {
        if isEditing {
            editableStringList("Decisions", icon: "flag.fill", tint: Theme.success,
                               binding: optionalBinding(\.decisions), placeholder: "Decision")
        } else if let decisions = draft.decisions, !decisions.isEmpty {
            sectionCard("Decisions", icon: "flag.fill", tint: Theme.success) {
                bulletList(decisions, tint: Theme.success)
            }
        }
    }

    // MARK: - Insights / People / Questions (read-only)

    @ViewBuilder
    private var insightsCard: some View {
        if !isEditing, let insights = draft.insights, !insights.isEmpty {
            sectionCard("Insights", icon: "sparkles", tint: Theme.primary) {
                bulletList(insights, tint: Theme.primary)
            }
        }
    }

    @ViewBuilder
    private var peopleCard: some View {
        if !isEditing, let people = draft.mentionedPeople, !people.isEmpty {
            sectionCard("People Mentioned", icon: "person.2.fill", tint: Theme.primary) {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(people) { person in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(person.name).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.ink)
                                if let role = person.role, !role.isEmpty {
                                    Text("— \(role)").font(.caption).foregroundStyle(Theme.inkSecondary)
                                }
                            }
                            if let context = person.context, !context.isEmpty {
                                Text(context).font(.caption).foregroundStyle(Theme.inkSecondary)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var openQuestionsCard: some View {
        if !isEditing, let questions = draft.openQuestions, !questions.isEmpty {
            sectionCard("Open Questions", icon: "questionmark.circle.fill", tint: Theme.warning) {
                bulletList(questions, tint: Theme.warning)
            }
        }
    }

    // MARK: - Linked contacts

    private var linkedContactsCard: some View {
        sectionCard("People", icon: "person.crop.circle.badge.plus", tint: Theme.primary,
                    trailing: isLinking ? nil : nil) {
            VStack(alignment: .leading, spacing: 12) {
                if isLinking { ProgressView().controlSize(.small) }
                if participants.isEmpty {
                    Text("Link this note to a contact to keep your CRM in sync.")
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }
                ForEach(participants) { participant in
                    HStack(spacing: 10) {
                        Circle()
                            .fill(Theme.primary.opacity(0.12))
                            .frame(width: 30, height: 30)
                            .overlay(
                                Text(initials(participant.name))
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(Theme.primary)
                            )
                        Text(participant.name).font(.subheadline).foregroundStyle(Theme.ink)
                        Spacer()
                        Button { Task { await unlink(participant) } } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                        }
                        .buttonStyle(.plain)
                    }
                }
                Button { showContactPicker = true } label: {
                    Label("Link a contact", systemImage: "plus.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.primary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Reusable building blocks

    private func sectionCard<Content: View>(
        _ title: String, icon: String, tint: Color, trailing: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
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
                    if let trailing {
                        Text(trailing)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(tint)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(tint.opacity(0.12), in: Capsule())
                    }
                }
                content()
            }
        }
    }

    /// Renders a transcript with speaker labels styled into rows (Otter-style)
    /// when the text is speaker-segmented; otherwise shows it as a plain block.
    /// Speaker labels are tappable to rename them inline.
    @ViewBuilder
    private func transcriptCard(_ transcript: String) -> some View {
        let segments = TranscriptSegment.parse(transcript)
        let speakers = Array(Set(segments.compactMap { $0.speaker })).sorted()
        sectionCard("Transcript", icon: "waveform", tint: Theme.inkSecondary,
                    trailing: speakers.count > 1 ? "\(speakers.count) speakers" : nil) {
            if segments.contains(where: { $0.speaker != nil }) {
                VStack(alignment: .leading, spacing: 12) {
                    if speakers.count > 1 {
                        speakerLegend(speakers)
                    }
                    ForEach(segments) { segment in
                        VStack(alignment: .leading, spacing: 3) {
                            if let speaker = segment.speaker {
                                if editingSpeaker == speaker {
                                    HStack(spacing: 6) {
                                        TextField("Speaker name", text: $speakerDraft)
                                            .font(.caption2.weight(.bold))
                                            .foregroundStyle(segment.tint)
                                            .textFieldStyle(.plain)
                                            .onSubmit { commitSpeakerRename(speaker) }
                                        Button { commitSpeakerRename(speaker) } label: {
                                            Image(systemName: "checkmark.circle.fill")
                                                .font(.caption2)
                                                .foregroundStyle(Theme.primary)
                                        }
                                        .buttonStyle(.plain)
                                        Button { editingSpeaker = nil; speakerDraft = "" } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.caption2)
                                                .foregroundStyle(Theme.inkSecondary)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                } else {
                                    Button {
                                        editingSpeaker = speaker
                                        speakerDraft = speakerNames[speaker] ?? ""
                                    } label: {
                                        Text(speakerNames[speaker] ?? speaker)
                                            .font(.caption2.weight(.bold))
                                            .foregroundStyle(segment.tint)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            Text(segment.text)
                                .font(.subheadline)
                                .foregroundStyle(Theme.ink.opacity(0.85))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            } else {
                Text(transcript)
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
        }
    }

    private func speakerLegend(_ speakers: [String]) -> some View {
        FlowLayout(spacing: 8) {
            ForEach(speakers, id: \.self) { speaker in
                let segment = TranscriptSegment(speaker: speaker, text: "")
                HStack(spacing: 4) {
                    Circle().fill(segment.tint).frame(width: 7, height: 7)
                    Text(speakerNames[speaker] ?? speaker)
                }
                .font(.caption2.weight(.medium))
                .foregroundStyle(Theme.inkSecondary)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(Theme.surfaceMuted, in: Capsule())
            }
        }
    }

    private func commitSpeakerRename(_ speaker: String) {
        let trimmed = speakerDraft.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { editingSpeaker = nil; return }
        speakerNames[speaker] = trimmed
        editingSpeaker = nil
        speakerDraft = ""
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func readSection(_ title: String, icon: String, body: String) -> some View {
        sectionCard(title, icon: icon, tint: Theme.inkSecondary) {
            Text(body)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func bulletList(_ items: [String], tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(tint).frame(width: 6, height: 6).padding(.top, 6)
                    Text(item)
                        .font(.subheadline)
                        .foregroundStyle(Theme.ink.opacity(0.85))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func editableStringList(_ title: String, icon: String, tint: Color, binding: Binding<[String]>, placeholder: String) -> some View {
        sectionCard(title, icon: icon, tint: tint) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(binding.indices, id: \.self) { index in
                    HStack(spacing: 8) {
                        TextField(placeholder, text: binding[index])
                            .font(.subheadline)
                            .foregroundStyle(Theme.ink)
                        Button { binding.wrappedValue.remove(at: index) } label: {
                            Image(systemName: "minus.circle.fill").foregroundStyle(Theme.destructive.opacity(0.7))
                        }
                        .buttonStyle(.plain)
                    }
                }
                Button { binding.wrappedValue.append("") } label: {
                    Label("Add", systemImage: "plus.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(tint)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Bindings

    private func optionalBinding(_ keyPath: WritableKeyPath<MeetingNote, [String]?>) -> Binding<[String]> {
        Binding(
            get: { draft[keyPath: keyPath] ?? [] },
            set: { draft[keyPath: keyPath] = $0 }
        )
    }

    private func actionBinding(_ index: Int, _ field: WritableKeyPath<NoteAction, String>) -> Binding<String> {
        Binding(
            get: { index < (draft.actionItems?.count ?? 0) ? draft.actionItems![index][keyPath: field] : "" },
            set: { if index < (draft.actionItems?.count ?? 0) { draft.actionItems![index][keyPath: field] = $0 } }
        )
    }

    private func actionBinding(_ index: Int, _ field: WritableKeyPath<NoteAction, String?>) -> Binding<String> {
        Binding(
            get: { index < (draft.actionItems?.count ?? 0) ? (draft.actionItems![index][keyPath: field] ?? "") : "" },
            set: { if index < (draft.actionItems?.count ?? 0) { draft.actionItems![index][keyPath: field] = $0.isEmpty ? nil : $0 } }
        )
    }

    private func followUpBinding(_ index: Int, _ field: WritableKeyPath<NoteFollowUp, String>) -> Binding<String> {
        Binding(
            get: { index < (draft.followUps?.count ?? 0) ? draft.followUps![index][keyPath: field] : "" },
            set: { if index < (draft.followUps?.count ?? 0) { draft.followUps![index][keyPath: field] = $0 } }
        )
    }

    private func followUpBinding(_ index: Int, _ field: WritableKeyPath<NoteFollowUp, String?>) -> Binding<String> {
        Binding(
            get: { index < (draft.followUps?.count ?? 0) ? (draft.followUps![index][keyPath: field] ?? "") : "" },
            set: { if index < (draft.followUps?.count ?? 0) { draft.followUps![index][keyPath: field] = $0.isEmpty ? nil : $0 } }
        )
    }

    // MARK: - Helpers

    private func priorityColor(_ priority: String) -> Color {
        switch priority.lowercased() {
        case "high", "urgent": return Theme.destructive
        case "medium": return Theme.warning
        default: return Theme.success
        }
    }

    private func iconName(_ icon: String?) -> String {
        switch icon ?? "" {
        case "help-circle": return "questionmark.circle.fill"
        case "smile": return "face.smiling.fill"
        case "meh": return "face.dashed.fill"
        case "frown": return "face.smiling"
        case "zap": return "bolt.fill"
        case "bar-chart": return "chart.bar.fill"
        default: return "chart.bar.fill"
        }
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first }.map(String.init).joined().uppercased()
    }

    // MARK: - Actions

    private func link(_ contact: Contact, createTasks: Bool) async {
        isLinking = true
        defer { isLinking = false }
        if let participant = await data.linkContact(contact, toNote: note, createTasks: createTasks) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            participants.append(participant)
        }
    }

    private func unlink(_ participant: MeetingParticipant) async {
        await data.unlinkParticipant(participant)
        participants.removeAll { $0.id == participant.id }
    }

    private func autoEnhanceIfNeeded() async {
        guard !didAutoEnhance else { return }
        didAutoEnhance = true
        guard draft.hasContent, !draft.hasInsights else { return }
        try? await Task.sleep(for: .milliseconds(500))
        await reanalyze()
    }

    private func reanalyze() async {
        guard !isAnalyzing else { return }
        isAnalyzing = true
        defer { isAnalyzing = false }
        if let updated = await data.reanalyzeNote(draft, templateId: template.id == NoteTemplate.default.id ? nil : template.id) {
            withAnimation(.easeOut(duration: 0.25)) { draft = updated }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private func toggleAction(_ index: Int) async {
        guard index < (draft.actionItems?.count ?? 0) else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            draft.actionItems?[index].done = !(draft.actionItems?[index].isDone ?? false)
        }
        await data.updateNote(draft)
    }

    private func copyToClipboard() {
        UIPasteboard.general.string = NoteExport.markdown(draft)
        copied = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func generateShareLink() async {
        guard !generatingShareLink else { return }
        generatingShareLink = true
        defer { generatingShareLink = false }
        if let url = await data.generateShareLink(for: note.id) {
            UIPasteboard.general.string = url.absoluteString
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            shareURL = url
        }
    }

    private func save() async {
        isSaving = true
        draft.actionItems = draft.actionItems?.filter { !$0.task.trimmingCharacters(in: .whitespaces).isEmpty }
        draft.followUps = draft.followUps?.filter { !$0.description.trimmingCharacters(in: .whitespaces).isEmpty }
        draft.decisions = draft.decisions?.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        draft.keyTopics = draft.keyTopics?.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        if draft.summary?.trimmingCharacters(in: .whitespaces).isEmpty == true { draft.summary = nil }
        await data.updateNote(draft)
        isSaving = false
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { isEditing = false }
    }
}

/// A simple wrapping chip row used for topics and talk-time legends.
private struct FlowChips: View {
    let items: [String]

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.primary)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Theme.primary.opacity(0.1), in: Capsule())
            }
        }
    }
}

/// Minimal wrapping flow layout for chips.
private struct FlowLayout: Layout {
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
