import SwiftUI

/// Surfaces likely-duplicate contacts (same email or name) so the user can
/// review and clean them up — mirrors the web `DuplicateDetector`.
struct DuplicatesView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    private var groups: [[Contact]] { data.duplicateGroups() }

    var body: some View {
        NavigationStack {
            Group {
                if groups.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("\(groups.count) possible duplicate group\(groups.count == 1 ? "" : "s")")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.inkSecondary)
                            ForEach(Array(groups.enumerated()), id: \.offset) { _, group in
                                groupCard(group)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                }
            }
            .background(Theme.background)
            .navigationTitle("Duplicates")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }

    private func groupCard(_ group: [Contact]) -> some View {
        CardSurface {
            VStack(spacing: 0) {
                ForEach(Array(group.enumerated()), id: \.element.id) { index, contact in
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(Theme.brandGradient.opacity(0.15))
                            Text(contact.initials)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Theme.primary)
                        }
                        .frame(width: 40, height: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(contact.name)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.ink)
                            Text(contact.email ?? contact.subtitle)
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.inkSecondary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        if index == 0 {
                            Text("Keep")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.success)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Theme.success.opacity(0.14))
                                .clipShape(Capsule())
                        } else {
                            Button {
                                Task { await data.deleteContact(contact) }
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Theme.destructive)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 8)
                    if index < group.count - 1 {
                        Divider().background(Theme.border)
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 36))
                .foregroundStyle(Theme.success)
            Text("No duplicates found")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text("Your contacts look clean — no matching names or emails.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// A sheet to apply a single tag to many selected contacts at once.
struct BulkTagPicker: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    let contactIDs: Set<String>
    let onDone: () -> Void

    @State private var newName = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Apply a tag to \(contactIDs.count) contact\(contactIDs.count == 1 ? "" : "s")")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary)

                    HStack(spacing: 8) {
                        TextField("New tag", text: $newName)
                            .textFieldStyle(.plain)
                            .font(.system(size: 15))
                            .submitLabel(.done)
                            .onSubmit(createAndApply)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Theme.surfaceMuted)
                            .clipShape(.rect(cornerRadius: 12))
                        Button(action: createAndApply) {
                            Image(systemName: "plus")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 44, height: 44)
                                .background(canCreate ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.surfaceMuted))
                                .clipShape(.rect(cornerRadius: 12))
                        }
                        .buttonStyle(PressableButtonStyle())
                        .disabled(!canCreate)
                    }

                    if data.tags.isEmpty {
                        Text("No tags yet — create one above.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.inkSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(data.tags) { tag in
                                Button {
                                    let ids = contactIDs
                                    Task { await data.applyTag(tag, to: ids) }
                                    dismiss()
                                    onDone()
                                } label: {
                                    HStack(spacing: 12) {
                                        Circle().fill(Color(hex: tag.hexValue)).frame(width: 14, height: 14)
                                        Text(tag.name).font(.system(size: 15)).foregroundStyle(Theme.ink)
                                        Spacer()
                                        Image(systemName: "plus.circle")
                                            .foregroundStyle(Theme.primary)
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 13)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                if tag.id != data.tags.last?.id {
                                    Divider().background(Theme.border).padding(.leading, 38)
                                }
                            }
                        }
                        .background(Theme.surface)
                        .clipShape(.rect(cornerRadius: Theme.cardRadius))
                        .overlay(RoundedRectangle(cornerRadius: Theme.cardRadius).stroke(Theme.border, lineWidth: 1))
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Tag contacts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var canCreate: Bool {
        !newName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func createAndApply() {
        guard canCreate else { return }
        let name = newName
        let color = TagDefaults.color(forIndex: data.tags.count)
        let ids = contactIDs
        Task {
            if let tag = await data.addTag(name: name, color: color) {
                await data.applyTag(tag, to: ids)
            }
        }
        newName = ""
        dismiss()
        onDone()
    }
}
