import Foundation

/// A user-created folder for organizing notes, mirroring the `folders` table
/// on the web app.
nonisolated struct Folder: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var emoji: String?

    enum CodingKeys: String, CodingKey {
        case id, name, emoji
    }
}

/// A `note_tags` join row linking a meeting note to a tag.
nonisolated struct NoteTag: Codable, Identifiable, Hashable {
    let id: String
    let noteId: String
    let tagId: String

    enum CodingKeys: String, CodingKey {
        case id
        case noteId = "note_id"
        case tagId = "tag_id"
    }
}
