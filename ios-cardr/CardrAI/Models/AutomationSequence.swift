import Foundation

/// A multi-step outreach sequence, mirroring the `automation_sequences` table.
nonisolated struct AutomationSequence: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var description: String?
    var channel: String?
    var tone: String?
    var goal: String?
    var isActive: Bool?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, channel, tone, goal
        case isActive = "is_active"
        case createdAt = "created_at"
    }
}

/// A contact's enrollment in a sequence, mirroring `automation_sequence_runs`.
nonisolated struct SequenceRun: Codable, Identifiable, Hashable {
    let id: String
    var sequenceId: String
    var contactId: String?
    var status: String
    var currentStep: Int?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case sequenceId = "sequence_id"
        case contactId = "contact_id"
        case currentStep = "current_step"
        case createdAt = "created_at"
    }
}

/// A single step in a sequence, mirroring `automation_sequence_steps`.
nonisolated struct SequenceStep: Codable, Identifiable, Hashable {
    var id: String?
    var stepOrder: Int
    var channel: String
    var delayDays: Int
    var subjectTemplate: String?
    var bodyTemplate: String

    enum CodingKeys: String, CodingKey {
        case id, channel
        case stepOrder = "step_order"
        case delayDays = "delay_days"
        case subjectTemplate = "subject_template"
        case bodyTemplate = "body_template"
    }

    /// Stable identity for SwiftUI list rendering before a row is persisted.
    var localID: String { id ?? "step-\(stepOrder)" }
}

/// A generated, per-contact outreach draft, mirroring `automation_sequence_messages`.
nonisolated struct RunMessage: Codable, Identifiable, Hashable {
    let id: String
    var runId: String?
    var stepId: String?
    var channel: String
    var subject: String?
    var body: String
    var status: String
    var scheduledAt: String?
    var sentAt: String?

    enum CodingKeys: String, CodingKey {
        case id, channel, subject, body, status
        case runId = "run_id"
        case stepId = "step_id"
        case scheduledAt = "scheduled_at"
        case sentAt = "sent_at"
    }
}

/// Channel display helpers shared by the automation views.
nonisolated enum AutomationChannel {
    static func label(_ channel: String) -> String {
        switch channel {
        case "email": return "Email"
        case "linkedin_connection": return "LinkedIn invite"
        case "linkedin_message": return "LinkedIn message"
        default: return channel.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    static func icon(_ channel: String) -> String {
        switch channel {
        case "email": return "envelope.fill"
        case "linkedin_connection": return "person.badge.plus"
        default: return "link"
        }
    }
}
