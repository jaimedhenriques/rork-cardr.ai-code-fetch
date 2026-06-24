import Foundation

/// A platform-wide user profile row (super-admin view).
nonisolated struct PlatformUser: Codable, Identifiable, Hashable {
    let id: String
    var email: String?
    var name: String?
    var company: String?
    var title: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, email, name, company, title
        case createdAt = "created_at"
    }

    var displayName: String {
        if let name, !name.isEmpty { return name }
        return email ?? "User"
    }

    var initials: String {
        let parts = displayName.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first }.map(String.init).joined().uppercased()
    }
}

/// A subscription row (super-admin view).
nonisolated struct PlatformSubscription: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    var plan: String
    var status: String

    enum CodingKeys: String, CodingKey {
        case id, plan, status
        case userId = "user_id"
    }
}

/// A usage-tracking row (super-admin view).
nonisolated struct PlatformUsage: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    var periodStart: String?
    var enrichmentsUsed: Int
    var notesCreated: Int
    var transcriptionMinutesUsed: Int
    var contactsCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case periodStart = "period_start"
        case enrichmentsUsed = "enrichments_used"
        case notesCreated = "notes_created"
        case transcriptionMinutesUsed = "transcription_minutes_used"
        case contactsCount = "contacts_count"
    }
}

/// An organization row for the platform orgs tab, with member count resolved.
nonisolated struct PlatformOrg: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var slug: String
    var maxSeats: Int?
    var memberCount: Int = 0

    enum CodingKeys: String, CodingKey {
        case id, name, slug
        case maxSeats = "max_seats"
    }
}

/// The plan options a super-admin can assign.
nonisolated enum PlatformPlan: String, CaseIterable, Identifiable {
    case starter, pro, business, teams
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}
