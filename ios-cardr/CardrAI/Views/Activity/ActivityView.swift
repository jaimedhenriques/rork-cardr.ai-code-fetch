import SwiftUI

/// A unified activity timeline mirroring the web `Contacts?tab=activity` view —
/// recent contacts added, notes captured, and events created, newest first.
struct ActivityView: View {
    @Environment(DataStore.self) private var data

    private enum Kind {
        case contact, note, event, enriched

        var icon: String {
            switch self {
            case .contact: "person.crop.circle.badge.plus"
            case .note: "note.text"
            case .event: "flag.fill"
            case .enriched: "sparkles"
            }
        }

        var tint: Color {
            switch self {
            case .contact: Theme.primary
            case .note: Theme.accent
            case .event: Theme.warning
            case .enriched: Theme.success
            }
        }
    }

    private struct Item: Identifiable {
        let id: String
        let kind: Kind
        let title: String
        let subtitle: String
        let date: Date
    }

    private static let iso = ISO8601DateFormatter()

    private func parse(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        if let d = Self.iso.date(from: raw) { return d }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f.date(from: String(raw.prefix(19)))
    }

    private var items: [Item] {
        var result: [Item] = []
        for c in data.contacts {
            if let date = parse(c.createdAt ?? c.scannedAt) {
                result.append(Item(
                    id: "c-\(c.id)",
                    kind: c.enriched == true ? .enriched : .contact,
                    title: c.name,
                    subtitle: c.enriched == true ? "Contact enriched" : "Contact added",
                    date: date
                ))
            }
        }
        for n in data.notes {
            if let date = parse(n.createdAt) {
                result.append(Item(id: "n-\(n.id)", kind: .note, title: n.title, subtitle: "Note captured", date: date))
            }
        }
        for e in data.events {
            if let date = parse(e.createdAt) {
                result.append(Item(id: "e-\(e.id)", kind: .event, title: e.title, subtitle: "Event created", date: date))
            }
        }
        return result.sorted { $0.date > $1.date }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                summary
                if items.isEmpty {
                    emptyState
                } else {
                    timeline
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Activity")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await data.loadAll() }
    }

    private var summary: some View {
        HStack(spacing: 12) {
            metric("\(data.contacts.count)", "Contacts", Theme.primary)
            metric("\(data.enrichedCount)", "Enriched", Theme.success)
            metric("\(data.thisWeekCount)", "This week", Theme.accent)
        }
    }

    private func metric(_ value: String, _ label: String, _ tint: Color) -> some View {
        CardSurface(padding: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(value)
                    .font(.system(size: 22, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
                Text(label)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .topTrailing) {
                Circle().fill(tint).frame(width: 7, height: 7)
            }
        }
    }

    private var timeline: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Recent activity")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.inkSecondary)
                .padding(.bottom, 10)
            ForEach(Array(items.prefix(50).enumerated()), id: \.element.id) { index, item in
                row(item, isLast: index == min(items.count, 50) - 1)
            }
        }
    }

    private func row(_ item: Item, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                ZStack {
                    Circle().fill(item.kind.tint.opacity(0.14)).frame(width: 34, height: 34)
                    Image(systemName: item.kind.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(item.kind.tint)
                }
                if !isLast {
                    Rectangle()
                        .fill(Theme.border)
                        .frame(width: 1.5)
                        .frame(maxHeight: .infinity)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Text(item.subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.inkSecondary)
                Text(item.date.formatted(.relative(presentation: .named)))
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary.opacity(0.7))
            }
            .padding(.bottom, isLast ? 0 : 18)
            Spacer(minLength: 0)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text("No activity yet")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text("Add contacts, capture notes, or create events and they'll show up here.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 50)
    }
}
