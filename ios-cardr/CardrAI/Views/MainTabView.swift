import SwiftUI

struct MainTabView: View {
    @Environment(SessionStore.self) private var session
    @State private var data: DataStore
    @State private var selection: Tab = .dashboard
    @State private var drawerOpen = false
    @State private var coverRoute: DrawerDestination?
    @State private var showSettings = false
    @State private var showCommandPalette = false
    @State private var pendingCommand: DrawerDestination?
    @State private var pendingSignOut = false

    enum Tab: Hashable, CaseIterable {
        case dashboard, contacts, scan, notes, card

        var title: String {
            switch self {
            case .dashboard: "Home"
            case .contacts: "Contacts"
            case .scan: "Scan"
            case .notes: "Notes"
            case .card: "My Card"
            }
        }

        var icon: String {
            switch self {
            case .dashboard: "square.grid.2x2.fill"
            case .contacts: "person.2.fill"
            case .scan: "camera.viewfinder"
            case .notes: "note.text"
            case .card: "person.crop.rectangle.fill"
            }
        }
    }

    init(session: SessionStore) {
        _data = State(initialValue: DataStore(session: session))
    }

    /// The drawer item currently active, used to highlight the menu.
    private var current: DrawerDestination {
        if let coverRoute { return coverRoute }
        switch selection {
        case .dashboard: return .home
        case .contacts: return .contacts
        case .scan: return .scan
        case .notes: return .notes
        case .card: return .myCard
        }
    }

    var body: some View {
        ZStack {
            Group {
                switch selection {
                case .dashboard: DashboardView()
                case .contacts: ContactsView()
                case .scan: ScanView()
                case .notes: NotesView()
                case .card: MyCardView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom) {
                CardrAITabBar(selection: $selection)
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
        .environment(\.openDrawer) { drawerOpen = true }
        .environment(\.openCommandPalette) { showCommandPalette = true }
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
        if let tab = destination.tab {
            selection = tab
            coverRoute = nil
        } else if destination == .settings {
            showSettings = true
        } else {
            coverRoute = destination
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
        case .export: ExportView()
        case .admin: AdminView()
        default: EmptyView()
        }
    }
}

/// Floating glass tab bar with an elevated center scan button — mirrors the web `BottomNav`.
private struct CardrAITabBar: View {
    @Binding var selection: MainTabView.Tab

    private let order: [MainTabView.Tab] = [.dashboard, .contacts, .scan, .notes, .card]

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            ForEach(order, id: \.self) { tab in
                if tab == .scan {
                    centerButton
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

    private func tabItem(_ tab: MainTabView.Tab) -> some View {
        let isActive = selection == tab
        return Button {
            withAnimation(.snappy(duration: 0.25)) { selection = tab }
        } label: {
            VStack(spacing: 3) {
                Image(systemName: tab.icon)
                    .font(.system(size: 18, weight: isActive ? .bold : .medium))
                Text(tab.title)
                    .font(.system(size: 10, weight: isActive ? .bold : .medium))
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

    private var centerButton: some View {
        let isActive = selection == .scan
        return Button {
            withAnimation(.snappy(duration: 0.25)) { selection = .scan }
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    Circle()
                        .fill(Theme.brandGradient)
                        .frame(width: 52, height: 52)
                        .shadow(color: Theme.primary.opacity(0.4), radius: 12, y: 6)
                    Image(systemName: MainTabView.Tab.scan.icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .scaleEffect(isActive ? 1.05 : 1)
                Text("Scan")
                    .font(.system(size: 10, weight: isActive ? .bold : .medium))
                    .foregroundStyle(isActive ? Theme.primary : Theme.inkSecondary)
            }
            .offset(y: -18)
        }
        .buttonStyle(.plain)
    }
}
