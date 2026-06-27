import SwiftUI

struct MainTabView: View {
    @Environment(SessionStore.self) private var session
    @State private var data: DataStore
    @State private var layout = DashboardLayoutStore()
    @State private var selectedNav: DrawerDestination = .home
    @State private var drawerOpen = false
    @State private var coverRoute: DrawerDestination?
    @State private var showSettings = false
    @State private var showCommandPalette = false
    @State private var pendingCommand: DrawerDestination?
    @State private var pendingSignOut = false

    init(session: SessionStore) {
        _data = State(initialValue: DataStore(session: session))
    }

    /// The drawer item currently active, used to highlight the menu.
    private var current: DrawerDestination {
        coverRoute ?? selectedNav
    }

    var body: some View {
        ZStack {
            Group {
                tabRoot(for: selectedNav)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom) {
                CardrAITabBar(tabs: layout.navTabs, selected: selectedNav) { destination in
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation(.snappy(duration: 0.25)) {
                        selectedNav = destination
                        coverRoute = nil
                    }
                }
            }
            .ignoresSafeArea(.keyboard)

            AppDrawerView(
                isOpen: $drawerOpen,
                current: current,
                onSelect: handleSelect,
                onSignOut: {
                    drawerOpen = false
                    session.signOut()
                }
            )

            // Hidden control providing the hardware ⌘K shortcut.
            Button {
                showCommandPalette = true
            } label: { EmptyView() }
            .keyboardShortcut("k", modifiers: .command)
            .opacity(0)
            .allowsHitTesting(false)
        }
        .id(data.themeVersion)
        .tint(Theme.primary)
        .environment(data)
        .environment(layout)
        .environment(\.openDrawer) { drawerOpen = true }
        .environment(\.openCommandPalette) { showCommandPalette = true }
        .environment(\.openDestination) { handleSelect($0) }
        .fullScreenCover(item: $coverRoute) { route in
            coverContent(route)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .sheet(isPresented: $showCommandPalette, onDismiss: runPendingCommand) {
            CommandPaletteView(
                onSelect: { destination in
                    pendingCommand = destination
                    showCommandPalette = false
                },
                onSignOut: {
                    pendingSignOut = true
                    showCommandPalette = false
                }
            )
        }
        .task {
            await data.loadAll()
            data.startRealtime()
        }
        .task { await data.loadBranding() }
    }

    /// Runs an action queued from the command palette once its sheet has fully
    /// dismissed, avoiding a sheet/cover presentation conflict.
    private func runPendingCommand() {
        if pendingSignOut {
            pendingSignOut = false
            session.signOut()
            return
        }
        if let destination = pendingCommand {
            pendingCommand = nil
            handleSelect(destination)
        }
    }

    private func handleSelect(_ destination: DrawerDestination) {
        withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) { drawerOpen = false }
        if NavTabCatalog.all.contains(destination) {
            // Anything renderable as a tab root becomes the active root.
            selectedNav = destination
            coverRoute = nil
        } else if destination == .settings {
            showSettings = true
        } else {
            coverRoute = destination
        }
    }

    /// Renders the active bottom-nav destination as a full tab root. Destinations
    /// that own their `NavigationStack` render directly; the rest are wrapped so
    /// they always expose a drawer button.
    @ViewBuilder
    private func tabRoot(for destination: DrawerDestination) -> some View {
        switch destination {
        case .home: DashboardView()
        case .contacts: ContactsView()
        case .scan: ScanView()
        case .notes: NotesView()
        case .myCard: MyCardView()
        case .agents: AgentsView()
        case .leads: wrappedRoot { PipelineView() }
        case .events: wrappedRoot { EventsView() }
        case .calendar: wrappedRoot { CalendarView() }
        case .aiChat: wrappedRoot { AIChatView() }
        case .automations: wrappedRoot { AutomationsView() }
        case .admin: wrappedRoot { AdminView() }
        default: DashboardView()
        }
    }

