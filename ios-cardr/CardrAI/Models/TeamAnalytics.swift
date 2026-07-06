import Foundation

/// Org-wide meeting analytics returned by the `team-analytics` edge function.
/// Mirrors the web `TeamAnalyticsData` interface.
nonisolated struct TeamAnalytics: Codable, Hashable {
    struct Org: Codable, Hashable {
        let id: String
        let name: String
    }

    struct Totals: Codable, Hashable {
        let meetings: Int
        let minutes: Int
        let avgSentiment: Double?
        let totalQuestions: Int
        let highEngagementPct: Int?
        let avgTalkDominance: Int?
        let actionItemsTotal: Int
        let actionItemsDone: Int
    }

    let org: Org
    let rangeDays: Int
    let totals: Totals
    let members: [TeamMemberStat]
    let timeline: [TeamTimelinePoint]
    let openActionItems: [TeamOpenActionItem]
}

/// Per-member aggregates for the team leaderboard.
nonisolated struct TeamMemberStat: Codable, Identifiable, Hashable {
    let userId: String
    let name: String
    let meetings: Int
    let minutes: Int
    let avgSentiment: Double?
    let questions: Int
    let actionItems: Int
    let actionItemsDone: Int
    let avgTalkDominance: Int?
    let lastMeetingAt: String?

    var id: String { userId }
}

/// Meetings-per-day timeline point.
nonisolated struct TeamTimelinePoint: Codable, Identifiable, Hashable {
    let date: String
    let meetings: Int
    let minutes: Int

    var id: String { date }
}

/// An open (not done) action item surfaced from a teammate's meeting.
nonisolated struct TeamOpenActionItem: Codable, Identifiable, Hashable {
    let task: String
    let owner: String?
    let deadline: String?
    let priority: String?
    let memberName: String
    let noteTitle: String
    let createdAt: String

    var id: String { "\(createdAt)-\(task)" }
}
