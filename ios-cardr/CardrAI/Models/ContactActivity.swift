import Foundation

/// A contact activity log entry, mirroring the `contact_activities` table.
nonisolated struct ContactActivity: Codable, Identifiable, Hashable {
    let id: String
    let contactId: String
    var type: String
    var title: String
    var description: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case contactId = "contact_id"
        case type, title, description
        case createdAt = "created_at"
    }

    var createdDate: Date? {
        guard let createdAt, !createdAt.isEmpty else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: createdAt) ?? ISO8601DateFormatter().date(from: createdAt)
    }

    var icon: String {
        switch type {
        case "note": return "note.text"
        case "stage_change": return "arrow.triangle.2.circlepath"
        case "meeting": return "mic.fill"
        case "call": return "phone.fill"
        case "email": return "envelope.fill"
        case "follow_up": return "bell.fill"
        case "enrichment": return "sparkles"
        case "task": return "checkmark.circle"
        default: return "pin.fill"
        }
    }

    var tint: String {
        switch type {
        case "note": return "6E6E78"
        case "stage_change": return "3D82F5"
        case "meeting": return "F6A609"
        case "call": return "12B981"
        case "email": return "3D82F5"
        case "follow_up": return "E04848"
        case "enrichment": return "12B981"
        case "task": return "3D82F5"
        default: return "6E6E78"
        }
    }
}
