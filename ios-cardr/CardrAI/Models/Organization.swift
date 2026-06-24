import Foundation

/// An organization, mirroring the `organizations` table.
nonisolated struct Organization: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var slug: String
    var domain: String?
    var logoUrl: String?
    var maxSeats: Int?
    var createdBy: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, slug, domain
        case logoUrl = "logo_url"
        case maxSeats = "max_seats"
        case createdBy = "created_by"
        case createdAt = "created_at"
    }
}

/// An `org_members` row, optionally joined with the member's profile.
nonisolated struct OrgMember: Codable, Identifiable, Hashable {
    let id: String
    let orgId: String
    let userId: String
    var role: String
    var joinedAt: String?

    // Joined profile fields (resolved separately).
    var name: String?
    var email: String?
    var company: String?

    enum CodingKeys: String, CodingKey {
        case id, role
        case orgId = "org_id"
        case userId = "user_id"
        case joinedAt = "joined_at"
    }

    var displayName: String {
        if let name, !name.isEmpty { return name }
        if let email, !email.isEmpty { return email }
        return "Member"
    }

    var initials: String {
        let source = displayName
        let parts = source.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first }.map(String.init)
        return letters.joined().uppercased()
    }
}

/// An `org_invitations` row.
nonisolated struct OrgInvitation: Codable, Identifiable, Hashable {
    let id: String
    let orgId: String
    var email: String
    var role: String
    var token: String?
    var acceptedAt: String?
    var expiresAt: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, email, role, token
        case orgId = "org_id"
        case acceptedAt = "accepted_at"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }

    var isPending: Bool { acceptedAt == nil }
}

/// An `org_domains` row.
nonisolated struct OrgDomain: Codable, Identifiable, Hashable {
    let id: String
    let orgId: String
    var domain: String
    var verified: Bool
    var verificationToken: String?

    enum CodingKeys: String, CodingKey {
        case id, domain, verified
        case orgId = "org_id"
        case verificationToken = "verification_token"
    }
}

/// Lightweight profile row used to resolve member names/emails.
nonisolated struct MemberProfile: Codable, Identifiable, Hashable {
    let id: String
    var name: String?
    var email: String?
    var company: String?
}

/// The org role options offered when inviting/changing roles.
nonisolated enum OrgRole: String, CaseIterable, Identifiable {
    case owner, admin, member
    var id: String { rawValue }
    var label: String {
        switch self {
        case .owner: return "Owner"
        case .admin: return "Admin"
        case .member: return "Member"
        }
    }
    var icon: String {
        switch self {
        case .owner: return "crown.fill"
        case .admin: return "checkmark.shield.fill"
        case .member: return "person.fill"
        }
    }
}
