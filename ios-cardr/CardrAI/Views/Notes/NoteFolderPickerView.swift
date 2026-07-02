import SwiftUI

/// A sheet for picking, creating, and assigning a folder to a note.
/// Mirrors the web `NoteFolderPicker`.
struct NoteFolderPickerView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    let noteId: String
    let currentFolderId: String?

    @State private var showCreate = false
    @State private var newName = ""
    @State private var newEmoji = "📁"

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        Task { await data.setFolder(nil, on: noteId); dismiss() }
                    } label: {
                        HStack {
                            Image(systemName: "tray")
                                .foregroundStyle(Theme.inkSecondary)
                            Text("No folder")
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            if currentFolderId == nil {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Theme.primary)
                            }
                        }
                    }
                }

                Section("Folders") {
                    ForEach(data.folders) { folder in
                        Button {
                            Task { await data.setFolder(folder, on: noteId); dismiss() }
                        } label: {
                            HStack {
                                Text(folder.emoji ?? "📁")
                                Text(folder.name)
                                    .foregroundStyle(Theme.ink)
                                Spacer()
                                if folder.id == currentFolderId {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.primary)
                                }
                            }
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            Task { await data.deleteFolder(data.folders[index]) }
                        }
                    }
                }

                Section {
                    Button {
                        showCreate = true
                    } label: {
                        Label("New folder", systemImage: "folder.badge.plus")
                            .foregroundStyle(Theme.primary)
                    }
                }
            }
            .navigationTitle("Folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("New Folder", isPresented: $showCreate) {
                TextField("Name", text: $newName)
                TextField("Emoji", text: $newEmoji)
                    .textInputAutocapitalization(.never)
                Button("Create") {
                    let trimmed = newName.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { return }
                    let emoji = newEmoji.trimmingCharacters(in: .whitespaces)
                    Task {
                        if let folder = await data.addFolder(name: trimmed, emoji: emoji.isEmpty ? "📁" : emoji) {
                            await data.setFolder(folder, on: noteId)
                        }
                        newName = ""
                        newEmoji = "📁"
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Enter a name and an optional emoji for the folder.")
            }
        }
    }
}
