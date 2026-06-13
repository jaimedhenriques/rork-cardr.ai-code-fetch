import Foundation

/// A user-defined label, mirroring the `tags` table on the web app.
nonisolated struct Tag: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var color: String?

    enum CodingKeys: String, CodingKey {
        case id, name, color
    }

    /// Resolved hex color (without the leading `#`) for use with `Color(hex:)`.
    var hexValue: String {
        let raw = (color?.isEmpty == false ? color! : TagDefaults.palette[0])
        return raw.hasPrefix("#") ? String(raw.dropFirst()) : raw
    }
}

/// A `contact_tags` join row linking a contact to a tag.
nonisolated struct ContactTag: Codable, Identifiable, Hashable {
    let id: String
    let contactId: String
    let tagId: String

    enum CodingKeys: String, CodingKey {
        case id
        case contactId = "contact_id"
        case tagId = "tag_id"
    }
}

/// Shared tag color palette, matching the web `TAG_COLORS`.
nonisolated enum TagDefaults {
    static let palette: [String] = [
        "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
        "#ef4444", "#f97316", "#22c55e", "#14b8a6",
    ]

    /// A deterministic palette color so new tags vary without storing state.
    static func color(forIndex index: Int) -> String {
        palette[index % palette.count]
    }
}
