import Foundation
import Observation
import SwiftUI

/// Persists the user's dashboard widget layout (visibility + order) to `UserDefaults`.
/// Mirrors the web `useDashboardSections` hook.
@Observable
@MainActor
final class DashboardLayoutStore {
    private static let storageKey = "cardr.dashboardSections"
    private static let quickActionsKey = "cardr.quickActions"

    private(set) var sections: [DashboardSection]
    /// Pinned quick-action ids, in display order. Mirrors the web `quickIds`.
    private(set) var quickActionIds: [String]

    init() {
        sections = Self.load()
        quickActionIds = Self.loadQuickActions()
    }

    /// The resolved quick-action items to render on the dashboard, in order.
    var quickActions: [QuickActionItem] {
        quickActionIds.compactMap { QuickActionCatalog.item($0) }
    }

    /// Catalog items not currently pinned, in catalog order.
    var availableQuickActions: [QuickActionItem] {
        QuickActionCatalog.all.filter { !quickActionIds.contains($0.id) }
    }

    func isQuickActionPinned(_ id: String) -> Bool {
        quickActionIds.contains(id)
    }

    func addQuickAction(_ id: String) {
        guard !quickActionIds.contains(id),
              quickActionIds.count < QuickActionCatalog.maxSelected,
              QuickActionCatalog.item(id) != nil else { return }
        quickActionIds.append(id)
        saveQuickActions()
    }

    func removeQuickAction(_ id: String) {
        guard quickActionIds.count > QuickActionCatalog.minSelected,
              let index = quickActionIds.firstIndex(of: id) else { return }
        quickActionIds.remove(at: index)
        saveQuickActions()
    }

    func moveQuickAction(from source: IndexSet, to destination: Int) {
        quickActionIds.move(fromOffsets: source, toOffset: destination)
        saveQuickActions()
    }

    func resetQuickActions() {
        quickActionIds = QuickActionCatalog.defaultIds
        saveQuickActions()
    }

    /// Section ids that should be rendered, in their current order.
    var visibleSectionIds: [String] {
        sections.filter(\.visible).map(\.id)
    }

    func isVisible(_ id: String) -> Bool {
        sections.first(where: { $0.id == id })?.visible ?? false
    }

    func toggle(_ id: String) {
        guard let index = sections.firstIndex(where: { $0.id == id }) else { return }
        sections[index].visible.toggle()
        save()
    }

    func move(from source: IndexSet, to destination: Int) {
        sections.move(fromOffsets: source, toOffset: destination)
        save()
    }

    func applyPreset(_ presetId: String) {
        guard let preset = DashboardLayout.presets.first(where: { $0.id == presetId }) else { return }
        let inPreset: [DashboardSection] = preset.sectionIds.compactMap { id in
            sections.first(where: { $0.id == id }).map { DashboardSection(id: $0.id, label: $0.label, description: $0.description, visible: true) }
        }
        let notInPreset: [DashboardSection] = sections
            .filter { !preset.sectionIds.contains($0.id) }
            .map { DashboardSection(id: $0.id, label: $0.label, description: $0.description, visible: false) }
        sections = inPreset + notInPreset
        save()
    }

    func reset() {
        sections = DashboardLayout.allSections
        save()
    }

    // MARK: - Persistence

    private struct StoredSection: Codable {
        let id: String
        let visible: Bool
    }

    private func save() {
        let stored = sections.map { StoredSection(id: $0.id, visible: $0.visible) }
        if let data = try? JSONEncoder().encode(stored) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
    }

    private func saveQuickActions() {
        if let data = try? JSONEncoder().encode(quickActionIds) {
            UserDefaults.standard.set(data, forKey: Self.quickActionsKey)
        }
    }

    private static func loadQuickActions() -> [String] {
        guard
            let data = UserDefaults.standard.data(forKey: quickActionsKey),
            let stored = try? JSONDecoder().decode([String].self, from: data)
        else {
            return QuickActionCatalog.defaultIds
        }
        // Drop any ids that no longer exist in the catalog.
        let valid = stored.filter { QuickActionCatalog.item($0) != nil }
        return valid.count >= QuickActionCatalog.minSelected ? valid : QuickActionCatalog.defaultIds
    }

    private static func load() -> [DashboardSection] {
        guard
            let data = UserDefaults.standard.data(forKey: storageKey),
            let stored = try? JSONDecoder().decode([StoredSection].self, from: data)
        else {
            return DashboardLayout.allSections
        }
        let storedIds = Set(stored.map(\.id))
        var ordered: [DashboardSection] = []
        // Preserve the user's saved order + visibility.
        for entry in stored {
            if let def = DashboardLayout.allSections.first(where: { $0.id == entry.id }) {
                ordered.append(DashboardSection(id: def.id, label: def.label, description: def.description, visible: entry.visible))
            }
        }
        // Append any newly-added sections not present in the saved layout.
        for def in DashboardLayout.allSections where !storedIds.contains(def.id) {
            ordered.append(def)
        }
        return ordered
    }
}
