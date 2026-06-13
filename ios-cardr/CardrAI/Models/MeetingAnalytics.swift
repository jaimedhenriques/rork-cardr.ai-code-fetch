import Foundation

/// AI meeting analytics stored on a `meeting_notes` row's `analytics` jsonb.
nonisolated struct MeetingAnalytics: Codable, Hashable {
    var questionsAsked: Int?
    var sentimentScore: Double?
    var sentimentLabel: String?
    var engagementLevel: String?
    var topSpeaker: String?
    var talkTimeRatio: [String: Double]?
}

/// A lightweight note row used by the Analytics dashboard.
nonisolated struct AnalyticsNote: Codable, Identifiable, Hashable {
    let id: String
    var title: String?
    var createdAt: String?
    var analytics: MeetingAnalytics?
    var durationSeconds: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, analytics
        case createdAt = "created_at"
        case durationSeconds = "duration_seconds"
    }

    var hasAnalytics: Bool {
        guard let a = analytics else { return false }
        return a.questionsAsked != nil || a.sentimentScore != nil
            || a.engagementLevel != nil || a.topSpeaker != nil || a.talkTimeRatio != nil
    }
}
