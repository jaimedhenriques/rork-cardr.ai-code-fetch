import SwiftUI

/// Engagement tier for a contact, mirroring the web `getEngagementScore`.
/// A = Hot (activity within 7 days), B = Warm (8–30 days), C = Cold (31+ / none).
enum EngagementTier: String {
    case a = "A"
    case b = "B"
    case c = "C"

    var label: String {
        switch self {
        case .a: "Hot"
        case .b: "Warm"
        case .c: "Cold"
        }
    }

    var color: Color {
        switch self {
        case .a: Theme.success
        case .b: Theme.warning
        case .c: Color(hex: "8A8A93")
        }
    }
}

enum Engagement {
    private static let parser = ISO8601DateFormatter()

    private static func date(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        if let d = parser.date(from: raw) { return d }
        // Fallback for plain dates without time component.
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: String(raw.prefix(10)))
    }

    /// Scores a contact based on its most recent relevant date. Mirrors the web logic
    /// using the fields available natively (follow-up, scanned, created).
    static func tier(for contact: Contact) -> EngagementTier {
        let now = Date()

        // Future follow-up = actively engaged.
        if let follow = date(contact.followUpDate), follow >= now {
            return .a
        }

        var dates: [Date] = []
        if let follow = date(contact.followUpDate) { dates.append(follow) }
        if let scanned = date(contact.scannedAt) { dates.append(scanned) }
        if let created = date(contact.createdAt) { dates.append(created) }

        guard let mostRecent = dates.max() else { return .c }
        let days = Calendar.current.dateComponents([.day], from: mostRecent, to: now).day ?? 999
        if days <= 7 { return .a }
        if days <= 30 { return .b }
        return .c
    }
}
