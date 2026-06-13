import Foundation

/// A meeting note / recording summary, mirroring the `meeting_notes` table.
nonisolated struct MeetingNote: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var summary: String?
    var transcript: String?
    var manualNotes: String?
    var category: String?
    var durationSeconds: Int?
    var keyTopics: [String]?
    var actionItems: [String]?
    var followUps: [String]?
    var decisions: [String]?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, summary, transcript, category
        case manualNotes = "manual_notes"
        case durationSeconds = "duration_seconds"
        case keyTopics = "key_topics"
        case actionItems = "action_items"
        case followUps = "follow_ups"
        case decisions
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var durationLabel: String? {
        guard let seconds = durationSeconds, seconds > 0 else { return nil }
        let minutes = seconds / 60
        return minutes > 0 ? "\(minutes) min" : "\(seconds)s"
    }
}
