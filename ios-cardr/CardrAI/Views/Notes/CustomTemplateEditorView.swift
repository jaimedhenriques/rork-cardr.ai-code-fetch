import SwiftUI

/// Create a custom meeting-note template — name it, pick an emoji, and define
/// the sections the AI should extract (mirrors the web template editor).
struct CustomTemplateEditorView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    /// Called with the newly created template.
    var onCreated: ((CustomNoteTemplate) -> Void)?

    @State private var name = ""
    @State private var emoji = "📝"
    @State private var descriptionText = ""
    @State private var guidance = ""
    @State private var sections: [EditableSection] = [EditableSection()]
    @State private var isSaving = false
    @State private var errorMessage: String?

    private struct EditableSection: Identifiable {
        let id = UUID()
        var label = ""
        var detail = ""
        var isText = false
    }

    private let emojiChoices = ["📝", "🎤", "🧠", "🤝", "🎓", "🩺", "⚖️", "🏗️", "💼", "🔬", "🎨", "🚀"]

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && (sections.contains { !$0.label.trimmingCharacters(in: .whitespaces).isEmpty }
                || !guidance.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Template") {
                    TextField("Name (e.g. Job Interview)", text: $name)
                    TextField("Short description (optional)", text: $descriptionText)
                    emojiRow
                }

                Section {
                    ForEach($sections) { $section in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                TextField("Section name (e.g. Red flags)", text: $section.label)
                                    .font(.subheadline.weight(.semibold))
                                Picker("", selection: $section.isText) {
                                    Text("List").tag(false)
                                    Text("Text").tag(true)
                                }
                                .pickerStyle(.menu)
                                .labelsHidden()
                                .fixedSize()
                            }
                            TextField("What the AI should look for (optional)", text: $section.detail)
                                .font(.caption)
                        }
                        .padding(.vertical, 2)
                    }
                    .onDelete { offsets in
                        sections.remove(atOffsets: offsets)
                        if sections.isEmpty { sections = [EditableSection()] }
                    }
                    if sections.count < 12 {
                        Button {
                            sections.append(EditableSection())
                        } label: {
                            Label("Add section", systemImage: "plus")
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                } header: {
                    Text("What should the AI extract?")
                } footer: {
                    Text("Each section becomes a card on the note. Lists collect multiple points; Text gives a single written answer.")
                }

                Section {
                    TextField("e.g. Keep a neutral tone, focus on the candidate's answers…", text: $guidance, axis: .vertical)
                        .lineLimit(3...5)
                } header: {
                    Text("Extra instructions (optional)")
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            .navigationTitle("New Template")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Create") { Task { await save() } }
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private var emojiRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(emojiChoices, id: \.self) { choice in
                    Button {
                        emoji = choice
                    } label: {
                        Text(choice)
                            .font(.system(size: 20))
                            .frame(width: 38, height: 38)
                            .background(
                                emoji == choice ? Theme.primary.opacity(0.15) : Theme.surfaceMuted,
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(emoji == choice ? Theme.primary.opacity(0.5) : .clear, lineWidth: 1.5)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func save() async {
        guard canSave, !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        errorMessage = nil

        var fields: [CustomTemplateField] = []
        var usedKeys = Set<String>()
        for section in sections {
            let label = section.label.trimmingCharacters(in: .whitespaces)
            guard !label.isEmpty else { continue }
            var key = CustomNoteTemplate.makeKey(from: label)
            guard !key.isEmpty else { continue }
            while usedKeys.contains(key) { key = String("\(key)2".prefix(40)) }
            usedKeys.insert(key)
            fields.append(CustomTemplateField(
                key: key,
                label: label,
                description: section.detail.trimmingCharacters(in: .whitespaces),
                type: section.isText ? "text" : "list"
            ))
        }

        if let created = await data.createCustomTemplate(
            name: name.trimmingCharacters(in: .whitespaces),
            emoji: emoji,
            description: descriptionText.trimmingCharacters(in: .whitespaces),
            fields: fields,
            guidance: guidance.trimmingCharacters(in: .whitespaces)
        ) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onCreated?(created)
            dismiss()
        } else {
            errorMessage = "Could not create the template. Please try again."
        }
    }
}
