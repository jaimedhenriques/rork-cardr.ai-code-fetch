import SwiftUI

/// A sheet for picking or clearing a note's category.
/// Mirrors the web `NoteCategoryPicker`.
struct NoteCategoryPickerView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    let noteId: String
    let currentCategory: String?

    @State private var newCategory = ""

    private var availableCategories: [String] {
        Array(Set(data.notes.compactMap { $0.category?.isEmpty == false ? $0.category : nil }))
            .sorted()
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        Task { await data.setCategory(nil, on: noteId); dismiss() }
                    } label: {
                        HRow(icon: "tray", label: "No category", selected: currentCategory == nil)
                    }
                }

                if !availableCategories.isEmpty {
                    Section("Existing") {
                        ForEach(availableCategories, id: \.self) { category in
                            Button {
                                Task { await data.setCategory(category, on: noteId); dismiss() }
                            } label: {
                                HRow(icon: "tag.fill", label: category, selected: currentCategory == category)
                            }
                        }
                    }
                }

                Section {
                    HStack {
                        TextField("New category", text: $newCategory)
                        Button("Add") {
                            let trimmed = newCategory.trimmingCharacters(in: .whitespaces)
                            guard !trimmed.isEmpty else { return }
                            Task { await data.setCategory(trimmed, on: noteId); dismiss() }
                        }
                        .disabled(newCategory.trimmingCharacters(in: .whitespaces).isEmpty)
                        .fontWeight(.semibold)
                    }
                }
            }
            .navigationTitle("Category")
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
