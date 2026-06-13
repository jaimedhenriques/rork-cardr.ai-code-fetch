import Foundation

/// White-label branding for an organization, mirroring the web `org_branding`
/// table and `useOrgBranding` hook.
nonisolated struct OrgBranding: Codable, Hashable {
    var id: String?
    var orgId: String?
    var appName: String
    var tagline: String
    var logoUrl: String?
    var faviconUrl: String?
    var splashUrl: String?
    var primaryColor: String
    var accentColor: String

    enum CodingKeys: String, CodingKey {
        case id
        case orgId = "org_id"
        case appName = "app_name"
        case tagline
        case logoUrl = "logo_url"
        case faviconUrl = "favicon_url"
        case splashUrl = "splash_url"
        case primaryColor = "primary_color"
        case accentColor = "accent_color"
    }

    /// The default CardrAI branding used when an org has none yet.
    static let `default` = OrgBranding(
        id: nil,
        orgId: nil,
        appName: "CardrAI",
        tagline: "Scan. Remember. Close.",
        logoUrl: nil,
        faviconUrl: nil,
        splashUrl: nil,
        primaryColor: "217 91% 60%",
        accentColor: "280 80% 60%"
    )
}

/// A single membership row linking the signed-in user to an organization.
nonisolated struct OrgMembership: Codable, Hashable {
    let orgId: String
    let role: String

    enum CodingKeys: String, CodingKey {
        case orgId = "org_id"
        case role
    }
}

/// Editable draft for branding fields, kept separate from the persisted model.
nonisolated struct BrandingDraft {
    var appName: String
    var tagline: String
    var primaryColor: String
    var accentColor: String

    init(from branding: OrgBranding) {
        appName = branding.appName
        tagline = branding.tagline
        primaryColor = branding.primaryColor
        accentColor = branding.accentColor
    }
}
