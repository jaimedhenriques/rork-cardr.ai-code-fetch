import SwiftUI

/// Filter & sort sheet for the notes hub — mirrors the web `NoteFilters`.
struct NoteFiltersView: View {
    @Environment(DataStore.self) private var data
    @Binding var filters: NoteFilterState
    let categories: [String]
    @Environment(\.dismiss) private var dismiss

    @State private var working = NoteFilterState()

    var body: some View {
        NavigationStack {
            Form {
                Section("Sort by") {
                    ForEach(NoteSortOption.allCases) { option in
                        Button {
                            working.sortBy = option
                        } label: {
                            HStack {
                                Text(option.label).foregroundStyle(Theme.ink)
                                Spacer()
                                if working.sortBy == option {
                                    Image(systemName: "checkmark").foregroundStyle(Theme.primary)
                                }
                            }
                        }
                    }
                }

                Section("Quick filters") {
                    Toggle("Has open action items", isOn: $working.hasActions)
                        .tint(Theme.primary)
                }

                if !categories.isEmpty {
                    Section("Categories") {
                        ForEach(categories, id: \.self) { category in
                            Button {
                                if working.categories.contains(category) {
                                    working.categories.remove(category)
                                } else {
                                    working.categories.insert(category)
                                }
                            } label: {
                                HStack {
                                    Text(category).foregroundStyle(Theme.ink)
                                    Spacer()
                                    if working.categories.contains(category) {
                                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.primary)
                                    }
                                }
                            }
                        }
                    }
                }

                if !data.folders.isEmpty {
                    Section("Folders") {
                        ForEach(data.folders) { folder in
                            Button {
                                if working.folderIds.contains(folder.id) {
                                    working.folderIds.remove(folder.id)
                                } else {
                                    working.folderIds.insert(folder.id)
                                }
                            } label: {
                                HStack {
                                    Text(folder.emoji ?? "📁")
                                    Text(folder.name).foregroundStyle(Theme.ink)
                                    Spacer()
                                    if working.folderIds.contains(folder.id) {
                                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.primary)
                                    }
                                }
                            }
                        }
                    }
                }

                if !data.tags.isEmpty {
                    Section("Tags") {
                        ForEach(data.tags) { tag in
                            Button {
                                if working.tagIds.contains(tag.id) {
                                    working.tagIds.remove(tag.id)
                                } else {
                                    working.tagIds.insert(tag.id)
                                }
                            } label: {
                                HStack(spacing: 10) {
                                    Circle()
                                        .fill(Color(hex: tag.hexValue))
                                        .frame(width: 12, height: 12)
                                    Text(tag.name).foregroundStyle(Theme.ink)
                                    Spacer()
                                    if working.tagIds.contains(tag.id) {
                                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.primary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reset") { working = NoteFilterState() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Apply") {
                        filters = working
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .onAppear { working = filters }
        }
    }
}
