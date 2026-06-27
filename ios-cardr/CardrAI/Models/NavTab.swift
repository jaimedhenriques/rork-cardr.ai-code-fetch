import SwiftUI

/// Catalog of destinations that can appear in the bottom tab bar. Mirrors the
/// web `ALL_NAV_ITEMS` / `useNavPreferences` system: the user picks and reorders
/// which destinations show, and the middle one becomes the raised center button.
enum NavTabCatalog {
    /// All destinations selectable for the bottom tab bar, in catalog order.
    static let all: [DrawerDestination] = [
        .home, .notes, .scan, .aiChat, .agents, .contacts,
        .calendar, .events, .leads, .myCard, .automations, .admin,
    ]

    /// Default pinned tabs, matching the web defaults (Home, Notes, Scan, Leads, Contacts).
    static let defaultIds: [String] = ["home", "notes", "scan", "leads", "contacts"]

    static let minSelected = 3
    static let maxSelected = 5

    static func item(_ id: String) -> DrawerDestination? {
        guard let dest = DrawerDestination(rawValue: id), all.contains(dest) else { return nil }
        return dest
    }
}

extension DrawerDestination {
    /// Short label used in the compact bottom tab bar.
    var tabTitle: String {
        switch self {
        case .scan: "Scan"
        case .aiChat: "AI"
        case .admin: "Admin"
        case .myCard: "My Card"
        default: title
        }
    }

    /// Whether this destination renders its own `NavigationStack` as a tab root.
    /// Group A (Dashboard/Contacts/Scan/Notes/MyCard) and Agents own their stack;
    /// everything else must be wrapped when shown as a tab root.
    var ownsNavigationStack: Bool {
        switch self {
        case .home, .contacts, .scan, .notes, .myCard, .agents: true
        default: false
        }
    }
}
