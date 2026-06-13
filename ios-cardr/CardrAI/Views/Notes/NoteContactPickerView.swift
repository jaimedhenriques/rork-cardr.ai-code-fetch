import SwiftUI

/// A searchable contact picker used to link a meeting note to a CRM contact.
/// Optionally creates follow-up tasks from the note's action items.
struct NoteContactPickerView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    let linkedContactIds: Set<String>
    let hasActionItems: Bool
    let onLink: (Contact, Bool) async -> Void

    @State private var search = ""
    @State private var createTasks = true
    @State private var linkingId: String?

    private var results: [Contact] {
        let trimmed = search.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return data.contacts }
        return data.contacts.filter {
            $0.name.localizedCaseInsensitiveContains(trimmed)
                || ($0.company?.localizedCaseInsensitiveContains(trimmed) ?? false)
                || ($0.email?.localizedCaseInsensitiveContains(trimmed) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if hasActionItems {
                    Section {
                        Toggle(isOn: $createTasks) {
                            Label("Create follow-up tasks", systemImage: "checklist")
                        }
                        .tint(Theme.primary)
                    } footer: {
                        Text("Adds each action item to the linked contact's activity in your CRM.")
                    }
                }

                Section {
                    if results.isEmpty {
                        Text(search.isEmpty ? "No contacts yet." : "No contacts match '\(search)'.")
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    ForEach(results) { contact in
                        let isLinked = linkedContactIds.contains(contact.id)
                        Button {
                            Task {
                                linkingId = contact.id
                                await onLink(contact, createTasks)
                                linkingId = nil
                                dismiss()
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Theme.primary.opacity(0.12))
                                    .frame(width: 36, height: 36)
                                    .overlay(
                                        Text(contact.initials)
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(Theme.primary)
                                    )
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(contact.name)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Theme.ink)
                                    if !contact.subtitle.isEmpty {
                                        Text(contact.subtitle)
                                            .font(.caption)
                                            .foregroundStyle(Theme.inkSecondary)
                                    }
                                }
                                Spacer()
                                if linkingId == contact.id {
                                    ProgressView().controlSize(.small)
                                } else if isLinked {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.success)
                                }
                            }
                        }
                        .disabled(isLinked || linkingId != nil)
                    }
                }
            }
            .navigationTitle("Link contact")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Search contacts")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
