import Foundation

/// A single agent execution, mirroring the `agent_runs` table. Used by the
/// live activity feed on the Agents screen.
nonisolated struct AgentRun: Codable, Identifiable, Hashable {
    let id: String
    var agentId: String
    var contactId: String?
    var status: String
    var errorMessage: String?
    var createdAt: String?
    var completedAt: String?
    var output: [String: JSONValue]?
    var input: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case id, status, output, input
        case agentId = "agent_id"
        case contactId = "contact_id"
        case errorMessage = "error_message"
        case createdAt = "created_at"
        case completedAt = "completed_at"
    }

    /// Best-effort short, human summary pulled from the run output.
    var summary: String? {
        guard let output else { return nil }
        let keys = ["summary", "message", "result", "text", "draft", "headline"]
        for key in keys {
            if case let .string(value)? = output[key] {
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    return trimmed.count > 200 ? String(trimmed.prefix(197)) + "…" : trimmed
                }
            }
        }
        if case let .array(items)? = output["highlights"], case let .string(first)? = items.first {
            return first
        }
        return nil
    }

    var contactName: String? {
        if case let .string(name)? = input?["contact_name"] { return name }
        return nil
    }
}

/// Minimal JSON value to decode arbitrary `jsonb` columns without losing type info.
nonisolated enum JSONValue: Codable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([JSONValue])
    case object([String: JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}
