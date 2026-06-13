import SwiftUI

struct NotesView: View {
    @Environment(DataStore.self) private var data
    @State private var showComposer = false
    @State private var query = ""

    private var filteredNotes: [MeetingNote] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return data.notes }
        return data.notes.filter { note in
            let haystack = [
                note.title,
                note.summary ?? "",
                note.transcript ?? "",
                note.manualNotes ?? "",
                (note.keyTopics ?? []).joined(separator: " "),
                (note.actionItems ?? []).joined(separator: " "),
            ].joined(separator: " ")
            return haystack.localizedCaseInsensitiveContains(trimmed)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if data.isLoadingNotes && data.notes.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if data.notes.isEmpty {
                    emptyState
                } else if filteredNotes.isEmpty {
                    noResultsState
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(filteredNotes) { note in
                                NavigationLink(value: note) { NoteRow(note: note, query: query) }
                                    .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                }
            }
            .background(Theme.background)
            .navigationTitle("Notes")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search notes, summaries, transcripts")
            .navigationDestination(for: MeetingNote.self) { NoteDetailView(note: $0) }
            .refreshable { await data.loadNotes() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    DrawerMenuButton()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showComposer = true } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showComposer) {
                NoteComposerView()
            }
            .overlay(alignment: .bottomTrailing) {
                if !data.notes.isEmpty {
                    Button { showComposer = true } label: {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 60, height: 60)
                            .background(Theme.brandGradient)
                            .clipShape(Circle())
                            .shadow(color: Theme.primary.opacity(0.4), radius: 14, y: 6)
                    }
                    .buttonStyle(PressableButtonStyle())
                    .padding(.trailing, 20)
                    .padding(.bottom, 24)
                }
            }
        }
    }

    private var noResultsState: some View {
        VStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.largeTitle)
                .foregroundStyle(Theme.inkSecondary)
            Text("No matching notes")
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text("Try a different search term.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "note.text")
                .font(.largeTitle)
                .foregroundStyle(Theme.inkSecondary)
            Text("No notes yet")
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text("Your meeting notes and summaries appear here.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
            Button { showComposer = true } label: {
                Label("New note", systemImage: "plus")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Theme.brandGradient)
                    .clipShape(Capsule())
            }
            .buttonStyle(PressableButtonStyle())
            .padding(.top, 8)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}

private struct NoteRow: View {
    let note: MeetingNote
    var query: String = ""

    var body: some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(note.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Spacer()
                    if let duration = note.durationLabel {
                        Text(duration)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.primary)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Theme.primary.opacity(0.1))
                            .clipShape(.capsule)
                    }
                }
                if let summary = note.summary, !summary.isEmpty {
                    Text(summary)
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(2)
                }
                if let topics = note.keyTopics, !topics.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(topics.prefix(3), id: \.self) { topic in
                            Text(topic)
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(Theme.inkSecondary)
                                .padding(.horizontal, 7).padding(.vertical, 2)
                                .background(Theme.surfaceMuted)
                                .clipShape(.capsule)
                        }
                    }
                }
            }
        }
    }
}
