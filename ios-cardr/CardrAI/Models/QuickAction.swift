import SwiftUI

/// A selectable, reorderable dashboard quick-action card.
/// Mirrors the web `ALL_QUICK_ACTIONS` catalog. Each item maps to a real
/// navigation destination reachable from the dashboard.
struct QuickActionItem: Identifiable, Hashable {
    let id: String
    let label: String
    let icon: String
    let tint: Color
    let destination: DrawerDestination
}

enum QuickActionCatalog {
    /// The full catalog of quick actions a user can pin to the dashboard.
    static let all: [QuickActionItem] = [
        QuickActionItem(id: "pipeline", label: "Pipeline", icon: "chart.bar.doc.horizontal.fill", tint: Theme.primary, destination: .leads),
        QuickActionItem(id: "events", label: "Events", icon: "flag.fill", tint: Theme.warning, destination: .events),
        QuickActionItem(id: "export", label: "Export", icon: "square.and.arrow.up.on.square.fill", tint: Theme.accent, destination: .export),
        QuickActionItem(id: "scan", label: "Scan", icon: "camera.viewfinder", tint: Theme.primary, destination: .scan),
        QuickActionItem(id: "card", label: "My Card", icon: "person.crop.rectangle.fill", tint: Theme.accent, destination: .myCard),
        QuickActionItem(id: "calendar", label: "Calendar", icon: "calendar", tint: Theme.primary, destination: .calendar),
        QuickActionItem(id: "contacts", label: "Contacts", icon: "person.2.fill", tint: Theme.primary, destination: .contacts),
        QuickActionItem(id: "notes", label: "Notes", icon: "note.text", tint: Theme.accent, destination: .notes),
        QuickActionItem(id: "ai", label: "AI Chat", icon: "sparkles", tint: Theme.primary, destination: .aiChat),
        QuickActionItem(id: "agents", label: "Agents", icon: "cpu", tint: Theme.accent, destination: .agents),
        QuickActionItem(id: "automations", label: "Automations", icon: "arrow.triangle.branch", tint: Theme.warning, destination: .automations),
        QuickActionItem(id: "admin", label: "Admin", icon: "building.2.fill", tint: Theme.inkSecondary, destination: .admin),
    ]

    /// Default pinned quick actions, matching the iOS dashboard's original three.
    static let defaultIds: [String] = ["pipeline", "events", "export"]

    /// Minimum and maximum number of pinned quick actions, mirroring the web limits.
    static let minSelected = 2
    static let maxSelected = 9

    static func item(_ id: String) -> QuickActionItem? {
        all.first { $0.id == id }
    }
}
