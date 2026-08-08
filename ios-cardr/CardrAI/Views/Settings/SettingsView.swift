import SwiftUI

/// Native settings hub mirroring the web `Settings` page — profile summary,
/// preferences, export, plan & usage, and account actions.
struct SettingsView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @State private var showEditCard = false
    @State private var showSignOutConfirm = false
    @State private var showImport = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    profileSummary
                    preferencesSection
                    dataSection
                    planSection
                    accountSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .background(Theme.background)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showEditCard) {
                EditCardView(profile: data.profile)
            }
            .sheet(isPresented: $showImport) { ContactImportView() }
            .confirmationDialog("Sign out of CardrAI?", isPresented: $showSignOutConfirm, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { session.signOut() }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    // MARK: - Profile summary

    private var profileSummary: some View {
        Button { showEditCard = true } label: {
            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.brandGradient)
                    .frame(width: 52, height: 52)
                    .overlay {
                        Text(data.profile?.initials ?? "?")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                VStack(alignment: .leading, spacing: 3) {
                    Text(data.profile?.name?.isEmpty == false ? data.profile!.name! : "Your profile")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(profileSubtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            }
            .padding(16)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: Theme.cardRadius))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cardRadius)
                    .stroke(Theme.border, lineWidth: 1)
            )
            .shadow(color: Theme.ink.opacity(0.05), radius: 12, y: 6)
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var profileSubtitle: String {
        if let title = data.profile?.title, !title.isEmpty {
            if let company = data.profile?.company, !company.isEmpty {
                return "\(title) at \(company)"
            }
            return title
        }
        return data.profile?.email ?? "Tap to edit your card"
    }

    // MARK: - Preferences

    private var preferencesSection: some View {
        SettingsSection(title: "Preferences") {
            NavigationLink { ExportView() } label: {
                SettingsRow(icon: "square.and.arrow.up", tint: Theme.primary, label: "Export contacts & notes")
            }
            .buttonStyle(.plain)
            Divider().background(Theme.border).padding(.leading, 52)
            SettingsRow(icon: "globe", tint: Theme.accent, label: "App language", value: "English")
            Divider().background(Theme.border).padding(.leading, 52)
            SettingsRow(icon: "textformat", tint: Theme.warning, label: "Message templates", upcoming: true)
            Divider().background(Theme.border).padding(.leading, 52)
            NavigationLink { TagsView() } label: {
                SettingsRow(icon: "tag", tint: Theme.success, label: "Tags", value: data.tags.isEmpty ? nil : "\(data.tags.count)")
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Setup / Data

    private var dataSection: some View {
        SettingsSection(title: "Setup") {
            NavigationLink { ApiKeysView() } label: {
                SettingsRow(icon: "sparkles", tint: Theme.primary, label: "Claude remote-control")
            }
            .buttonStyle(.plain)
            Divider().background(Theme.border).padding(.leading, 52)
            Button { showImport = true } label: {
                SettingsRow(icon: "square.and.arrow.down", tint: Theme.accent, label: "Import contacts")
            }
            .buttonStyle(.plain)
            Divider().background(Theme.border).padding(.leading, 52)
            NavigationLink { IntegrationsView() } label: {
                SettingsRow(icon: "puzzlepiece.extension", tint: Theme.success, label: "Integrations")
            }
            .buttonStyle(.plain)
            Divider().background(Theme.border).padding(.leading, 52)
            SettingsRow(icon: "calendar", tint: Theme.warning, label: "Connect calendars", upcoming: true)
        }
    }

    // MARK: - Plan & usage

    private var planSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Plan & usage")
                .font(.system(size: 11, weight: .bold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(Theme.primary)
                .padding(.leading, 4)
            PlanUsageCard()
            SettingsSection(title: "") {
                NavigationLink { PricingView() } label: {
                    SettingsRow(icon: "creditcard", tint: Theme.primary, label: "View all plans")
                }
                .buttonStyle(.plain)
                Divider().background(Theme.border).padding(.leading, 52)
                NavigationLink { ReferralView() } label: {
                    SettingsRow(icon: "gift", tint: Theme.success, label: "Refer a friend")
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        SettingsSection(title: "Account") {
            if let email = session.session?.user.email, !email.isEmpty {
                HStack {
                    Image(systemName: "envelope")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.inkSecondary)
                        .frame(width: 24)
                    Text(email)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                Divider().background(Theme.border).padding(.leading, 52)
            }
            Button { showSignOutConfirm = true } label: {
                HStack(spacing: 12) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.destructive)
                        .frame(width: 24)
                    Text("Sign out")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.destructive)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Divider().background(Theme.border).padding(.leading, 52)
            NavigationLink { SupportView() } label: {
                SettingsRow(icon: "questionmark.circle", tint: Theme.accent, label: "Support")
            }
            .buttonStyle(.plain)
            Divider().background(Theme.border).padding(.leading, 52)
            NavigationLink { PrivacyView() } label: {
                SettingsRow(icon: "lock.shield", tint: Theme.success, label: "Privacy policy")
            }
            .buttonStyle(.plain)
            Divider().background(Theme.border).padding(.leading, 52)
            NavigationLink { DeleteAccountView() } label: {
                HStack(spacing: 12) {
                    Image(systemName: "trash")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.destructive)
                        .frame(width: 24)
                    Text("Delete account")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.destructive)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary.opacity(0.4))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Reusable settings building blocks

/// A grouped, titled card matching the web `card-elevated` section pattern.
struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(Theme.primary)
                .padding(.leading, 4)
            VStack(spacing: 0) { content() }
                .background(Theme.surface)
                .clipShape(.rect(cornerRadius: Theme.cardRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cardRadius)
                        .stroke(Theme.border, lineWidth: 1)
                )
                .shadow(color: Theme.ink.opacity(0.04), radius: 10, y: 5)
        }
    }
}

/// A single settings row with an icon, label, optional value, and "Upcoming" badge.
struct SettingsRow: View {
    let icon: String
    var tint: Color = Theme.primary
    let label: String
    var value: String? = nil
    var upcoming: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(tint.opacity(0.12))
                .frame(width: 28, height: 28)
                .overlay {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(tint)
                }
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(upcoming ? Theme.inkSecondary : Theme.ink)
            if upcoming { UpcomingBadge() }
            Spacer(minLength: 0)
            if let value {
                Text(value)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.inkSecondary)
            }
            if !upcoming {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.4))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
        .opacity(upcoming ? 0.6 : 1)
    }
}
