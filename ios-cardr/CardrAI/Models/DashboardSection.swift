import Foundation

/// A toggleable, reorderable widget on the home dashboard.
/// Mirrors the web `useDashboardSections` model.
struct DashboardSection: Identifiable, Hashable, Codable {
    let id: String
    let label: String
    let description: String
    var visible: Bool
}

/// A one-tap layout that toggles a curated subset of sections on.
struct DashboardPreset: Identifiable, Hashable {
    let id: String
    let label: String
    let description: String
    let sectionIds: [String]
}

enum DashboardLayout {
    /// The full catalog of dashboard widgets, in their default order.
    /// Each id maps to a real widget rendered by `DashboardView`.
    static let allSections: [DashboardSection] = [
        DashboardSection(id: "greeting", label: "Greeting", description: "Welcome banner with share card", visible: true),
        DashboardSection(id: "stats", label: "Stats", description: "Contacts, this week, follow-ups", visible: true),
        DashboardSection(id: "health", label: "Network Health", description: "A/B/C engagement breakdown", visible: true),
        DashboardSection(id: "quick_actions", label: "Quick Actions", description: "Pipeline, events, export shortcuts", visible: true),
        DashboardSection(id: "recent_contacts", label: "Recent Contacts", description: "Your last scanned contacts", visible: true),
    ]

    static let presets: [DashboardPreset] = [
        DashboardPreset(
            id: "sales",
            label: "Sales Focus",
            description: "Pipeline health, quick actions, recent leads",
            sectionIds: ["greeting", "health", "quick_actions", "recent_contacts"]
        ),
        DashboardPreset(
            id: "networking",
            label: "Full",
            description: "The complete dashboard experience",
            sectionIds: ["greeting", "stats", "health", "quick_actions", "recent_contacts"]
        ),
        DashboardPreset(
            id: "minimal",
            label: "Minimal",
            description: "Just the essentials — greeting and contacts",
            sectionIds: ["greeting", "quick_actions", "recent_contacts"]
        ),
    ]
}
