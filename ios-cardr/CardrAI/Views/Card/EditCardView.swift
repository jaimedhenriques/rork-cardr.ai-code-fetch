import SwiftUI

/// Edit the signed-in user's own digital card (their profile).
struct EditCardView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var draft: ProfileDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(profile: Profile?) {
        _draft = State(initialValue: ProfileDraft(from: profile))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    field("Full name", text: $draft.name, icon: "person", capitalization: .words)
                    field("Title", text: $draft.title, icon: "briefcase", capitalization: .words)
                    field("Company", text: $draft.company, icon: "building.2", capitalization: .words)
                }

                Section("Contact") {
                    field("Phone", text: $draft.phone, icon: "phone", keyboard: .phonePad)
                    field("Website", text: $draft.website, icon: "globe", keyboard: .URL)
                    field("LinkedIn", text: $draft.linkedin, icon: "link", keyboard: .URL)
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            .navigationTitle("Edit Card")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Save", action: save)
                            .fontWeight(.semibold)
                    }
                }
            }
        }
    }

    private func field(
        _ placeholder: String,
        text: Binding<String>,
        icon: String,
        keyboard: UIKeyboardType = .default,
        capitalization: TextInputAutocapitalization = .never
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Theme.inkSecondary)
                .frame(width: 22)
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .textInputAutocapitalization(capitalization)
                .autocorrectionDisabled(keyboard == .URL)
        }
    }

    private func save() {
        errorMessage = nil
        isSaving = true
        Task {
            let success = await data.updateProfile(draft)
            isSaving = false
            if success {
                dismiss()
            } else {
                errorMessage = data.loadError ?? "Could not save your card. Please try again."
            }
        }
    }
}
