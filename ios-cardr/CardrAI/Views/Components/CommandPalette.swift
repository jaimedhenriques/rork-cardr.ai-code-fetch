import SwiftUI
import UIKit

// MARK: - Open-command-palette environment hook

private struct OpenCommandPaletteKey: EnvironmentKey {
    static let defaultValue: () -> Void = {}
}

extension EnvironmentValues {
    /// Opens the global ⌘K-style quick switcher.
    var openCommandPalette: () -> Void {
        get { self[OpenCommandPaletteKey.self] }
        set { self[OpenCommandPaletteKey.self] = newValue }
    }
}

/// A single runnable action in the command palette.
private struct CommandAction: Identifiable {
    enum Kind {
        case destination(DrawerDestination)
        case signOut
    }
    let id: String
    let label: String
    let group: String
    let icon: String
    let keywords: String
    let kind: Kind
}

/// Global quick switcher mirroring the web `CommandPalette` (⌘K). Presented as a
/// sheet with a search field, grouped navigation, quick actions, and account
/// actions. On hardware keyboards ⌘K toggles it; the drawer and toolbars also
/// surface a button.
struct CommandPaletteView: View {
    @Environment(\.dismiss) private var dismiss

    let onSelect: (DrawerDestination) -> Void
    let onSignOut: () -> Void

    @State private var query = ""
    @FocusState private var searchFocused: Bool

    private let actions: [CommandAction] = [
        // Quick actions
        CommandAction(id: "scan", label: "Scan a business card", group: "Quick actions", icon: "viewfinder", keywords: "camera badge capture", kind: .destination(.scan)),
        CommandAction(id: "note", label: "Capture a meeting note", group: "Quick actions", icon: "mic.fill", keywords: "record write transcript", kind: .destination(.notes)),
        // Navigate
        CommandAction(id: "home", label: "Home", group: "Navigate", icon: "house.fill", keywords: "dashboard overview", kind: .destination(.home)),
        CommandAction(id: "contacts", label: "Contacts", group: "Navigate", icon: "person.2.fill", keywords: "people leads crm", kind: .destination(.contacts)),
        CommandAction(id: "leads", label: "Pipeline", group: "Navigate", icon: "arrow.triangle.branch", keywords: "deals stages kanban leads", kind: .destination(.leads)),
        CommandAction(id: "card", label: "My Card", group: "Navigate", icon: "person.crop.rectangle.fill", keywords: "digital business card profile", kind: .destination(.myCard)),
        CommandAction(id: "calendar", label: "Calendar", group: "Navigate", icon: "calendar", keywords: "events meetings schedule", kind: .destination(.calendar)),
        CommandAction(id: "events", label: "Events", group: "Navigate", icon: "flag.fill", keywords: "conference tradeshow", kind: .destination(.events)),
        CommandAction(id: "notesnav", label: "Notes", group: "Navigate", icon: "note.text", keywords: "meeting transcripts", kind: .destination(.notes)),
        CommandAction(id: "ai", label: "AI Chat", group: "Navigate", icon: "sparkles", keywords: "assistant gpt", kind: .destination(.aiChat)),
        CommandAction(id: "agents", label: "Agents", group: "Navigate", icon: "cpu", keywords: "automation bots", kind: .destination(.agents)),
        CommandAction(id: "automations", label: "Automations", group: "Navigate", icon: "arrow.triangle.branch", keywords: "sequences outreach", kind: .destination(.automations)),
        CommandAction(id: "integrations", label: "Integrations", group: "Navigate", icon: "puzzlepiece.extension.fill", keywords: "zapier webhook connect", kind: .destination(.integrations)),
        CommandAction(id: "analytics", label: "Analytics", group: "Navigate", icon: "chart.bar.xaxis", keywords: "insights stats", kind: .destination(.analytics)),
        CommandAction(id: "activity", label: "Activity", group: "Navigate", icon: "chart.bar.fill", keywords: "timeline recent", kind: .destination(.activity)),
        CommandAction(id: "export", label: "Export", group: "Navigate", icon: "arrow.down.doc.fill", keywords: "csv download", kind: .destination(.export)),
        CommandAction(id: "admin", label: "Admin Panel", group: "Navigate", icon: "building.2.fill", keywords: "team organization usage", kind: .destination(.admin)),
        CommandAction(id: "settings", label: "Settings", group: "Navigate", icon: "gearshape.fill", keywords: "account preferences", kind: .destination(.settings)),
        // Account
        CommandAction(id: "signout", label: "Sign out", group: "Account", icon: "rectangle.portrait.and.arrow.right", keywords: "logout exit", kind: .signOut),
    ]

    private var filtered: [CommandAction] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return actions }
        return actions.filter { "\($0.label) \($0.keywords)".lowercased().contains(q) }
    }

    private var groups: [String] {
        var seen: [String] = []
        for action in filtered where !seen.contains(action.group) { seen.append(action.group) }
        return seen
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchField
                Divider()
                content
            }
            .background(Theme.background)
            .navigationTitle("Quick Switcher")
            .navigationBarTitleDisplayMode(.inline)
            .task { searchFocused = true }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Theme.inkSecondary)
            TextField("Type a command or search…", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .focused($searchFocused)
                .onSubmit { runFirst() }
            if !query.isEmpty {
                Button {
                    query = ""
                    searchFocused = true
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                }
                .buttonStyle(.plain)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .animation(.easeInOut(duration: 0.15), value: query.isEmpty)
    }

    @ViewBuilder
    private var content: some View {
        if filtered.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.title2)
                    .foregroundStyle(Theme.inkSecondary)
                Text("No results")
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(groups, id: \.self) { group in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(group.uppercased())
                                .font(.system(size: 11, weight: .bold))
                                .tracking(1.4)
                                .foregroundStyle(Theme.inkSecondary.opacity(0.7))
                                .padding(.horizontal, 16)
                                .padding(.bottom, 2)
                            ForEach(filtered.filter { $0.group == group }) { action in
                                row(action)
                            }
                        }
                    }
                }
                .padding(.vertical, 14)
            }
        }
    }

    private func row(_ action: CommandAction) -> some View {
        Button { run(action) } label: {
            HStack(spacing: 12) {
                Image(systemName: action.icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(action.isDestructive ? Theme.destructive : Theme.primary)
                    .frame(width: 24)
                Text(action.label)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(action.isDestructive ? Theme.destructive : Theme.ink)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
    }

    private func runFirst() {
        if let first = filtered.first { run(first) }
    }

    private func run(_ action: CommandAction) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        switch action.kind {
        case .destination(let destination):
            onSelect(destination)
        case .signOut:
            onSignOut()
        }
    }
}

private extension CommandAction {
    var isDestructive: Bool {
        if case .signOut = kind { return true }
        return false
    }
}
