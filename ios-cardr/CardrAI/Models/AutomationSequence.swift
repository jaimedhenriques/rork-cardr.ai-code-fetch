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
