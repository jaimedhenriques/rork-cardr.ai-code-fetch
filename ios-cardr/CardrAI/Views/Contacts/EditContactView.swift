import SwiftUI

/// Edit an existing contact's details and sync the changes to Supabase.
struct EditContactView: View {
    let contact: Contact
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var draft: ContactDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(contact: Contact) {
        self.contact = contact
        _draft = State(initialValue: ContactDraft(from: contact))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    field("Full name", text: $draft.name, icon: "person", capitalization: .words)
                }

                Section("Work") {
                    field("Title", text: $draft.title, icon: "briefcase", capitalization: .words)
                    field("Company", text: $draft.company, icon: "building.2", capitalization: .words)
                    field("Industry / location", text: $draft.location, icon: "mappin.and.ellipse", capitalization: .words)
                }

                Section("Contact") {
                    field("Email", text: $draft.email, icon: "envelope", keyboard: .emailAddress)
                    field("Phone", text: $draft.phone, icon: "phone", keyboard: .phonePad)
                    field("Mobile", text: $draft.mobilePhone, icon: "iphone", keyboard: .phonePad)
                    field("Website", text: $draft.website, icon: "globe", keyboard: .URL)
                    field("LinkedIn", text: $draft.linkedin, icon: "link", keyboard: .URL)
                }

                Section("Notes") {
                    TextField("Where you met, follow-ups…", text: $draft.notes, axis: .vertical)
                        .lineLimit(3...6)
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            .navigationTitle("Edit Contact")
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
                            .disabled(!draft.isValid)
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
                .autocorrectionDisabled(keyboard == .emailAddress || keyboard == .URL)
        }
    }

    private func save() {
        errorMessage = nil
        isSaving = true
        Task {
            let success = await data.updateContact(contact, with: draft)
            isSaving = false
            if success {
                dismiss()
            } else {
                errorMessage = data.loadError ?? "Could not save changes. Please try again."
            }
        }
    }
}
