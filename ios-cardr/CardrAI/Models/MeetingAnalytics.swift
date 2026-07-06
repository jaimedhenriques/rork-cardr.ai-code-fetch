import Foundation

/// A headline metric card from meeting analytics.
nonisolated struct NoteMetric: Codable, Identifiable, Hashable {
    var id = UUID()
    var label: String
    var value: String
    var icon: String?

    enum CodingKeys: String, CodingKey { case label, value, icon }
}

/// AI meeting analytics stored on a `meeting_notes` row's `analytics` jsonb.
nonisolated struct MeetingAnalytics: Codable, Hashable {
    var questionsAsked: Int?
    var sentimentScore: Double?
    var sentimentLabel: String?
    var engagementLevel: String?
    var topSpeaker: String?
    var talkTimeRatio: [String: Double]?
    var keyMetrics: [NoteMetric]?
    /// Custom-template sections keyed by field key (e.g. "redFlags"), mirroring
    /// the web `analytics.templateFields`.
    var templateFields: [String: TemplateFieldValue]?

    var hasContent: Bool {
        (keyMetrics?.isEmpty == false) || (talkTimeRatio?.isEmpty == false)
            || sentimentLabel != nil || questionsAsked != nil
            || (templateFields?.isEmpty == false)
    }
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