    /// Wraps a destination that lacks its own `NavigationStack` so it renders as a
    /// proper tab root with a leading drawer button.
    @ViewBuilder
    private func wrappedRoot<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        NavigationStack {
            content()
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) { DrawerMenuButton() }
                }
        }
    }

    @ViewBuilder
    private func coverContent(_ route: DrawerDestination) -> some View {
        NavigationStack {
            destinationView(route)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { coverRoute = nil } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 15, weight: .semibold))
                        }
                    }
                }
        }
        .tint(Theme.primary)
        .environment(data)
        .environment(session)
    }

    @ViewBuilder
    private func destinationView(_ route: DrawerDestination) -> some View {
        switch route {
        case .aiChat: AIChatView()
        case .agents: AgentsView()
        case .automations: AutomationsView()
        case .integrations: IntegrationsView()
        case .analytics: AnalyticsView()
        case .leads: PipelineView()
        case .activity: ActivityView()
        case .calendar: CalendarView()
        case .events: EventsView()
        case .phone: PhoneDialerView()
        case .export: ExportView()
        case .admin: AdminView()
        default: EmptyView()
        }
    }
}

// MARK: - Open-destination environment hook

private struct OpenDestinationKey: EnvironmentKey {
    static let defaultValue: (DrawerDestination) -> Void = { _ in }
}

extension EnvironmentValues {
    /// Routes to any app destination the way the drawer does (tab switch, sheet, or cover).
    var openDestination: (DrawerDestination) -> Void {
        get { self[OpenDestinationKey.self] }
        set { self[OpenDestinationKey.self] = newValue }
    }
}

/// Floating glass tab bar with an elevated center button — mirrors the web `BottomNav`.
/// Renders the user's chosen tabs; the middle item becomes the raised center button.
private struct CardrAITabBar: View {
    let tabs: [DrawerDestination]
    let selected: DrawerDestination
    let onSelect: (DrawerDestination) -> Void

    /// Index of the raised center item (the middle of the list), matching the web.
    private var centerIndex: Int { tabs.isEmpty ? 0 : tabs.count / 2 }

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            ForEach(Array(tabs.enumerated()), id: \.element) { index, tab in
                if index == centerIndex {
                    centerButton(tab)
                        .frame(maxWidth: .infinity)
                } else {
                    tabItem(tab)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(Theme.border.opacity(0.6), lineWidth: 1)
        )
        .shadow(color: Theme.ink.opacity(0.08), radius: 18, y: 8)
        .padding(.horizontal, 14)
        .padding(.bottom, 6)
    }

    private func tabItem(_ tab: DrawerDestination) -> some View {
        let isActive = selected == tab
        return Button {
            onSelect(tab)
        } label: {
            VStack(spacing: 3) {
                Image(systemName: tab.icon)
                    .font(.system(size: 18, weight: isActive ? .bold : .medium))
                Text(tab.tabTitle)
                    .font(.system(size: 10, weight: isActive ? .bold : .medium))
                    .lineLimit(1)
            }
            .foregroundStyle(isActive ? Theme.primary : Theme.inkSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isActive ? Theme.primary.opacity(0.1) : .clear)
            )
        }
        .buttonStyle(.plain)
    }

    private func centerButton(_ tab: DrawerDestination) -> some View {
        let isActive = selected == tab
        return Button {
            onSelect(tab)
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    Circle()
                        .fill(Theme.brandGradient)
                        .frame(width: 52, height: 52)
                        .shadow(color: Theme.primary.opacity(0.4), radius: 12, y: 6)
                    Image(systemName: tab.icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .scaleEffect(isActive ? 1.05 : 1)
                Text(tab.tabTitle)
                    .font(.system(size: 10, weight: isActive ? .bold : .medium))
                    .foregroundStyle(isActive ? Theme.primary : Theme.inkSecondary)
                    .lineLimit(1)
            }
            .offset(y: -18)
        }
        .buttonStyle(.plain)
    }
}
