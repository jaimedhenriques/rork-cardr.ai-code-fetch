import Foundation

/// Organization management — members, invitations, domains, and settings.
/// Mirrors the web `useOrganization` hook and `OrgAdmin` panel.
extension DataStore {
    /// Whether the signed-in user is an owner/admin of their org.
    var isOrgAdmin: Bool {
        orgRole == "owner" || orgRole == "admin"
    }

    var isOrgOwner: Bool { orgRole == "owner" }

    /// Loads the org, its members (with profiles), invitations, and domains.
    func loadOrganization() async {
        guard let token, let userId = currentUserId else { return }
        isLoadingOrg = true
        defer { isLoadingOrg = false }
        do {
            let memberships = try await service.fetch(
                [OrgMembership].self,
                table: "org_members",
                token: token,
                query: [
                    URLQueryItem(name: "select", value: "org_id,role"),
                    URLQueryItem(name: "user_id", value: "eq.\(userId)"),
                    URLQueryItem(name: "limit", value: "1"),
                ]
            )
            guard let membership = memberships.first else {
                organization = nil
                orgMembers = []
                orgInvitations = []
                orgDomains = []
                orgId = nil
                orgRole = nil
                return
            }
            orgId = membership.orgId
            orgRole = membership.role

            async let orgRows = service.fetch(
                [Organization].self,
                table: "organizations",
                token: token,
                query: [URLQueryItem(name: "id", value: "eq.\(membership.orgId)")]
            )
            async let memberRows = service.fetch(
                [OrgMember].self,
                table: "org_members",
                token: token,
                query: [URLQueryItem(name: "org_id", value: "eq.\(membership.orgId)")]
            )
            async let inviteRows = service.fetch(
                [OrgInvitation].self,
                table: "org_invitations",
                token: token,
                query: [
                    URLQueryItem(name: "org_id", value: "eq.\(membership.orgId)"),
                    URLQueryItem(name: "order", value: "created_at.desc"),
                ]
            )
            async let domainRows = service.fetch(
                [OrgDomain].self,
                table: "org_domains",
                token: token,
                query: [URLQueryItem(name: "org_id", value: "eq.\(membership.orgId)")]
            )

            let (org, members, invites, domains) = try await (orgRows, memberRows, inviteRows, domainRows)
            organization = org.first
            orgInvitations = invites.filter { $0.isPending }
            orgDomains = domains

            // Resolve member profiles for names/emails.
            let userIds: [String] = members.map { $0.userId }
            var profileMap: [String: MemberProfile] = [:]
            if !userIds.isEmpty {
                let inList = userIds.map { "\"\($0)\"" }.joined(separator: ",")
                let profiles = try await service.fetch(
                    [MemberProfile].self,
                    table: "profiles",
                    token: token,
                    query: [URLQueryItem(name: "id", value: "in.(\(inList))")]
                )
                for profile in profiles { profileMap[profile.id] = profile }
            }
            orgMembers = members.map { member in
                var copy = member
                if let profile = profileMap[member.userId] {
                    copy.name = profile.name
                    copy.email = profile.email
                    copy.company = profile.company
                }
                return copy
            }.sorted { roleRank($0.role) < roleRank($1.role) }
        } catch {
            // Org is optional; keep existing state on failure.
        }
    }

    private func roleRank(_ role: String) -> Int {
        switch role {
        case "owner": return 0
        case "admin": return 1
        default: return 2
        }
    }

    /// Creates an organization with the signed-in user as owner.
    @discardableResult
    func createOrganization(name: String, slug: String) async -> Bool {
        guard let token, let userId = currentUserId else {
            loadError = "You need to be signed in to create an organization."
            return false
        }
        let cleanName = name.trimmingCharacters(in: .whitespaces)
        let cleanSlug = (slug.isEmpty ? name : slug)
            .lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .filter { $0.isLetter || $0.isNumber || $0 == "-" }
        guard !cleanName.isEmpty else { return false }
        do {
            let created = try await service.insertReturning(
                [Organization].self,
                table: "organizations",
                token: token,
                values: [[
                    "name": AnyEncodable(cleanName),
                    "slug": AnyEncodable(cleanSlug),
                    "created_by": AnyEncodable(userId),
                ]]
            )
            guard let org = created.first else { return false }
            try await service.insert(
                table: "org_members",
                token: token,
                values: [
                    "org_id": AnyEncodable(org.id),
                    "user_id": AnyEncodable(userId),
                    "role": AnyEncodable("owner"),
                ]
            )
            await loadOrganization()
            return true
        } catch {
            loadError = "Could not create organization."
            return false
        }
    }

