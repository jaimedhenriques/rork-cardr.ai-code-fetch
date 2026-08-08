import Foundation

/// The signed-in user's subscription row — mirrors the web `SubscriptionData`.
nonisolated struct UserSubscription: Codable, Hashable {
    var plan: String
    var status: String
    var cancelAtPeriodEnd: Bool
    var currentPeriodEnd: String?

    enum CodingKeys: String, CodingKey {
        case plan, status
        case cancelAtPeriodEnd = "cancel_at_period_end"
        case currentPeriodEnd = "current_period_end"
    }

    var planType: PlanType {
        switch plan.lowercased() {
        case "pro": return .pro
        case "business": return .business
        case "teams": return .teams
        default: return .starter
        }
    }
}

/// The signed-in user's usage-tracking row for the current billing period.
nonisolated struct UserUsage: Codable, Hashable {
    var enrichmentsUsed: Int
    var notesCreated: Int
    var transcriptionMinutesUsed: Int
    var contactsCount: Int

    enum CodingKeys: String, CodingKey {
        case enrichmentsUsed = "enrichments_used"
        case notesCreated = "notes_created"
        case transcriptionMinutesUsed = "transcription_minutes_used"
        case contactsCount = "contacts_count"
    }
}

/// Plan tiers with their metered limits. -1 means unlimited.
enum PlanType: String, CaseIterable, Identifiable {
    case starter, pro, business, teams
    var id: String { rawValue }

    var label: String { rawValue.capitalized }
    var icon: String {
        switch self {
        case .starter: return "sparkles"
        case .pro: return "bolt.fill"
        case .business: return "building.2.fill"
        case .teams: return "person.3.fill"
        }
    }

    var contactsLimit: Int {
        switch self {
        case .starter: return 25
        case .pro, .business, .teams: return -1
        }
    }

    var enrichmentsLimit: Int {
        switch self {
        case .starter: return 15
        case .pro: return 150
        case .business, .teams: return -1
        }
    }

    var notesLimit: Int {
        switch self {
        case .starter: return 25
        case .pro, .business, .teams: return -1
        }
    }

    var transcriptionLimit: Int {
        switch self {
        case .starter: return 60
        case .pro: return 600
        case .business, .teams: return -1
        }
    }

    /// true = lifetime caps (Starter), false = monthly reset.
    var isLifetime: Bool { self == .starter }
}

/// A single metered resource for display.
struct UsageMetric: Identifiable {
    let id: String
    let label: String
    let icon: String
    let used: Int
    let limit: Int
    var unit: String? = nil

    var isUnlimited: Bool { limit == -1 }
    var remaining: Int { isUnlimited ? -1 : max(0, limit - used) }
    var fraction: Double {
        isUnlimited ? 0 : min(Double(used) / Double(limit), 1)
    }
    var isExhausted: Bool { !isUnlimited && remaining == 0 }
    var isNearLimit: Bool {
        let pct = fraction * 100
        return !isUnlimited && pct >= 80 && pct < 100
    }
}
