import SwiftUI

/// A sheet for picking, creating, and toggling tags on a note.
/// Mirrors the web `NoteTagPicker`.
struct NoteTagPickerView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    let noteId: String

    @State private var showCreate = false
    @State private var newName = ""
    @State private var newColorIndex = 0

    private var currentTagIds: Set<String> {
        Set(data.noteTags.filter { $0.noteId == noteId }.map(\.tagId))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if data.tags.isEmpty {
                        Text("No tags yet. Create one below.")
                            .foregroundStyle(Theme.inkSecondary)
                            .font(.subheadline)
                    }
                    ForEach(data.tags) { tag in
                        Button {
                            Task { await data.toggleNoteTag(tag, on: noteId) }
                        } label: {
                            HStack(spacing: 10) {
                                Circle()
                                    .fill(Color(hex: tag.hexValue))
                                    .frame(width: 12, height: 12)
                                Text(tag.name)
                                    .foregroundStyle(Theme.ink)
                                Spacer()
                                if currentTagIds.contains(tag.id) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.primary)
                                }
                            }
                        }
                    }
                }

                Section {
                    Button {
                        showCreate = true
                    } label: {
                        Label("New tag", systemImage: "tag")
                            .foregroundStyle(Theme.primary)
                    }
                }
            }
            .navigationTitle("Tags")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("New Tag", isPresented: $showCreate) {
                TextField("Name", text: $newName)
                Button("Create") {
                    let trimmed = newName.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { return }
                    let color = TagDefaults.color(forIndex: newColorIndex)
                    newColorIndex += 1
                    Task {
                        if let tag = await data.addTag(name: trimmed, color: color) {
                            await data.toggleNoteTag(tag, on: noteId)
                        }
                        newName = ""
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Enter a name for the new tag.")
            }
        }
    }
}
