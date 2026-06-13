import SwiftUI
import UIKit

struct MyCardView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.openURL) private var openURL
    @AppStorage("cardDesign") private var designRaw = CardDesign.gradient.rawValue
    @State private var showShareSheet = false
    @State private var showEdit = false
    @State private var showFullScreen = false
    @State private var revealQR = false
    @State private var nfc = NFCSharingService()
    @State private var showNFCResult = false
    @State private var analytics: CardAnalytics?
    @State private var loadingAnalytics = true

    private var profile: Profile? { data.profile }
    private var design: CardDesign { CardDesign(rawValue: designRaw) ?? .gradient }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    digitalCard
                    designPicker
                    analyticsCard
                    if let profile { detailCard(profile) }
                    shareButtons
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Theme.background)
            .navigationTitle("My Card")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await data.loadProfile() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    DrawerMenuButton()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Edit") { showEdit = true }
                        .fontWeight(.semibold)
                }
            }
            .sheet(isPresented: $showShareSheet) {
                ShareSheet(items: ["Here's my digital card — \(data.cardLink)"])
            }
            .sheet(isPresented: $showEdit) {
                EditCardView(profile: data.profile)
            }
            .onChange(of: nfcStatusKey) { _, _ in
                switch nfc.status {
                case .success:
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    showNFCResult = true
                case .failure:
                    UINotificationFeedbackGenerator().notificationOccurred(.error)
                    showNFCResult = true
                default: break
                }
            }
            .alert("NFC", isPresented: $showNFCResult) {
                Button("OK", role: .cancel) { nfc.reset() }
            } message: {
                Text(nfcMessage)
            }
            .fullScreenCover(isPresented: $showFullScreen) {
                CardShareScreen(
                    name: profile?.displayName ?? "Your name",
                    subtitle: cardSubtitle,
                    link: data.cardLink,
                    design: design
                )
            }
            .onAppear {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.15)) { revealQR = true }
            }
            .task { await loadAnalytics() }
        }
    }

    // MARK: - Digital card

    private var digitalCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("CARDR.AI")
                        .font(.caption2.weight(.bold))
                        .tracking(2.5)
                        .foregroundStyle(design.foregroundSecondary)
                    if let company = profile?.company, !company.isEmpty {
                        Text(company)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(design.foregroundSecondary)
                    }
                }
                Spacer()
                avatarBadge
            }

            Spacer(minLength: 18)

            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(profile?.displayName ?? "Your name")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(design.foreground)
                        .minimumScaleFactor(0.7)
                        .lineLimit(2)
                    if let sub = cardSubtitle {
                        Text(sub)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(design.foregroundSecondary)
                    }
                    if let email = profile?.email, !email.isEmpty {
                        Label(email, systemImage: "envelope.fill")
                            .font(.caption)
                            .foregroundStyle(design.foregroundSecondary)
                            .padding(.top, 2)
                    }
                }
                Spacer()
                qrChip
            }
        }
        .padding(22)
        .frame(height: 230)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(design.background)
        .overlay {
            if design.usesGlassOverlay {
                RoundedRectangle(cornerRadius: 26)
                    .stroke(.white.opacity(0.25), lineWidth: 1)
            }
        }
        .clipShape(.rect(cornerRadius: 26))
        .shadow(color: Theme.ink.opacity(0.18), radius: 22, y: 14)
        .onTapGesture {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            showFullScreen = true
        }
    }

    private var avatarBadge: some View {
        Group {
            if let avatar = profile?.avatar, let url = URL(string: avatar), !avatar.isEmpty {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    initialsCircle
                }
            } else {
                initialsCircle
            }
        }
        .frame(width: 48, height: 48)
        .clipShape(Circle())
        .overlay(Circle().stroke(.white.opacity(0.5), lineWidth: 1.5))
    }

    private var initialsCircle: some View {
        Circle()
            .fill(.white.opacity(0.2))
            .overlay(
                Text(profile?.initials ?? "?")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(design.foreground)
            )
    }

    private var qrChip: some View {
        QRCodeView(string: data.cardLink, foreground: design.qrForeground)
            .frame(width: 64, height: 64)
            .padding(7)
            .background(.white)
            .clipShape(.rect(cornerRadius: 12))
            .shadow(color: .black.opacity(0.15), radius: 6, y: 3)
            .scaleEffect(revealQR ? 1 : 0.6)
            .opacity(revealQR ? 1 : 0)
    }

    // MARK: - Design picker

    private var designPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(CardDesign.allCases) { option in
                    Button {
                        UISelectionFeedbackGenerator().selectionChanged()
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            designRaw = option.rawValue
                        }
                    } label: {
                        VStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(option.background)
                                .frame(width: 52, height: 34)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(design == option ? Theme.primary : Theme.border,
                                                lineWidth: design == option ? 2.5 : 1)
                                )
                            Text(option.label)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(design == option ? Theme.primary : Theme.inkSecondary)
                        }
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }
            .padding(.vertical, 2)
        }
    }

    // MARK: - Detail card

    private func detailCard(_ profile: Profile) -> some View {
        CardSurface {
            VStack(spacing: 0) {
                row("Company", profile.company, "building.2")
                row("Title", profile.title, "briefcase")
                row("Phone", profile.phone, "phone")
                row("Website", profile.website, "globe")
                row("LinkedIn", profile.linkedin, "link", isLast: true)
            }
        }
    }

    @ViewBuilder
    private func row(_ label: String, _ value: String?, _ icon: String, isLast: Bool = false) -> some View {
        if let value, !value.isEmpty {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Image(systemName: icon).foregroundStyle(Theme.inkSecondary).frame(width: 22)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(label).font(.caption).foregroundStyle(Theme.inkSecondary)
                        Text(value).font(.subheadline).foregroundStyle(Theme.ink)
                    }
                    Spacer()
                }
                .padding(.vertical, 10)
                if !isLast { Divider().background(Theme.border) }
            }
        }
    }

    // MARK: - Share buttons

    private var shareButtons: some View {
        VStack(spacing: 10) {
            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                data.recordCardEvent("share", source: "qr_fullscreen")
                showFullScreen = true
            } label: {
                Label("Show QR to share", systemImage: "qrcode")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(Theme.brandGradient)
                    .foregroundStyle(.white)
                    .clipShape(.rect(cornerRadius: 14))
                    .shadow(color: Theme.primary.opacity(0.4), radius: 14, y: 8)
            }
            .buttonStyle(PressableButtonStyle())

            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                data.recordCardEvent("share", source: "share_link")
                showShareSheet = true
            } label: {
                Label("Share link", systemImage: "square.and.arrow.up")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .foregroundStyle(Theme.primary)
                    .background(Theme.primary.opacity(0.1))
                    .clipShape(.rect(cornerRadius: 14))
            }
            .buttonStyle(PressableButtonStyle())

            if NFCSharingService.isAvailable {
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    data.recordCardEvent("share", source: "nfc")
                    nfc.writeCardLink(data.cardLink)
                } label: {
                    Label(nfc.status == .scanning ? "Hold near an NFC tag…" : "Write to NFC tag", systemImage: "wave.3.right.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .foregroundStyle(Theme.ink)
                        .background(Theme.surfaceMuted)
                        .clipShape(.rect(cornerRadius: 14))
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(nfc.status == .scanning)
            }

            if let slug = profile?.cardSlug, !slug.isEmpty {
                Button {
                    if let url = URL(string: "https://cardr.ai/card/\(slug)") { openURL(url) }
                } label: {
                    Label("View public card", systemImage: "safari")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Theme.inkSecondary)
                        .padding(.vertical, 6)
                }
            }
        }
    }

    // MARK: - Analytics

    private func loadAnalytics() async {
        loadingAnalytics = true
        analytics = await data.fetchCardAnalytics()
        loadingAnalytics = false
    }

    private var analyticsCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 6) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.primary)
                    Text("Card Analytics")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                }
                HStack(spacing: 10) {
                    statTile("Views", analytics?.views, "eye.fill", Theme.primary)
                    statTile("Shares", analytics?.shares, "square.and.arrow.up.fill", Theme.accent)
                    statTile("Saves", analytics?.saves, "person.crop.circle.badge.plus", .green)
                }
                if !loadingAnalytics, let analytics, analytics.total == 0 {
                    Text("No activity yet. Share your card to start tracking views.")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
    }

    private func statTile(_ label: String, _ value: Int?, _ icon: String, _ color: Color) -> some View {
        VStack(spacing: 5) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(color)
            Text(loadingAnalytics ? "—" : "\(value ?? 0)")
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.ink)
                .contentTransition(.numericText())
            Text(label.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.surfaceMuted)
        .clipShape(.rect(cornerRadius: 12))
    }

    private var nfcStatusKey: String {
        switch nfc.status {
        case .idle: return "idle"
        case .scanning: return "scanning"
        case .success: return "success"
        case .failure(let message): return "failure-\(message)"
        }
    }

    private var nfcMessage: String {
        switch nfc.status {
        case .success: return "Your card link was written to the tag. Anyone who taps it opens your card."
        case .failure(let message): return message
        default: return ""
        }
    }

    private var cardSubtitle: String? {
        let parts = [profile?.title, profile?.company].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
