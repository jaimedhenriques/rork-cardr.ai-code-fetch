import Foundation

/// A person attached to a meeting note — optionally linked to a CRM contact.
/// Mirrors the `meeting_participants` table the web app uses.
nonisolated struct MeetingParticipant: Codable, Identifiable, Hashable {
    let id: String
    let meetingNoteId: String
    var name: String
    var contactId: String?
    var speakerLabel: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case meetingNoteId = "meeting_note_id"
        case contactId = "contact_id"
        case speakerLabel = "speaker_label"
    }
}

/// Minimal decodable for `contact_activities` insert responses (we only need ids).
nonisolated struct ContactActivityStub: Codable, Identifiable, Hashable {
    let id: String
}