    /// Updates the org's name and slug.
    @discardableResult
    func updateOrganization(name: String, slug: String) async -> Bool {
        guard let token, let orgId else { return false }
        let values: [String: AnyEncodable] = [
            "name": AnyEncodable(name.trimmingCharacters(in: .whitespaces)),
            "slug": AnyEncodable(slug.trimmingCharacters(in: .whitespaces)),
        ]
        do {
            try await service.update(table: "organizations", token: token, match: ["id": orgId], values: values)
            await loadOrganization()
            return true
        } catch {
            loadError = "Could not update organization."
            return false
        }
    }

    /// Invites a member by email + role. Returns a shareable join link on success.
    func inviteMember(email: String, role: String) async -> String? {
        guard let token, let orgId, let userId = currentUserId else {
            loadError = "You need to be an org admin to invite members."
            return nil
        }
        let cleanEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard cleanEmail.contains("@") else {
            loadError = "Enter a valid email address."
            return nil
        }
        do {
            let created = try await service.insertReturning(
                [OrgInvitation].self,
                table: "org_invitations",
                token: token,
                values: [[
                    "org_id": AnyEncodable(orgId),
                    "email": AnyEncodable(cleanEmail),
                    "role": AnyEncodable(role),
                    "invited_by": AnyEncodable(userId),
                ]]
            )
            await loadOrganization()
            if let invite = created.first, let inviteToken = invite.token {
                return "https://cardr.ai/join/\(inviteToken)"
            }
            return ""
        } catch {
            loadError = "Could not send the invitation."
            return nil
        }
    }

    /// Cancels a pending invitation.
    func cancelInvitation(_ invitation: OrgInvitation) async {
        guard let token else { return }
        let previous = orgInvitations
        orgInvitations.removeAll { $0.id == invitation.id }
        do {
            try await service.delete(table: "org_invitations", token: token, match: ["id": invitation.id])
        } catch {
            orgInvitations = previous
            loadError = "Could not cancel the invitation."
        }
    }

    /// Updates a member's role.
    func updateMemberRole(_ member: OrgMember, to role: String) async {
        guard let token else { return }
        guard let index = orgMembers.firstIndex(where: { $0.id == member.id }) else { return }
        let previous = orgMembers[index].role
        orgMembers[index].role = role
        do {
            try await service.update(
                table: "org_members",
                token: token,
                match: ["id": member.id],
                values: ["role": AnyEncodable(role)]
            )
        } catch {
            orgMembers[index].role = previous
            loadError = "Could not update the member's role."
        }
    }

    /// Removes a member from the organization.
    func removeMember(_ member: OrgMember) async {
        guard let token else { return }
        let previous = orgMembers
        orgMembers.removeAll { $0.id == member.id }
        do {
            try await service.delete(table: "org_members", token: token, match: ["id": member.id])
        } catch {
            orgMembers = previous
            loadError = "Could not remove the member."
        }
    }

    /// Adds an email domain to the org (pending DNS verification).
    func addDomain(_ domain: String) async {
        guard let token, let orgId else { return }
        let clean = domain.trimmingCharacters(in: .whitespaces).lowercased()
        guard clean.contains(".") else {
            loadError = "Enter a valid domain."
            return
        }
        do {
            let created = try await service.insertReturning(
                [OrgDomain].self,
                table: "org_domains",
                token: token,
                values: [[
                    "org_id": AnyEncodable(orgId),
                    "domain": AnyEncodable(clean),
                ]]
            )
            orgDomains.append(contentsOf: created)
        } catch {
            loadError = "Could not add the domain."
        }
    }

    /// Removes an email domain from the org.
    func removeDomain(_ domain: OrgDomain) async {
        guard let token else { return }
        let previous = orgDomains
        orgDomains.removeAll { $0.id == domain.id }
        do {
            try await service.delete(table: "org_domains", token: token, match: ["id": domain.id])
        } catch {
            orgDomains = previous
            loadError = "Could not remove the domain."
        }
    }
}
