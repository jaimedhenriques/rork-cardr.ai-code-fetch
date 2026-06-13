import Foundation

/// An MCP API key, mirroring the `user_api_keys` table on the web app.
/// Powers "Claude remote-control": users mint a key, paste it into Claude
/// Desktop / Cursor, and the MCP server reads their CardrAI data on demand.
nonisolated struct ApiKey: Codable, Identifiable, Hashable {
    let id: String
    var keyPrefix: String
    var label: String
    var createdAt: String?
    var lastUsedAt: String?
    var revokedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, label
        case keyPrefix = "key_prefix"
        case createdAt = "created_at"
        case lastUsedAt = "last_used_at"
        case revokedAt = "revoked_at"
    }
}
