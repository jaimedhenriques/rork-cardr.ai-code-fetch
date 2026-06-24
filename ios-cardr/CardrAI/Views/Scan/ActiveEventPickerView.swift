import SwiftUI

/// Lets the user choose which event new scans are auto-assigned to.
struct ActiveEventPickerView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    row(title: "No active event", subtitle: "Scans go straight to contacts",
                        isSelected: data.activeEventId == nil) {
                        data.activeEventId = nil
                        dismiss()
                    }
                }

                if data.events.isEmpty {
                    Section {
                        Text("No events yet. Create one from the Events tab to group your scans.")
                            .font(.footnote)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                } else {
                    Section("Your events") {
                        ForEach(data.events) { event in
                            row(title: event.title, subtitle: event.formattedDate,
                                isSelected: data.activeEventId == event.id) {
                                data.activeEventId = event.id
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle("Active event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func row(title: String, subtitle: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.primary)
                }
            }
        }
    }
}
