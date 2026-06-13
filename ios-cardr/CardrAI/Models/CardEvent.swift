import Foundation

/// A single analytics row read back from the `card_events` table.
nonisolated struct CardEventRow: Decodable {
    let eventType: String

    enum CodingKeys: String, CodingKey {
        case eventType = "event_type"
    }
}

/// Aggregate analytics for the signed-in user's digital card.
struct CardAnalytics {
    var views: Int = 0
    var shares: Int = 0
    var saves: Int = 0

    var total: Int { views + shares + saves }
}
