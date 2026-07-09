import SwiftUI
import UIKit

/// Navigation destinations reachable from the dashboard quick actions.
enum DashboardRoute: Hashable {
    case pipeline
    case export
    case events
    case aiChat
}

struct DashboardView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(\.openURL) private var openURL
    @Environment(\.openDestination) private var openDestination
    @Environment(DashboardLayoutStore.self) private var layout
    @State private var showShareSheet = false
    @State private var showSettings = false
    @State private var showCustomizer = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    ForEach(layout.visibleSectionIds, id: \.self) { id in
                        section(for: id)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
                .animation(.easeInOut(duration: 0.25), value: layout.visibleSectionIds)
            }
            .background(Theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    DrawerMenuButton()
                }
                ToolbarItem(placement: .topBarLeading) {
                    CardrAIWordmark(size: 22)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 2) {
                        NavigationLink(value: DashboardRoute.aiChat) {
                            Image(systemName: "sparkles")
                        }
                        Button { showCustomizer = true } label: {
                            Image(systemName: "slider.horizontal.3")
                        }
                        Button { showSettings = true } label: {
                            Image(systemName: "gearshape")
                        }
                    }
                }
            }
            .refreshable { await data.loadAll() }
            .sheet(isPresented: $showShareSheet) {
                ShareSheet(items: [shareText])
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .sheet(isPresented: $showCustomizer) {
                DashboardCustomizerView(store: layout)
            }
        }
    }

    /// Maps a saved section id to its rendered widget.
    @ViewBuilder
    private func section(for id: String) -> some View {
        switch id {
        case "greeting": hero
        case "stats": statsRow
        case "health": if !data.contacts.isEmpty { networkHealth }
        case "quick_actions": quickActions
        case "recent_contacts": recentSection
        default: EmptyView()
        }
    }

    // MARK: - Hero (mirrors the web DashboardHero)

    private var hero: some View {
        VStack(spacing: 0) {
            heroGreetingRow
            identityStrip.padding(.top, 16)
            shareButton.padding(.top, 12)
            channelPills.padding(.top, 10)
            moreOptions.padding(.top, 8)
        }
        .padding(20)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(Theme.surface)
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(
                        RadialGradient(
                            colors: [Theme.primary.opacity(0.10), .clear],
                            center: .topLeading, startRadius: 0, endRadius: 320
                        )
                    )
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Theme.border.opacity(0.7), lineWidth: 1)
        )
        .shadow(color: Theme.primary.opacity(0.12), radius: 22, x: 0, y: 10)
    }

    private var heroGreetingRow: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Label(data.cardReady ? "Your network" : "Get started", systemImage: "sparkles")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.primary)
                Text(greeting)
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(2)
                Text("\(data.contacts.count) contacts · \(data.enrichedCount) enriched")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.inkSecondary)
                    .monospacedDigit()
                    .contentTransition(.numericText())
            }
            Spacer(minLength: 0)
            avatarTile
        }
    }

    private var avatarTile: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(Theme.brandGradient)
            .frame(width: 48, height: 48)
            .overlay {
                Text(data.profile?.initials ?? "?")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .shadow(color: Theme.primary.opacity(0.5), radius: 12, y: 6)
    }

    private var identityStrip: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Theme.surface)
                .frame(width: 40, height: 40)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Theme.border, lineWidth: 1)
                )
                .overlay {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(data.cardReady ? "Share your digital card" : "Your card isn't ready")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text(data.cardReady ? "One tap to send it anywhere" : "Tap to set up your card")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
        }
        .padding(12)
        .background(Theme.surfaceMuted.opacity(0.7))
        .clipShape(.rect(cornerRadius: 16))
    }

    private var shareButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            showShareSheet = true
        } label: {
            Label("Share now", systemImage: "square.and.arrow.up")
                .font(.system(size: 15, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.brandGradient)
                .foregroundStyle(.white)
                .clipShape(.rect(cornerRadius: 16))
                .shadow(color: Theme.primary.opacity(0.5), radius: 16, y: 8)
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var channelPills: some View {
        HStack(spacing: 8) {
            channelPill("Email", icon: "envelope.fill") {
                open("mailto:?subject=\(encode("My digital card"))&body=\(encode(shareText))")
            }
            channelPill("Message", icon: "message.fill") {
                open("sms:?&body=\(encode(shareText))")
            }
            channelPill("WhatsApp", icon: "bubble.left.fill", tint: Color(hex: "25D366")) {
                open("https://wa.me/?text=\(encode(shareText))")
            }
            channelPill("Copy", icon: "doc.on.doc.fill") {
                UIPasteboard.general.string = data.cardLink
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        }
    }

    private func channelPill(_ label: String, icon: String, tint: Color? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(tint ?? Theme.ink.opacity(0.75))
                Text(label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.ink.opacity(0.7))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Theme.surfaceMuted.opacity(0.6))
            .clipShape(.rect(cornerRadius: 12))
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var moreOptions: some View {
        Button {
            showShareSheet = true
        } label: {
            Label("More options", systemImage: "qrcode")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.plain)
    }

    private var shareText: String {
        "Here's my digital card — \(data.cardLink)"
    }

    private func encode(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? s
    }

    private func open(_ string: String) {
        if let url = URL(string: string) { openURL(url) }
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: 12) {
            statCard(value: "\(data.contacts.count)", label: "Contacts", icon: "person.2.fill", tint: Theme.primary)
            statCard(value: "\(data.thisWeekCount)", label: "This week", icon: "sparkles", tint: Theme.accent)
            statCard(value: "\(data.followUpCount)", label: "Follow-ups", icon: "bell.badge.fill", tint: Theme.warning)
        }
    }

    // MARK: - Quick actions

    private var eventsSubtitle: String {
        let count = data.events.count
        return count == 0 ? "Track conferences" : "\(count) event\(count == 1 ? "" : "s")"
    }

    private let quickActionColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    private var quickActions: some View {
        LazyVGrid(columns: quickActionColumns, spacing: 12) {
            ForEach(layout.quickActions) { action in
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    openDestination(action.destination)
                } label: {
                    quickActionCard(title: action.label, subtitle: quickActionSubtitle(action.id), icon: action.icon, tint: action.tint)
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
        .navigationDestination(for: DashboardRoute.self) { route in
            switch route {
            case .pipeline: PipelineView()
            case .export: ExportView()
            case .events: EventsView()
            case .aiChat: AIChatView()
            }
        }
    }

    /// A live, data-aware subtitle for each quick action card.
    private func quickActionSubtitle(_ id: String) -> String {
        switch id {
        case "pipeline": return "\(data.stagedContactCount) in pipeline"
        case "events": return eventsSubtitle
        case "export": return "CSV · vCard"
        case "scan": return "Capture a card"
        case "card": return data.cardReady ? "Share your card" : "Set up your card"
        case "calendar": return "Your schedule"
        case "contacts": return "\(data.contacts.count) total"
        case "notes": return "Meeting notes"
        case "ai": return "Ask anything"
        case "agents": return "Automate outreach"
        case "automations": return "Workflows"
        case "admin": return "Manage org"
        default: return ""
        }
    }

    private func quickActionCard(title: String, subtitle: String, icon: String, tint: Color) -> some View {
        CardSurface(padding: 14) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 38, height: 38)
                    .background(tint.opacity(0.12))
                    .clipShape(.rect(cornerRadius: 11))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(subtitle)
                        .font(.system(size: 11))
                        .monospacedDigit()
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private func statCard(value: String, label: String, icon: String, tint: Color) -> some View {
        CardSurface(padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                Text(value)
                    .font(.title2.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
                Text(label)
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }

    // MARK: - Recent

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent contacts")
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)

            if data.isLoadingContacts && data.contacts.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 30)
            } else if data.contacts.isEmpty {
                CardSurface {
                    VStack(spacing: 8) {
                        Image(systemName: "camera.viewfinder")
                            .font(.title)
                            .foregroundStyle(Theme.primary)
                        Text("No contacts yet")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text("Scan your first business card to get started.")
                            .font(.caption)
                            .foregroundStyle(Theme.inkSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
            } else {
                ForEach(data.contacts.prefix(5)) { contact in
                    NavigationLink(value: contact) {
                        ContactRow(contact: contact, showEngagement: true)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationDestination(for: Contact.self) { ContactDetailView(contact: $0) }
    }

    private var greeting: String {
        let name = data.profile?.name?.split(separator: " ").first.map(String.init)
        return name.map { "Welcome back, \($0)" } ?? "Welcome back"
    }

    // MARK: - Network health (mirrors the web dashboard "Network health" widget)

    private var tierDistribution: (a: Int, b: Int, c: Int) {
        var a = 0, b = 0, c = 0
        for contact in data.contacts {
            switch Engagement.tier(for: contact) {
            case .a: a += 1
            case .b: b += 1
            case .c: c += 1
            }
        }
        return (a, b, c)
    }

    private var networkHealth: some View {
        let dist = tierDistribution
        let total = max(data.contacts.count, 1)
        return CardSurface {
            VStack(alignment: .leading, spacing: 12) {
                Label("Network health", systemImage: "waveform.path.ecg")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .labelStyle(.titleAndIcon)
                    .tint(Theme.primary)

                GeometryReader { geo in
                    HStack(spacing: 0) {
                        if dist.a > 0 {
                            Rectangle().fill(Theme.success)
                                .frame(width: geo.size.width * CGFloat(dist.a) / CGFloat(total))
                        }
                        if dist.b > 0 {
                            Rectangle().fill(Theme.warning)
                                .frame(width: geo.size.width * CGFloat(dist.b) / CGFloat(total))
                        }
                        if dist.c > 0 {
                            Rectangle().fill(Color(hex: "8A8A93"))
                                .frame(width: geo.size.width * CGFloat(dist.c) / CGFloat(total))
                        }
                    }
                }
                .frame(height: 12)
                .background(Theme.surfaceMuted)
                .clipShape(Capsule())
                .animation(.easeInOut(duration: 0.4), value: dist.a)

                HStack(spacing: 16) {
                    tierLegend(.a, count: dist.a)
                    tierLegend(.b, count: dist.b)
                    tierLegend(.c, count: dist.c)
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private func tierLegend(_ tier: EngagementTier, count: Int) -> some View {
        HStack(spacing: 5) {
            Circle().fill(tier.color).frame(width: 7, height: 7)
            Text("\(count)")
                .font(.system(size: 13, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(tier.color)
                .contentTransition(.numericText())
            Text(tier.label)
                .font(.system(size: 11))
                .foregroundStyle(Theme.inkSecondary)
        }
    }
}
