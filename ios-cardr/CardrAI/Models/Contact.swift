import Foundation

/// A scanned/imported business contact, mirroring the `contacts` table.
nonisolated struct Contact: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var company: String?
    var title: String?
    var email: String?
    var phone: String?
    var mobilePhone: String?
    var workPhone: String?
    var avatar: String?
    var linkedin: String?
    var website: String?
    var location: String?
    var industry: String?
    var notes: String?
    var leadSource: String?
    var conversationStatus: String?
    var nextStep: String?
    var followUpDate: String?
    var stageId: String?
    var enriched: Bool?
    var scannedAt: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, company, title, email, phone, avatar, linkedin, website
        case location, industry, notes, enriched
        case mobilePhone = "mobile_phone"
        case workPhone = "work_phone"
        case leadSource = "lead_source"
        case conversationStatus = "conversation_status"
        case nextStep = "next_step"
        case followUpDate = "follow_up_date"
        case stageId = "stage_id"
        case scannedAt = "scanned_at"
        case createdAt = "created_at"
    }

    var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first }.map(String.init)
        return letters.joined().uppercased()
    }

    var subtitle: String {
        [title, company].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

/// Editable fields used when creating a contact manually.
nonisolated struct ContactDraft {
    var name = ""
    var title = ""
    var company = ""
    var email = ""
    var phone = ""
    var mobilePhone = ""
    var website = ""
    var linkedin = ""
    var location = ""
    var notes = ""

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    init() {}

    /// Pre-fills a draft from an existing contact for editing.
    init(from contact: Contact) {
        name = contact.name
        title = contact.title ?? ""
        company = contact.company ?? ""
        email = contact.email ?? ""
        phone = contact.phone ?? ""
        mobilePhone = contact.mobilePhone ?? ""
        website = contact.website ?? ""
        linkedin = contact.linkedin ?? ""
        location = contact.location ?? ""
        notes = contact.notes ?? ""
    }
}
