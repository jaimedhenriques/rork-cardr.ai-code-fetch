import SwiftUI

/// Integrations — mirrors the web `Integrations` page. A categorized catalog of
/// connections (automation, CRM, communication, calendar) with a clean native grid.
struct IntegrationsView: View {
    private struct Integration: Identifiable {
        let id: String
        let name: String
        let tagline: String
        let icon: String
        let tint: Color
        let live: Bool
    }

    private struct Category: Identifiable {
        let id: String
        let title: String
        let items: [Integration]
    }

    private let categories: [Category] = [
        Category(id: "automation", title: "Automation", items: [
            Integration(id: "zapier", name: "Zapier", tagline: "Send notes & contacts to 6,000+ apps", icon: "bolt.fill", tint: Color(hex: "FF4F00"), live: true),
            Integration(id: "pipedream", name: "Pipedream", tagline: "Build custom workflows, code or no-code", icon: "point.3.connected.trianglepath.dotted", tint: Color(hex: "1B7E3E"), live: true),
            Integration(id: "webhooks", name: "Custom Webhooks", tagline: "Sign-verified POST to any HTTPS endpoint", icon: "link", tint: Theme.primary, live: true),
        ]),
        Category(id: "crm", title: "CRM & Sales", items: [
            Integration(id: "pipedrive", name: "Pipedrive", tagline: "Native CRM sync — auto-create deals", icon: "briefcase.fill", tint: Theme.ink, live: true),
            Integration(id: "hubspot", name: "HubSpot", tagline: "Push notes as engagements via Zapier", icon: "building.2.fill", tint: Color(hex: "FF7A59"), live: false),
            Integration(id: "salesforce", name: "Salesforce", tagline: "Sync contacts & activities via Zapier", icon: "cloud.fill", tint: Color(hex: "00A1E0"), live: false),
        ]),
        Category(id: "communication", title: "Communication", items: [
            Integration(id: "slack", name: "Slack", tagline: "Alerts for new contacts & follow-ups", icon: "number.square.fill", tint: Color(hex: "4A154B"), live: true),
            Integration(id: "gmail", name: "Gmail", tagline: "Send follow-ups from notes via Zapier", icon: "envelope.fill", tint: Color(hex: "EA4335"), live: false),
        ]),
        Category(id: "calendar", title: "Calendar", items: [
            Integration(id: "gcal", name: "Google Calendar", tagline: "Auto-sync meetings & start recordings", icon: "calendar", tint: Color(hex: "1A73E8"), live: true),
        ]),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                ForEach(categories) { category in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(category.title.uppercased())
                            .font(.system(size: 11, weight: .bold))
                            .tracking(1.2)
                            .foregroundStyle(Theme.inkSecondary.opacity(0.8))
                        ForEach(category.items) { item in
                            row(item)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Integrations")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("CONNECT EVERYTHING")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(Theme.primary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Theme.primary.opacity(0.12))
                .clipShape(Capsule())
            Text("Sync your network")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.ink)
            Text("Push notes & contacts to your CRM in one tap. 6,000+ apps via Zapier and Pipedream.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
        }
        .padding(.top, 4)
    }

    private func row(_ item: Integration) -> some View {
        CardSurface(padding: 14) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(item.tint.opacity(0.14))
                        .frame(width: 48, height: 48)
                    Image(systemName: item.icon)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(item.tint)
                }
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(item.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                        if item.live {
                            Circle().fill(Theme.success).frame(width: 7, height: 7)
                        } else {
                            Text("SOON")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(Theme.inkSecondary)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(Theme.surfaceMuted)
                                .clipShape(Capsule())
                        }
                    }
                    Text(item.tagline)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            }
        }
    }
}
