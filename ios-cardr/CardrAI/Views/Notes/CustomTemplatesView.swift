import SwiftUI

/// Manage user-defined meeting-note templates — list, create, and delete.
/// Presented from the note composer's template picker.
struct CustomTemplatesView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    /// Called when the user taps a template to use it right away.
    var onSelect: ((CustomNoteTemplate) -> Void)?

    @State private var showEditor = false

    var body: some View {
        NavigationStack {
            Group {
                if data.customTemplates.isEmpty {
                    emptyState
                } else {
                    templateList
                }
            }
            .background(Theme.background)
            .navigationTitle("My Templates")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showEditor = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showEditor) {
                CustomTemplateEditorView { created in
                    onSelect?(created)
                }
            }
        }
    }

    private var templateList: some View {
        List {
            Section {
                ForEach(data.customTemplates) { template in
                    Button {
                        onSelect?(template)
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Text(template.displayEmoji)
                                .font(.system(size: 22))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(template.name)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.ink)
                                Text(template.summary)
                                    .font(.caption)
                                    .foregroundStyle(Theme.inkSecondary)
                                    .lineLimit(2)
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
                .onDelete { offsets in
                    let targets = offsets.map { data.customTemplates[$0] }
                    Task {
                        for template in targets {
                            await data.deleteCustomTemplate(template)
                        }
                    }
                }
            } footer: {
                Text("Templates tell the AI exactly what to extract from your meetings. Tap one to use it for the next analysis.")
            }
        }
        .scrollContentBackground(.hidden)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "square.grid.2x2")
                .font(.system(size: 36, weight: .medium))
                .foregroundStyle(Theme.inkSecondary)
            Text("No custom templates yet")
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text("Create your own meeting type — like Job Interview or Investor Call — and tell the AI exactly what to pull out of the conversation.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button {
                showEditor = true
            } label: {
                Label("New template", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
