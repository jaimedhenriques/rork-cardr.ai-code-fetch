import Foundation

/// An AI agent, mirroring the `agents` table. Agents can be installed from
/// templates and run in the background (follow-ups, enrichment, proposals).
nonisolated struct Agent: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var description: String?
    var type: String
    var systemPrompt: String?
    var status: String
    var isTemplate: Bool?
    var icon: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, type, status, icon
        case systemPrompt = "system_prompt"
        case isTemplate = "is_template"
        case createdAt = "created_at"
    }

    var isActive: Bool { status == "active" }

    /// SF Symbol for the agent, mapped from its type/icon.
    var symbol: String {
        switch type {
        case "proposal_builder": return "doc.text.fill"
        case "follow_up", "followup": return "envelope.badge.fill"
        case "enrichment": return "sparkles"
        case "lead_scorer": return "chart.line.uptrend.xyaxis"
        case "recap": return "doc.text.magnifyingglass"
        default: return "cpu"
        }
    }
}
