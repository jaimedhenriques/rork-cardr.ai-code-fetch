import SwiftUI

/// Super-admin platform dashboard — overview, users (with plan changes), orgs,
/// and usage. App Store safe: no revenue, coupon, or referral surfaces.
struct PlatformAdminView: View {
    @Environment(DataStore.self) private var data

    @State private var tab: PlatformTab = .overview
    @State private var userSearch = ""
    @State private var planFilter: String = "all"

    enum PlatformTab: String, CaseIterable, Identifiable {
        case overview, users, orgs, usage
        var id: String { rawValue }
        var label: String { rawValue.capitalized }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Section", selection: $tab) {
                    ForEach(PlatformTab.allCases) { item in Text(item.label).tag(item) }
                }
                .pickerStyle(.segmented)

                if data.isLoadingPlatform && data.platformUsers.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    switch tab {
                    case .overview: overviewTab
                    case .users: usersTab
                    case .orgs: orgsTab
                    case .usage: usageTab
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Super Admin")
        .navigationBarTitleDisplayMode(.inline)
        .task { await data.loadPlatformData() }
        .refreshable { await data.loadPlatformData() }
    }

    // MARK: - Overview

    private var overviewTab: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            statCard("Total users", "\(data.platformUsers.count)", "person.3.fill", Theme.primary)
            statCard("Paid users", "\(data.platformPaidUsers)", "creditcard.fill", Theme.warning)
            statCard("Organizations", "\(data.platformOrgs.count)", "building.2.fill", Theme.success)
            statCard("Active subs", "\(data.platformSubscriptions.filter { $0.status == "active" }.count)", "checkmark.seal.fill", Theme.accent)
        }
    }

    private func statCard(_ label: String, _ value: String, _ icon: String, _ tint: Color) -> some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(tint)
                Text(value)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.ink)
                Text(label)
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Users

    @ViewBuilder
    private var usersTab: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(Theme.inkSecondary).font(.system(size: 14))
                TextField("Search name, email, company", text: $userSearch)
                    .font(.subheadline)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }
            .padding(.horizontal, 12).frame(height: 40)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))

            Menu {
                Button("All plans") { planFilter = "all" }
                ForEach(PlatformPlan.allCases) { plan in
                    Button(plan.label) { planFilter = plan.rawValue }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(planFilter == "all" ? "All" : planFilter.capitalized)
                        .font(.caption.weight(.semibold))
                    Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 12).frame(height: 40)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
            }
        }

        Text("\(filteredUsers.count) users")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.inkSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)

        ForEach(filteredUsers) { user in
            PlatformUserRow(user: user)
        }
        if filteredUsers.isEmpty {
            Text("No users match your filters.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
        }
    }

    private var filteredUsers: [PlatformUser] {
        var list = data.platformUsers
        let q = userSearch.trimmingCharacters(in: .whitespaces).lowercased()
        if !q.isEmpty {
            list = list.filter {
                ($0.name?.lowercased().contains(q) ?? false)
                    || ($0.email?.lowercased().contains(q) ?? false)
                    || ($0.company?.lowercased().contains(q) ?? false)
            }
        }
        if planFilter != "all" {
            list = list.filter { data.plan(for: $0.id) == planFilter }
        }
        return list
    }

    // MARK: - Orgs

    @ViewBuilder
    private var orgsTab: some View {
        Text("\(data.platformOrgs.count) organizations")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.inkSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
        ForEach(data.platformOrgs) { org in
            CardSurface(padding: 14) {
                HStack(spacing: 12) {
                    Image(systemName: "building.2.fill")
                        .foregroundStyle(Theme.primary)
                        .frame(width: 34, height: 34)
                        .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(org.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text("/\(org.slug)")
                            .font(.caption2)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("\(org.memberCount)/\(org.maxSeats.map(String.init) ?? "∞")")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.ink)
                        Text("seats")
                            .font(.caption2)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }
            }
        }
        if data.platformOrgs.isEmpty {
            Text("No organizations yet.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
        }
    }

    // MARK: - Usage

    @ViewBuilder
    private var usageTab: some View {
        Text("Current period usage")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.inkSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
        ForEach(data.platformUsage) { usage in
            let profile = data.platformUsers.first { $0.id == usage.userId }
            CardSurface(padding: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "chart.bar.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.primary)
                        Text(profile?.displayName ?? String(usage.userId.prefix(8)))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                            .lineLimit(1)
                    }
                    HStack(spacing: 0) {
                        usageMetric("Contacts", usage.contactsCount)
                        usageMetric("Enrich", usage.enrichmentsUsed)
                        usageMetric("Notes", usage.notesCreated)
                        usageMetric("Min", usage.transcriptionMinutesUsed)
                    }
                }
            }
        }
        if data.platformUsage.isEmpty {
            Text("No usage data yet.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
        }
    }

    private func usageMetric(_ label: String, _ value: Int) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.ink)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Platform user row

private struct PlatformUserRow: View {
    @Environment(DataStore.self) private var data
    let user: PlatformUser
    @State private var isChanging = false

    var body: some View {
        CardSurface(padding: 14) {
            HStack(spacing: 12) {
                Text(user.initials)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Theme.brandGradient, in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    if let email = user.email, !email.isEmpty {
                        Text(email)
                            .font(.caption2)
                            .foregroundStyle(Theme.inkSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                if isChanging {
                    ProgressView()
                } else {
                    Menu {
                        ForEach(PlatformPlan.allCases) { plan in
                            Button {
                                changePlan(plan.rawValue)
                            } label: {
                                Label(plan.label, systemImage: currentPlan == plan.rawValue ? "checkmark" : "")
                            }
                        }
                    } label: {
                        Text(currentPlan.uppercased())
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Theme.primary)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Theme.primary.opacity(0.1), in: Capsule())
                    }
                }
            }
        }
    }

    private var currentPlan: String { data.plan(for: user.id) }

    private func changePlan(_ plan: String) {
        guard plan != currentPlan else { return }
        isChanging = true
        Task {
            await data.changeUserPlan(user.id, to: plan)
            isChanging = false
        }
    }
}
