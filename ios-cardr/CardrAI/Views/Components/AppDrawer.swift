import SwiftUI
import UIKit

/// Every destination reachable from the slide-out drawer. Mirrors the web
/// `AppDrawer` menu (Main / CRM / Profile). Tab destinations switch the bottom
/// tab bar; everything else is presented over the current tab.
enum DrawerDestination: String, Hashable, CaseIterable, Identifiable {
    var id: String { rawValue }

    // Main
    case home, scan, notes, aiChat, agents, automations
    // CRM
    case contacts, leads, activity, calendar, events, export, phone
    // Insights & Profile
    case integrations, analytics, myCard, admin, settings

    var title: String {
        switch self {
        case .home: "Home"
        case .scan: "Scan Badge"
        case .notes: "Notes"
        case .aiChat: "AI Chat"
        case .agents: "Agents"
        case .automations: "Automations"
        case .integrations: "Integrations"
        case .analytics: "Analytics"
        case .contacts: "Contacts"
        case .leads: "Leads"
        case .activity: "Activity"
        case .calendar: "Calendar"
        case .events: "Events"
        case .export: "Export"
        case .phone: "Phone"
        case .myCard: "My Card"
        case .admin: "Admin Panel"
        case .settings: "Settings"
        }
    }

    var icon: String {
        switch self {
        case .home: "house.fill"
        case .scan: "viewfinder"
        case .notes: "note.text"
        case .aiChat: "sparkles"
        case .agents: "cpu"
        case .automations: "arrow.triangle.branch"
        case .integrations: "puzzlepiece.extension.fill"
        case .analytics: "chart.bar.xaxis"
        case .contacts: "person.2.fill"
        case .leads: "arrow.triangle.branch"
        case .activity: "chart.bar.fill"
        case .calendar: "calendar"
        case .events: "flag.fill"
        case .export: "arrow.down.doc.fill"
        case .phone: "phone.fill"
        case .myCard: "person.crop.rectangle.fill"
        case .admin: "building.2.fill"
        case .settings: "gearshape.fill"
        }
    }
}

private struct DrawerSection: Identifiable {
    let id = UUID()
    let label: String
    let items: [DrawerDestination]
}

private let drawerSections: [DrawerSection] = [
    DrawerSection(label: "Main", items: [.home, .scan, .notes, .aiChat, .agents, .automations]),
    DrawerSection(label: "CRM", items: [.contacts, .leads, .activity, .calendar, .events, .phone, .export]),
    DrawerSection(label: "Insights", items: [.integrations, .analytics]),
    DrawerSection(label: "Profile", items: [.myCard, .admin, .settings]),
]

// MARK: - Open-drawer environment hook

private struct OpenDrawerKey: EnvironmentKey {
    static let defaultValue: () -> Void = {}
}

extension EnvironmentValues {
    /// Opens the app's slide-out navigation drawer.
    var openDrawer: () -> Void {
        get { self[OpenDrawerKey.self] }
        set { self[OpenDrawerKey.self] = newValue }
    }
}

/// The hamburger button each primary screen places in its leading toolbar slot.
struct DrawerMenuButton: View {
    @Environment(\.openDrawer) private var openDrawer

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            openDrawer()
        } label: {
            Image(systemName: "line.3.horizontal")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.ink)
        }
        .accessibilityLabel("Open menu")
    }
}

// MARK: - The drawer panel

/// Slide-out navigation drawer mirroring the web `AppDrawer`: a logo header, the
/// signed-in user's identity, three grouped sections, and footer actions.
struct AppDrawerView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(\.openURL) private var openURL
    @Environment(\.openCommandPalette) private var openCommandPalette

    @Binding var isOpen: Bool
    let current: DrawerDestination
    let onSelect: (DrawerDestination) -> Void
    let onSignOut: () -> Void

    private let panelWidth: CGFloat = 290

    var body: some View {
        ZStack(alignment: .leading) {
            if isOpen {
                Color.black.opacity(0.38)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture { close() }

                panel
                    .frame(width: panelWidth)
                    .frame(maxHeight: .infinity)
                    .background(Theme.surface)
                    .overlay(alignment: .trailing) {
                        Rectangle()
                            .fill(Theme.border.opacity(0.6))
                            .frame(width: 1)
                            .ignoresSafeArea()
                    }
                    .ignoresSafeArea(edges: .vertical)
                    .transition(.move(edge: .leading))
                    .shadow(color: Theme.ink.opacity(0.18), radius: 24, x: 8, y: 0)
            }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: isOpen)
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if session.session != nil { identity }
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(drawerSections) { section in
                        sectionView(section)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 14)
            }
            footer
        }
        .padding(.top, 8)
    }

    private var header: some View {
        HStack(spacing: 8) {
            CardrAIWordmark(size: 24)
            Spacer()
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                close()
                openCommandPalette()
            } label: {
                Image(systemName: "command")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(width: 30, height: 30)
                    .background(Theme.surfaceMuted)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open quick switcher")
            Button { close() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(width: 30, height: 30)
                    .background(Theme.surfaceMuted)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, 14)
        .overlay(alignment: .bottom) {
            Divider().background(Theme.border)
        }
    }

    private var identity: some View {
        HStack(spacing: 12) {
            avatar
            VStack(alignment: .leading, spacing: 2) {
                Text(data.profile?.name?.isEmpty == false ? data.profile!.name! : "Your profile")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Text(session.session?.user.email ?? "Signed in")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.inkSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) {
            Divider().background(Theme.border)
        }
    }

    private var avatar: some View {
        Group {
            if let avatar = data.profile?.avatar, let url = URL(string: avatar), !avatar.isEmpty {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    avatarFallback
                }
            } else {
                avatarFallback
            }
        }
        .frame(width: 36, height: 36)
        .clipShape(Circle())
    }

    private var avatarFallback: some View {
        Circle()
            .fill(Theme.brandGradient)
            .overlay {
                Text(data.profile?.initials ?? "?")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
            }
    }

    private func sectionView(_ section: DrawerSection) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(section.label.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(Theme.inkSecondary.opacity(0.7))
                .padding(.horizontal, 12)
                .padding(.bottom, 4)
            ForEach(section.items, id: \.self) { item in
                rowButton(item)
            }
        }
    }

    private func rowButton(_ item: DrawerDestination) -> some View {
        let active = item == current
        return Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onSelect(item)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: item.icon)
                    .font(.system(size: 15, weight: active ? .bold : .medium))
                    .frame(width: 22)
                Text(item.title)
                    .font(.system(size: 14, weight: active ? .semibold : .medium))
                Spacer(minLength: 0)
            }
            .foregroundStyle(active ? Theme.primary : Theme.ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(active ? Theme.primary.opacity(0.1) : .clear)
            )
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var footer: some View {
        VStack(spacing: 2) {
            Divider().background(Theme.border)
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                if let url = URL(string: "mailto:hello@cardr.ai?subject=CardrAI%20Feedback") {
                    openURL(url)
                }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "bubble.left.and.bubble.right")
                        .font(.system(size: 15, weight: .medium))
                        .frame(width: 22)
                    Text("Send Feedback")
                        .font(.system(size: 14, weight: .medium))
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
            }
            .buttonStyle(PressableButtonStyle())
            if session.session != nil {
                Button {
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                    onSignOut()
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.system(size: 15, weight: .medium))
                            .frame(width: 22)
                        Text("Sign Out")
                            .font(.system(size: 14, weight: .medium))
                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(Theme.destructive)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 16)
        .padding(.top, 4)
    }

    private func close() {
        withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) { isOpen = false }
    }
}
