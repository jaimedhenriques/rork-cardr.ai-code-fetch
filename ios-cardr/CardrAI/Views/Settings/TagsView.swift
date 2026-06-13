import SwiftUI

/// Native tag manager mirroring the web tags flow — create, rename, recolor,
/// and delete the labels used to organise contacts and notes.
struct TagsView: View {
    @Environment(DataStore.self) private var data

    @State private var newName = ""
    @State private var selectedColor = TagDefaults.palette[0]
    @State private var editingTag: Tag?
    @State private var tagToDelete: Tag?

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                createCard
                if data.tags.isEmpty {
                    emptyState
                } else {
                    tagList
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Tags")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editingTag) { tag in
            EditTagSheet(tag: tag)
        }
        .confirmationDialog(
            "Delete this tag?",
            isPresented: Binding(get: { tagToDelete != nil }, set: { if !$0 { tagToDelete = nil } }),
            titleVisibility: .visible
        ) {
            if let tag = tagToDelete {
                Button("Delete \"\(tag.name)\"", role: .destructive) {
                    Task { await data.deleteTag(tag) }
                    tagToDelete = nil
                }
            }
            Button("Cancel", role: .cancel) { tagToDelete = nil }
        } message: {
            if let tag = tagToDelete {
                Text("It will be removed from \(data.usageCount(for: tag)) contact(s).")
            }
        }
        .task { if data.tags.isEmpty { await data.loadTags() } }
    }

    // MARK: - Create

    private var createCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("New tag")
                .font(.system(size: 11, weight: .bold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(Theme.primary)

            HStack(spacing: 10) {
                Circle()
                    .fill(Color(hex: String(selectedColor.dropFirst())))
                    .frame(width: 18, height: 18)
                TextField("Tag name", text: $newName)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                    .submitLabel(.done)
                    .onSubmit(create)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Theme.surfaceMuted)
            .clipShape(.rect(cornerRadius: 12))

            colorPicker(selection: $selectedColor)

            Button(action: create) {
                Text("Add tag")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(canCreate ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.surfaceMuted))
                    .clipShape(.rect(cornerRadius: 12))
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(!canCreate)
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.border, lineWidth: 1)
        )
        .shadow(color: Theme.ink.opacity(0.04), radius: 10, y: 5)
    }

    private var canCreate: Bool {
        !newName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func create() {
        guard canCreate else { return }
        let name = newName
        let color = selectedColor
        Task { await data.addTag(name: name, color: color) }
        newName = ""
        selectedColor = TagDefaults.color(forIndex: data.tags.count + 1)
    }

    // MARK: - List

    private var tagList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your tags")
                .font(.system(size: 11, weight: .bold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(Theme.primary)
                .padding(.leading, 4)

            VStack(spacing: 0) {
                ForEach(data.tags) { tag in
                    tagRow(tag)
                    if tag.id != data.tags.last?.id {
                        Divider().background(Theme.border).padding(.leading, 44)
                    }
                }
            }
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: Theme.cardRadius))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cardRadius)
                    .stroke(Theme.border, lineWidth: 1)
            )
            .shadow(color: Theme.ink.opacity(0.04), radius: 10, y: 5)
        }
    }

    private func tagRow(_ tag: Tag) -> some View {
        let count = data.usageCount(for: tag)
        return HStack(spacing: 12) {
            Circle()
                .fill(Color(hex: tag.hexValue))
                .frame(width: 14, height: 14)
            Text(tag.name)
                .font(.system(size: 15))
                .foregroundStyle(Theme.ink)
            Spacer(minLength: 8)
            Text("\(count)")
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Theme.inkSecondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Theme.surfaceMuted)
                .clipShape(Capsule())
            Button { editingTag = tag } label: {
                Image(systemName: "pencil")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Button { tagToDelete = tag } label: {
                Image(systemName: "trash")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.destructive)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "tag")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text("No tags yet")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text("Create tags to organise your contacts and notes.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

/// Reusable color swatch row used to pick a tag color.
private func colorPicker(selection: Binding<String>) -> some View {
    HStack(spacing: 10) {
        ForEach(TagDefaults.palette, id: \.self) { hex in
            let color = Color(hex: String(hex.dropFirst()))
            Button { selection.wrappedValue = hex } label: {
                Circle()
                    .fill(color)
                    .frame(width: 26, height: 26)
                    .overlay(
                        Circle().stroke(Theme.ink, lineWidth: selection.wrappedValue == hex ? 2.5 : 0)
                    )
            }
            .buttonStyle(.plain)
        }
    }
}

/// Sheet to rename and recolor an existing tag.
private struct EditTagSheet: View {
    let tag: Tag
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var color: String

    init(tag: Tag) {
        self.tag = tag
        _name = State(initialValue: tag.name)
        _color = State(initialValue: tag.color?.isEmpty == false ? tag.color! : TagDefaults.palette[0])
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(Color(hex: String(color.dropFirst())))
                            .frame(width: 18, height: 18)
                        TextField("Tag name", text: $name)
                            .textFieldStyle(.plain)
                            .font(.system(size: 15))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Theme.surfaceMuted)
                    .clipShape(.rect(cornerRadius: 12))

                    Text("Color")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    colorPicker(selection: $color)
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Edit Tag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        let newName = name
                        let newColor = color
                        Task { await data.updateTag(tag, name: newName, color: newColor) }
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
