import SwiftUI

/// Bottom sheet of advanced contact filters, mirroring the web `ContactFilters`.
struct ContactFilterSheet: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss
    @Binding var filter: ContactFilter

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    enrichmentSection
                    toggleSection
                    if !data.leadSources.isEmpty { sourceSection }
                    if !data.events.isEmpty { eventSection }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reset") { filter = ContactFilter() }
                        .disabled(!filter.isActive)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .tracking(1.2)
            .foregroundStyle(Theme.inkSecondary)
    }

    private var enrichmentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Enrichment")
            HStack(spacing: 8) {
                ForEach(ContactFilter.Enrichment.allCases) { option in
                    let active = filter.enrichment == option
                    Button { filter.enrichment = option } label: {
                        Text(option.rawValue)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(active ? .white : Theme.inkSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(active ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.surfaceMuted))
                            .clipShape(.rect(cornerRadius: 11))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var toggleSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Details")
            VStack(spacing: 0) {
                toggleRow("Has email", systemImage: "envelope", isOn: $filter.hasEmail)
                Divider().background(Theme.border).padding(.leading, 38)
                toggleRow("Has phone", systemImage: "phone", isOn: $filter.hasPhone)
                Divider().background(Theme.border).padding(.leading, 38)
                toggleRow("Missing contact info", systemImage: "exclamationmark.circle", isOn: $filter.missingInfo)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 4)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: Theme.cardRadius))
            .overlay(RoundedRectangle(cornerRadius: Theme.cardRadius).stroke(Theme.border, lineWidth: 1))
        }
    }

    private func toggleRow(_ label: String, systemImage: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            Label(label, systemImage: systemImage)
                .font(.system(size: 14))
                .foregroundStyle(Theme.ink)
        }
        .tint(Theme.primary)
        .padding(.vertical, 9)
    }

    private var sourceSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Source")
            FilterChipsRow(
                options: data.leadSources.map { ($0, $0.capitalized) },
                selected: filter.source
            ) { value in
                filter.source = filter.source == value ? nil : value
            }
        }
    }

    private var eventSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Event")
            FilterChipsRow(
                options: data.events.map { ($0.id, $0.title) },
                selected: filter.eventId
            ) { value in
                filter.eventId = filter.eventId == value ? nil : value
            }
        }
    }
}

/// A wrapping row of selectable chips used inside the filter sheet.
private struct FilterChipsRow: View {
    let options: [(value: String, label: String)]
    let selected: String?
    let onTap: (String) -> Void

    private let columns = [GridItem(.adaptive(minimum: 90), spacing: 8)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(options, id: \.value) { option in
                let active = selected == option.value
                Button { onTap(option.value) } label: {
                    Text(option.label)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(active ? .white : Theme.inkSecondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 9)
                        .background(active ? AnyShapeStyle(Theme.primary) : AnyShapeStyle(Theme.surfaceMuted))
                        .clipShape(.rect(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
        }
    }
}
