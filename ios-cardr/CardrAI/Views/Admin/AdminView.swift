import SwiftUI

/// Admin panel — mirrors the web `AdminPanel`. Phase 1 shows the account
/// overview and live usage; team management is expanded in a later phase.
struct AdminView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                accountCard
                usageGrid
                breakdown
                Text("ORGANIZATION")
                    .font(.caption2.weight(.bold)).tracking(0.8)
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 6)
                OrgAdminView()
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Admin Panel")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if data.isPlatformAdmin {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        PlatformAdminView()
                    } label: {
                        Image(systemName: "shield.lefthalf.filled")
                    }
                }
            }
        }
        .refreshable { await data.loadAll(); await data.loadOrganization() }
        .task {
            await data.loadOrganization()
            await data.checkPlatformAdmin()
        }
    }

    private var accountCard: some View {
        CardSurface(padding: 18) {
            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.brandGradient)
                    .frame(width: 50, height: 50)
                    .overlay {
                        Text(data.profile?.initials ?? "?")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                VStack(alignment: .leading, spacing: 3) {
                    Text(data.profile?.name?.isEmpty == false ? data.profile!.name! : "Account")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(session.session?.user.email ?? "")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                    Text("Owner")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Theme.primary.opacity(0.12))
                        .clipShape(Capsule())
                        .padding(.top, 2)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var usageGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            stat("Contacts", "\(data.contacts.count)", "person.2.fill", Theme.primary)
            stat("Enriched", "\(data.enrichedCount)", "sparkles", Theme.success)
            stat("Notes", "\(data.notes.count)", "note.text", Theme.accent)
            stat("Events", "\(data.events.count)", "flag.fill", Theme.warning)
        }
    }

    private func stat(_ label: String, _ value: String, _ icon: String, _ tint: Color) -> some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(tint)
                Text(value)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.ink)
                Text(label)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var breakdown: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Pipeline breakdown")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.inkSecondary)
            CardSurface(padding: 16) {
                VStack(spacing: 0) {
                    ForEach(Array(data.stages.enumerated()), id: \.element.id) { index, stage in
                        let count = data.contacts(in: stage.id).count
                        HStack(spacing: 10) {
                            Circle()
                                .fill(Color(hex: String(stage.color.dropFirst())))
                                .frame(width: 10, height: 10)
                            Text(stage.name)
                                .font(.system(size: 14))
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Text("\(count)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.inkSecondary)
                                .monospacedDigit()
                        }
                        .padding(.vertical, 10)
                        if index < data.stages.count - 1 {
                            Divider().background(Theme.border)
                        }
                    }
                    if data.stages.isEmpty {
                        Text("No pipeline stages yet.")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.inkSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 6)
                    }
                }
            }
        }
    }
}
