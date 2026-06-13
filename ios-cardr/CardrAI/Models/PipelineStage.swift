import Foundation

/// A CRM pipeline stage, mirroring the `pipeline_stages` table on the web app.
nonisolated struct PipelineStage: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var color: String
    var sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, name, color
        case sortOrder = "sort_order"
    }
}

/// The default stages seeded for a brand-new user — matches the web defaults.
nonisolated enum PipelineDefaults {
    static let stages: [(name: String, color: String, sortOrder: Int)] = [
        ("New", "#6366f1", 0),
        ("Contacted", "#f59e0b", 1),
        ("Qualified", "#3b82f6", 2),
        ("Proposal", "#8b5cf6", 3),
        ("Negotiation", "#ec4899", 4),
        ("Won", "#10b981", 5),
        ("Lost", "#ef4444", 6),
    ]

    static let palette: [String] = [
        "#6366f1", "#3b82f6", "#f59e0b", "#10b981", "#ef4444",
        "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
    ]
}
