import SwiftUI

/// A sheet for linking a meeting note to a calendar event.
/// Mirrors the web `NoteEventLinker`.
struct NoteEventLinkerView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    let noteId: String
    let currentEventId: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        Task { await data.clearNoteEvent(noteId); dismiss() }
                    } label: {
                        HRow(icon: "tray", label: "No event", selected: currentEventId == nil)
                    }
                }

                if !data.events.isEmpty {
                    Section("Events") {
                        ForEach(data.events) { event in
                            Button {
                                Task { await data.linkNoteEvent(event, noteId: noteId); dismiss() }
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: "calendar")
                                        .foregroundStyle(Theme.inkSecondary)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(event.title)
                                            .font(.subheadline.weight(.medium))
                                            .foregroundStyle(Theme.ink)
                                        if let date = event.startsAt {
                                            Text(date.formatted(date: .abbreviated, time: .shortened))
                                                .font(.caption2)
                                                .foregroundStyle(Theme.inkSecondary)
                                        }
                                    }
                                    Spacer()
                                    if event.id == currentEventId {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(Theme.primary)
                                    }
                                }
                            }
                        }
                    }
                } else {
                    Section {
                        Text("No events yet. Create one from the Events tab.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }
            }
            .navigationTitle("Link Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func HRow(icon: String, label: String, selected: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(Theme.inkSecondary)
            Text(label)
                .foregroundStyle(Theme.ink)
            Spacer()
            if selected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Theme.primary)
            }
        }
    }
}
