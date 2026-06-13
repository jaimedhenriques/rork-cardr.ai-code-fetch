import Foundation

/// A networking event/conference, mirroring the `events` table on the web app.
nonisolated struct Event: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var description: String?
    var location: String?
    var eventType: String?
    var startDate: String?
    var endDate: String?
    var website: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, location, website
        case eventType = "event_type"
        case startDate = "start_date"
        case endDate = "end_date"
        case createdAt = "created_at"
    }

    private static let parser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let parserNoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// Parses the stored `start_date` into a `Date`, tolerating date-only values.
    var startsAt: Date? {
        Event.date(from: startDate)
    }

    var endsAt: Date? {
        Event.date(from: endDate)
    }

    /// Whether the event starts now or in the future.
    var isUpcoming: Bool {
        guard let date = startsAt else { return true }
        return date >= Calendar.current.startOfDay(for: Date())
    }

    static func date(from raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        if let d = parser.date(from: raw) { return d }
        if let d = parserNoFraction.date(from: raw) { return d }
        // Date-only (yyyy-MM-dd)
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        return df.date(from: String(raw.prefix(10)))
    }

    var formattedDate: String {
        guard let start = startsAt else { return "Date TBD" }
        let df = DateFormatter()
        df.dateFormat = "MMM d, yyyy"
        var result = df.string(from: start)
        if let end = endsAt, Calendar.current.isDate(end, inSameDayAs: start) == false {
            result += " — \(df.string(from: end))"
        }
        return result
    }
}

/// The event types offered when creating an event, matching the web options.
nonisolated enum EventDefaults {
    static let types: [String] = ["conference", "tradeshow", "meetup", "webinar"]
}

/// An `event_contacts` join row linking a contact to an event.
nonisolated struct EventContact: Codable, Identifiable, Hashable {
    let id: String
    let eventId: String
    let contactId: String

    enum CodingKeys: String, CodingKey {
        case id
        case eventId = "event_id"
        case contactId = "contact_id"
    }
}

/// Editable fields used when creating an event manually.
nonisolated struct EventDraft {
    var title = ""
    var description = ""
    var location = ""
    var website = ""
    var eventType = "conference"
    var startDate: Date = Date()
    var hasEndDate = false
    var endDate: Date = Date()

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
    }
}
