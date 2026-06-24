import Foundation

/// Platform (super) admin — read-only-by-design overview plus plan changes.
/// Mirrors the App Store-safe subset of the web `usePlatformAdmin` hook:
/// revenue, coupons, and referral/commission surfaces are intentionally omitted.
extension DataStore {
    /// Checks whether the signed-in user is a platform admin (best-effort).
    func checkPlatformAdmin() async {
        guard let token, let userId = currentUserId else { return }
        do {
            struct AdminRow: Codable { let id: String }
            let rows = try await service.fetch(
                [AdminRow].self,
                table: "platform_admins",
                token: token,
                query: [
                    URLQueryItem(name: "user_id", value: "eq.\(userId)"),
                    URLQueryItem(name: "select", value: "id"),
                    URLQueryItem(name: "limit", value: "1"),
                ]
            )
            isPlatformAdmin = !rows.isEmpty
        } catch {
            isPlatformAdmin = false
        }
    }

    /// Loads platform-wide users, subscriptions, usage, and orgs.
    func loadPlatformData() async {
        guard let token, isPlatformAdmin else { return }
        isLoadingPlatform = true
        defer { isLoadingPlatform = false }
        do {
            async let userRows = service.fetch(
                [PlatformUser].self,
                table: "profiles",
                token: token,
                query: [
                    URLQueryItem(name: "select", value: "id,email,name,company,title,created_at"),
                    URLQueryItem(name: "order", value: "created_at.desc"),
                ]
            )
            async let subRows = service.fetch(
                [PlatformSubscription].self,
                table: "subscriptions",
                token: token,
                query: [URLQueryItem(name: "select", value: "id,user_id,plan,status")]
            )
            async let usageRows = service.fetch(
                [PlatformUsage].self,
                table: "usage_tracking",
                token: token,
                query: [URLQueryItem(name: "order", value: "period_start.desc")]
            )
            async let orgRows = service.fetch(
                [PlatformOrg].self,
                table: "organizations",
                token: token,
                query: [URLQueryItem(name: "order", value: "created_at.desc")]
            )
            async let memberRows = service.fetch(
                [OrgMembership].self,
                table: "org_members",
                token: token,
                query: [URLQueryItem(name: "select", value: "org_id,role")]
            )

            let (users, subs, usage, orgs, members) = try await (userRows, subRows, usageRows, orgRows, memberRows)
            platformUsers = users
            platformSubscriptions = subs
            platformUsage = usage

            var counts: [String: Int] = [:]
            for member in members { counts[member.orgId, default: 0] += 1 }
            platformOrgs = orgs.map { org in
                var copy = org
                copy.memberCount = counts[org.id] ?? 0
                return copy
            }
        } catch {
            loadError = "Could not load platform data."
        }
    }

    /// The current plan for a user (defaults to "starter").
    func plan(for userId: String) -> String {
        platformSubscriptions.first { $0.userId == userId && $0.status == "active" }?.plan
            ?? platformSubscriptions.first { $0.userId == userId }?.plan
            ?? "starter"
    }

    /// Changes a user's plan, inserting or updating their subscription row.
    func changeUserPlan(_ userId: String, to plan: String) async {
        guard let token else { return }
        do {
            if let existing = platformSubscriptions.first(where: { $0.userId == userId }) {
                try await service.update(
                    table: "subscriptions",
                    token: token,
                    match: ["id": existing.id],
                    values: [
                        "plan": AnyEncodable(plan),
                        "status": AnyEncodable("active"),
                        "updated_at": AnyEncodable(ISO8601DateFormatter().string(from: Date())),
                    ]
                )
            } else {
                try await service.insert(
                    table: "subscriptions",
                    token: token,
                    values: [
                        "user_id": AnyEncodable(userId),
                        "plan": AnyEncodable(plan),
                        "status": AnyEncodable("active"),
                    ]
                )
            }
            await loadPlatformData()
        } catch {
            loadError = "Could not change the plan."
        }
    }

    // MARK: - Platform stats

    var platformPaidUsers: Int {
        platformSubscriptions.filter { $0.status == "active" && $0.plan != "free" && $0.plan != "starter" }.count
    }
}
