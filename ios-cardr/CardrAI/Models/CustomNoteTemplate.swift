import Foundation

/// One user-defined extraction section of a custom template
/// (e.g. "Red flags" → the AI returns a `redFlags` list on the note).
nonisolated struct CustomTemplateField: Codable, Identifiable, Hashable {
    var key: String
    var label: String
    var description: String?
    /// "list" (array of strings) or "text" (single string). Defaults to "list".
    var type: String?

    var id: String { key }
    var isText: Bool { type == "text" }
}

/// A user-defined meeting-note template, mirroring the `custom_note_templates`
/// table. The prompt is assembled server-side by the `meeting-notes` function
/// from `fields` + `guidance`.
nonisolated struct CustomNoteTemplate: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var emoji: String?
    var description: String?
    var fields: [CustomTemplateField]?
    var guidance: String?
    var createdAt: String?
    /// Owner's user id — used to split "My templates" from org-shared ones.
    var userId: String?
    var orgId: String?
    /// Shared with the owner's organization.
    var isShared: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, emoji, description, fields, guidance
        case createdAt = "created_at"
        case userId = "user_id"
        case orgId = "org_id"
        case isShared = "is_shared"
    }

    var displayEmoji: String {
        guard let emoji, !emoji.isEmpty else { return "📝" }
        return emoji
    }

    /// Short subtitle for pickers — description, or the section names.
    var summary: String {
        if let description, !description.isEmpty { return description }
        let labels = (fields ?? []).map(\.label)
        return labels.isEmpty ? "Custom template" : labels.joined(separator: " · ")
    }

    /// The template id sent to the meeting-notes function.
    var templateId: String { "custom-\(id)" }

    /// The `customTemplate` request payload for the meeting-notes function.
    var payload: [String: Any] {
        let fieldDicts: [[String: String]] = (fields ?? []).map { field in
            [
                "key": field.key,
                "label": field.label,
                "description": field.description ?? "",
                "type": field.type ?? "list",
            ]
        }
        return ["name": name, "guidance": guidance ?? "", "fields": fieldDicts]
    }

    /// Derives a stable camelCase JSON key from a section label
    /// (e.g. "Red flags" → "redFlags"), mirroring the web `makeFieldKey`.
    static func makeKey(from label: String) -> String {
        let cleaned = label
            .folding(options: .diacriticInsensitive, locale: .current)
            .replacingOccurrences(of: "[^a-zA-Z0-9\\s]", with: " ", options: .regularExpression)
        let words = cleaned.split(separator: " ").map(String.init).filter { !$0.isEmpty }
        guard !words.isEmpty else { return "" }
        var key = words.enumerated().map { index, word in
            index == 0 ? word.lowercased() : word.prefix(1).uppercased() + word.dropFirst().lowercased()
        }.joined()
        key = String(key.prefix(40))
        if let first = key.first, !first.isLetter { key = String("f\(key)".prefix(40)) }
        return key
    }
}

/// A custom-template section value on a note — either a text answer or a list.
nonisolated enum TemplateFieldValue: Codable, Hashable {
    case text(String)
    case list([String])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let text = try? container.decode(String.self) {
            self = .text(text)
            return
        }
        if let items = try? container.decode([String].self) {
            self = .list(items)
            return
        }
        self = .list([])
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let text): try container.encode(text)
        case .list(let items): try container.encode(items)
        }
    }

    var isEmpty: Bool {
        switch self {
        case .text(let text): return text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .list(let items): return items.isEmpty
        }
    }
}
