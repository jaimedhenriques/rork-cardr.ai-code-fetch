import Foundation

/// A file (event pass, badge, ticket) attached to an event, mirroring the
/// `event_files` table used by the web `EventFileUploader`.
nonisolated struct EventFile: Codable, Identifiable, Hashable {
    let id: String
    var eventId: String
    var fileName: String
    var filePath: String
    var fileType: String
    var fileSize: Int?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case eventId = "event_id"
        case fileName = "file_name"
        case filePath = "file_path"
        case fileType = "file_type"
        case fileSize = "file_size"
        case createdAt = "created_at"
    }

    var isPdf: Bool { fileType == "pdf" }

    /// Human-readable size, e.g. "240 KB".
    var formattedSize: String {
        guard let fileSize else { return "" }
        return "\(fileSize / 1024) KB"
    }
}
