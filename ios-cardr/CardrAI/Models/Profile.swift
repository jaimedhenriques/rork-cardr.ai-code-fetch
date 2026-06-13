import Foundation

/// The signed-in user's own digital card, mirroring the `profiles` table.
nonisolated struct Profile: Codable, Identifiable, Hashable {
    let id: String
    var name: String?
    var company: String?
    var title: String?
    var email: String?
    var phone: String?
    var linkedin: String?
    var website: String?
    var avatar: String?
    var cardSlug: String?
    var bookingUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, name, company, title, email, phone, linkedin, website, avatar
        case cardSlug = "card_slug"
        case bookingUrl = "booking_url"
    }

    var displayName: String { name?.isEmpty == false ? name! : "Your name" }

    var initials: String {
        let parts = (name ?? "").split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first }.map(String.init)
        return letters.isEmpty ? "?" : letters.joined().uppercased()
    }
}

/// Editable fields for the user's own digital card.
nonisolated struct ProfileDraft {
    var name = ""
    var title = ""
    var company = ""
    var phone = ""
    var website = ""
    var linkedin = ""

    init() {}

    init(from profile: Profile?) {
        name = profile?.name ?? ""
        title = profile?.title ?? ""
        company = profile?.company ?? ""
        phone = profile?.phone ?? ""
        website = profile?.website ?? ""
        linkedin = profile?.linkedin ?? ""
    }
}
