import Foundation
import Observation

/// Loads and caches the signed-in user's data (contacts, profile, notes).
@MainActor
@Observable
final class DataStore {
    var contacts: [Contact] = []
    var notes: [MeetingNote] = []
    var profile: Profile?
    var stages: [PipelineStage] = []
    var tags: [Tag] = []
    var contactTags: [ContactTag] = []
    var events: [Event] = []
    var eventContacts: [EventContact] = []
    var agents: [Agent] = []
    var recentAgentRuns: [AgentRun] = []
    var sequences: [AutomationSequence] = []
    var sequenceRuns: [SequenceRun] = []

    /// The event new scans are auto-assigned to, persisted across launches.
    var activeEventId: String? {
        didSet {
            UserDefaults.standard.set(activeEventId, forKey: "cardr.activeEventId")
        }
    }
    /// When on, every new scan is linked to the active event automatically.
    var autoAssignToEvent: Bool {
        didSet {
            UserDefaults.standard.set(autoAssignToEvent, forKey: "cardr.autoAssignToEvent")
        }
    }
    /// Contact IDs saved during the current scanning session (for batch export).
    var sessionContactIds: [String] = []

    // Organization management
    var organization: Organization?
    var orgMembers: [OrgMember] = []
    var orgInvitations: [OrgInvitation] = []
    var orgDomains: [OrgDomain] = []
    var isLoadingOrg = false

    // Platform (super) admin
    var isPlatformAdmin = false
    var platformUsers: [PlatformUser] = []
    var platformSubscriptions: [PlatformSubscription] = []
    var platformUsage: [PlatformUsage] = []
    var platformOrgs: [PlatformOrg] = []
    var isLoadingPlatform = false

    var isLoadingContacts = false
    var isLoadingNotes = false
    var isLoadingStages = false
    var isLoadingTags = false
    var isLoadingEvents = false
    var loadError: String?

    let service = SupabaseService.shared
    private let realtime = RealtimeClient.shared
    private unowned let session: SessionStore
    private var realtimeStarted = false

    init(session: SessionStore) {
        self.session = session
        self.activeEventId = UserDefaults.standard.string(forKey: "cardr.activeEventId")
        self.autoAssignToEvent = (UserDefaults.standard.object(forKey: "cardr.autoAssignToEvent") as? Bool) ?? true
    }

    /// The currently selected active event, if any.
    var activeEvent: Event? {
        guard let activeEventId else { return nil }
        return events.first { $0.id == activeEventId }
    }

    var token: String? { session.accessToken }
    var currentUserId: String? { session.userId }

    // MARK: - Realtime

    /// Opens a Supabase Realtime connection and subscribes to the tables that the
    /// web app keeps live (agent runs) plus the core CRM tables, so changes made
    /// on the web — or by background agents — appear in the app without a refresh.
    func startRealtime() {
        guard let token, let userId = session.userId, !realtimeStarted else { return }
        realtimeStarted = true
        realtime.connect(token: token)
        let scope = "user_id=eq.\(userId)"

        realtime.subscribe(table: "agent_runs", filter: scope) { [weak self] in
            Task { @MainActor in await self?.loadRecentAgentRuns() }
        }
        realtime.subscribe(table: "contacts", filter: scope) { [weak self] in
            Task { @MainActor in await self?.loadContacts() }
        }
        realtime.subscribe(table: "meeting_notes", filter: scope) { [weak self] in
            Task { @MainActor in await self?.loadNotes() }
        }
        realtime.subscribe(table: "events", filter: scope) { [weak self] in
            Task { @MainActor in await self?.loadEvents() }
        }
        realtime.subscribe(table: "event_contacts", filter: scope) { [weak self] in
            Task { @MainActor in await self?.loadEvents() }
        }
        realtime.subscribe(table: "pipeline_stages", filter: scope) { [weak self] in
            Task { @MainActor in await self?.loadStages() }
        }
        realtime.subscribe(table: "agents", filter: scope) { [weak self] in
            Task { @MainActor in await self?.loadAgents() }
        }
    }

    /// Keeps the realtime connection authenticated after a token refresh.
    func refreshRealtimeToken() {
        guard realtimeStarted, let token else { return }
        realtime.updateToken(token)
    }

    /// Closes the realtime connection (on sign out).
    func stopRealtime() {
        guard realtimeStarted else { return }
        realtime.disconnect()
        realtimeStarted = false
    }

    func loadAll() async {
        async let c: Void = loadContacts()
        async let n: Void = loadNotes()
        async let p: Void = loadProfile()
        async let s: Void = loadStages()
        async let t: Void = loadTags()
        async let e: Void = loadEvents()
        _ = await (c, n, p, s, t, e)
    }

    func loadContacts() async {
        guard let token else { return }
        isLoadingContacts = true
        defer { isLoadingContacts = false }
        do {
            contacts = try await service.fetch(
                [Contact].self,
                table: "contacts",
                token: token,
                query: [URLQueryItem(name: "order", value: "created_at.desc")]
            )
        } catch {
            loadError = (error as? LocalizedError)?.errorDescription ?? "Could not load contacts."
        }
    }

    func loadNotes() async {
        guard let token else { return }
        isLoadingNotes = true
        defer { isLoadingNotes = false }
        do {
            notes = try await service.fetch(
                [MeetingNote].self,
                table: "meeting_notes",
                token: token,
                query: [URLQueryItem(name: "order", value: "created_at.desc")]
            )
        } catch {
            loadError = (error as? LocalizedError)?.errorDescription ?? "Could not load notes."
        }
    }

    func loadProfile() async {
        guard let token, let userId = session.userId else { return }
        do {
            let results = try await service.fetch(
                [Profile].self,
                table: "profiles",
                token: token,
                query: [URLQueryItem(name: "id", value: "eq.\(userId)")]
            )
            profile = results.first
        } catch {
            // Profile is optional; ignore load failure silently.
        }
    }

    /// Inserts a new contact for the signed-in user and refreshes the list.
    /// Returns true on success.
    func addContact(_ draft: ContactDraft) async -> Bool {
        guard let token, let userId = session.userId else {
            loadError = "You need to be signed in to add contacts."
            return false
        }
        var values: [String: AnyEncodable] = [
            "user_id": AnyEncodable(userId),
            "name": AnyEncodable(draft.name),
            "scanned_at": AnyEncodable(ISO8601DateFormatter().string(from: Date())),
        ]
        func put(_ key: String, _ value: String?) {
            if let value, !value.trimmingCharacters(in: .whitespaces).isEmpty {
                values[key] = AnyEncodable(value)
            }
        }
        put("company", draft.company)
        put("title", draft.title)
        put("email", draft.email)
        put("phone", draft.phone)
        put("mobile_phone", draft.mobilePhone)
        put("website", draft.website)
        put("linkedin", draft.linkedin)
        put("location", draft.location)
        put("notes", draft.notes)

        do {
            try await service.insert(table: "contacts", token: token, values: values)
            await loadContacts()
            return true
        } catch {
            loadError = (error as? LocalizedError)?.errorDescription ?? "Could not add contact."
            return false
        }
    }

    /// Updates an existing contact and refreshes the list. Returns true on success.
    func updateContact(_ contact: Contact, with draft: ContactDraft) async -> Bool {
        guard let token else {
            loadError = "You need to be signed in to edit contacts."
            return false
        }
        func clean(_ value: String) -> String? {
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            return trimmed.isEmpty ? nil : trimmed
        }
        let values: [String: AnyEncodable] = [
            "name": AnyEncodable(draft.name.trimmingCharacters(in: .whitespaces)),
            "company": AnyEncodable(clean(draft.company)),
            "title": AnyEncodable(clean(draft.title)),
            "email": AnyEncodable(clean(draft.email)),
            "phone": AnyEncodable(clean(draft.phone)),
            "mobile_phone": AnyEncodable(clean(draft.mobilePhone)),
            "website": AnyEncodable(clean(draft.website)),
            "linkedin": AnyEncodable(clean(draft.linkedin)),
            "location": AnyEncodable(clean(draft.location)),
            "notes": AnyEncodable(clean(draft.notes)),
        ]
        do {
            try await service.update(table: "contacts", token: token, match: ["id": contact.id], values: values)
            await loadContacts()
            return true
        } catch {
            loadError = (error as? LocalizedError)?.errorDescription ?? "Could not save changes."
            return false
        }
    }

    func deleteContact(_ contact: Contact) async {
        guard let token else { return }
        let previous = contacts
        contacts.removeAll { $0.id == contact.id }
        do {
            try await service.delete(table: "contacts", token: token, match: ["id": contact.id])
        } catch {
            contacts = previous
            loadError = "Could not delete contact."
        }
    }

    /// Updates the signed-in user's own card/profile and refreshes it.
    func updateProfile(_ draft: ProfileDraft) async -> Bool {
        guard let token, let userId = session.userId else {
            loadError = "You need to be signed in to edit your card."
            return false
        }
        func clean(_ value: String) -> String? {
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            return trimmed.isEmpty ? nil : trimmed
        }
        let values: [String: AnyEncodable] = [
            "name": AnyEncodable(clean(draft.name)),
            "company": AnyEncodable(clean(draft.company)),
            "title": AnyEncodable(clean(draft.title)),
            "phone": AnyEncodable(clean(draft.phone)),
            "website": AnyEncodable(clean(draft.website)),
            "linkedin": AnyEncodable(clean(draft.linkedin)),
        ]
        do {
            try await service.update(table: "profiles", token: token, match: ["id": userId], values: values)
            await loadProfile()
            return true
        } catch {
            loadError = (error as? LocalizedError)?.errorDescription ?? "Could not save your card."
            return false
        }
    }

    // MARK: - Pipeline

    /// Loads the user's pipeline stages, seeding the defaults the first time.
    func loadStages() async {
        guard let token, let userId = session.userId else { return }
        isLoadingStages = true
        defer { isLoadingStages = false }
        do {
            let existing = try await service.fetch(
                [PipelineStage].self,
                table: "pipeline_stages",
                token: token,
                query: [URLQueryItem(name: "order", value: "sort_order")]
            )
            if existing.isEmpty {
                let seeds = PipelineDefaults.stages.map { stage -> [String: AnyEncodable] in
                    [
                        "user_id": AnyEncodable(userId),
                        "name": AnyEncodable(stage.name),
                        "color": AnyEncodable(stage.color),
                        "sort_order": AnyEncodable(stage.sortOrder),
                    ]
                }
                let created = try await service.insertReturning(
                    [PipelineStage].self,
                    table: "pipeline_stages",
                    token: token,
                    values: seeds
                )
                stages = created.sorted { $0.sortOrder < $1.sortOrder }
            } else {
                stages = existing
            }
        } catch {
            // Pipeline is optional; keep existing stages on failure.
        }
    }

    /// Adds a custom stage at the end of the pipeline.
    func addStage(name: String, color: String) async {
        guard let token, let userId = session.userId else { return }
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        do {
            let created = try await service.insertReturning(
                [PipelineStage].self,
                table: "pipeline_stages",
                token: token,
                values: [[
                    "user_id": AnyEncodable(userId),
                    "name": AnyEncodable(trimmed),
                    "color": AnyEncodable(color),
                    "sort_order": AnyEncodable(stages.count),
                ]]
            )
            stages.append(contentsOf: created)
        } catch {
            loadError = "Could not add stage."
        }
    }

    /// Deletes a stage and unassigns any contacts that were in it.
    func deleteStage(_ stage: PipelineStage) async {
        guard let token else { return }
        let previous = stages
        stages.removeAll { $0.id == stage.id }
        do {
            try await service.delete(table: "pipeline_stages", token: token, match: ["id": stage.id])
            for index in contacts.indices where contacts[index].stageId == stage.id {
                contacts[index].stageId = nil
            }
        } catch {
            stages = previous
            loadError = "Could not remove stage."
        }
    }

    /// Moves a contact into a stage (or unassigns it when `stageId` is nil).
    func moveContact(_ contact: Contact, to stageId: String?) async {
        guard let token else { return }
        guard let index = contacts.firstIndex(where: { $0.id == contact.id }) else { return }
        let previous = contacts[index].stageId
        contacts[index].stageId = stageId
        do {
            try await service.update(
                table: "contacts",
                token: token,
                match: ["id": contact.id],
                values: ["stage_id": AnyEncodable(stageId)]
            )
        } catch {
            contacts[index].stageId = previous
            loadError = "Could not move contact."
        }
    }

    func contacts(in stageId: String?) -> [Contact] {
        contacts.filter { $0.stageId == stageId }
    }

    var stagedContactCount: Int {
        contacts.filter { $0.stageId != nil }.count
    }

    // MARK: - Tags

    /// Loads the user's tags and contact-tag links.
    func loadTags() async {
        guard let token else { return }
        isLoadingTags = true
        defer { isLoadingTags = false }
        do {
            async let tagsResult = service.fetch(
                [Tag].self,
                table: "tags",
                token: token,
                query: [URLQueryItem(name: "order", value: "name")]
            )
            async let linksResult = service.fetch(
                [ContactTag].self,
                table: "contact_tags",
                token: token
            )
            let (loadedTags, loadedLinks) = try await (tagsResult, linksResult)
            tags = loadedTags
            contactTags = loadedLinks
        } catch {
            // Tags are optional; keep existing values on failure.
        }
    }

    /// Creates a new tag for the signed-in user. Returns the created tag.
    @discardableResult
    func addTag(name: String, color: String) async -> Tag? {
        guard let token, let userId = session.userId else { return nil }
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        // Avoid duplicates by name (case-insensitive), mirroring the web flow.
        if let existing = tags.first(where: { $0.name.lowercased() == trimmed.lowercased() }) {
            return existing
        }
        do {
            let created = try await service.insertReturning(
                [Tag].self,
                table: "tags",
                token: token,
                values: [[
                    "user_id": AnyEncodable(userId),
                    "name": AnyEncodable(trimmed),
                    "color": AnyEncodable(color),
                ]]
            )
            if let tag = created.first {
                tags.append(tag)
                tags.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
                return tag
            }
        } catch {
            loadError = "Could not create tag."
        }
        return nil
    }

    /// Renames and/or recolors an existing tag.
    func updateTag(_ tag: Tag, name: String, color: String) async {
        guard let token else { return }
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        guard let index = tags.firstIndex(where: { $0.id == tag.id }) else { return }
        let previous = tags[index]
        tags[index].name = trimmed
        tags[index].color = color
        tags.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        do {
            try await service.update(
                table: "tags",
                token: token,
                match: ["id": tag.id],
                values: ["name": AnyEncodable(trimmed), "color": AnyEncodable(color)]
            )
        } catch {
            if let i = tags.firstIndex(where: { $0.id == tag.id }) { tags[i] = previous }
            loadError = "Could not update tag."
        }
    }

    /// Deletes a tag and removes its links locally (DB cascades the join rows).
    func deleteTag(_ tag: Tag) async {
        guard let token else { return }
        let previousTags = tags
        let previousLinks = contactTags
        tags.removeAll { $0.id == tag.id }
        contactTags.removeAll { $0.tagId == tag.id }
        do {
            try await service.delete(table: "contact_tags", token: token, match: ["tag_id": tag.id])
            try await service.delete(table: "tags", token: token, match: ["id": tag.id])
        } catch {
            tags = previousTags
            contactTags = previousLinks
            loadError = "Could not delete tag."
        }
    }

    /// Tags currently applied to a given contact.
    func tags(for contactId: String) -> [Tag] {
        let ids = Set(contactTags.filter { $0.contactId == contactId }.map(\.tagId))
        return tags.filter { ids.contains($0.id) }
    }

    /// Number of contacts a tag is applied to.
    func usageCount(for tag: Tag) -> Int {
        contactTags.filter { $0.tagId == tag.id }.count
    }

    /// Adds or removes a tag from a contact.
    func toggleTag(_ tag: Tag, on contactId: String) async {
        guard let token else { return }
        if let link = contactTags.first(where: { $0.contactId == contactId && $0.tagId == tag.id }) {
            let previous = contactTags
            contactTags.removeAll { $0.id == link.id }
            do {
                try await service.delete(table: "contact_tags", token: token, match: ["id": link.id])
            } catch {
                contactTags = previous
                loadError = "Could not remove tag."
            }
        } else {
            do {
                let created = try await service.insertReturning(
                    [ContactTag].self,
                    table: "contact_tags",
                    token: token,
                    values: [[
                        "contact_id": AnyEncodable(contactId),
                        "tag_id": AnyEncodable(tag.id),
                    ]]
                )
                contactTags.append(contentsOf: created)
            } catch {
                loadError = "Could not add tag."
            }
        }
    }

    // MARK: - Scanning

    /// Structured contact fields returned by the `scan-badge` edge function.
    struct ScanResult {
        var name: String
        var company: String?
        var title: String?
        var email: String?
        var phone: String?
        var linkedin: String?
        var website: String?
        var location: String?
    }

    /// Sends a captured card/badge image to the `scan-badge` edge function and
    /// returns the structured contact it read, mirroring the web scan flow.
    func scanBadge(imageData: Data) async -> ScanResult? {
        guard let token else {
            loadError = "You need to be signed in to scan."
            return nil
        }
        let base64 = "data:image/jpeg;base64," + imageData.base64EncodedString()
        var request = URLRequest(url: SupabaseConfig.functionsURL.appendingPathComponent("scan-badge"))
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let payload: [String: Any] = [
            "imageBase64": base64,
            "preprocessMeta": ["skipped": true, "reason": NSNull(), "guard": "none", "attempts": 1],
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (respData, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                loadError = "Scan is unavailable right now. Please try again."
                return nil
            }
            guard let obj = try? JSONSerialization.jsonObject(with: respData) as? [String: Any] else {
                return nil
            }
            if let message = obj["error"] as? String {
                loadError = message
                return nil
            }
            guard let contact = obj["contact"] as? [String: Any],
                  let name = contact["name"] as? String,
                  !name.trimmingCharacters(in: .whitespaces).isEmpty else {
                return nil
            }
            func value(_ key: String) -> String? {
                guard let str = contact[key] as? String else { return nil }
                let trimmed = str.trimmingCharacters(in: .whitespaces)
                return trimmed.isEmpty ? nil : trimmed
            }
            return ScanResult(
                name: name.trimmingCharacters(in: .whitespaces),
                company: value("company"),
                title: value("title"),
                email: value("email"),
                phone: value("phone"),
                linkedin: value("linkedin"),
                website: value("website"),
                location: value("location")
            )
        } catch {
            loadError = "Could not read the card. Please try again."
            return nil
        }
    }

    /// Inserts a contact captured from a scan, returning the created row so the
    /// caller can navigate to it and kick off background enrichment.
    @discardableResult
    func addScannedContact(_ result: ScanResult) async -> Contact? {
        guard let token, let userId = session.userId else {
            loadError = "You need to be signed in to add contacts."
            return nil
        }
        var values: [String: AnyEncodable] = [
            "user_id": AnyEncodable(userId),
            "name": AnyEncodable(result.name),
            "lead_source": AnyEncodable("scan"),
            "enriched": AnyEncodable(false),
            "scanned_at": AnyEncodable(ISO8601DateFormatter().string(from: Date())),
        ]
        func put(_ key: String, _ value: String?) {
            if let value, !value.trimmingCharacters(in: .whitespaces).isEmpty {
                values[key] = AnyEncodable(value)
            }
        }
        put("company", result.company)
        put("title", result.title)
        put("email", result.email)
        put("phone", result.phone)
        put("linkedin", result.linkedin)
        put("website", result.website)
        put("location", result.location)

        do {
            let created = try await service.insertReturning(
                [Contact].self,
                table: "contacts",
                token: token,
                values: [values]
            )
            if let contact = created.first {
                contacts.insert(contact, at: 0)
                return contact
            }
        } catch {
            loadError = "Could not save contact."
        }
        return nil
    }

    /// Enriches a contact in the background and silently refreshes the list.
    func enrichInBackground(_ contact: Contact) {
        Task { await enrichContact(contact) }
    }

    /// Live progress for a bulk "Enrich All" run (current, total), or nil when idle.
    var bulkEnrichProgress: (current: Int, total: Int)?

    /// Number of contacts that haven't been enriched yet.
    var unenrichedCount: Int {
        contacts.filter { $0.enriched != true }.count
    }

    /// Deletes multiple contacts at once (used by bulk selection).
    func bulkDelete(_ ids: Set<String>) async {
        guard let token, !ids.isEmpty else { return }
        let previous = contacts
        contacts.removeAll { ids.contains($0.id) }
        for id in ids {
            do {
                try await service.delete(table: "contacts", token: token, match: ["id": id])
            } catch {
                contacts = previous
                loadError = "Could not delete contacts."
                return
            }
        }
    }

    /// Applies a tag to every contact in the given set that doesn't already have it.
    func applyTag(_ tag: Tag, to ids: Set<String>) async {
        for id in ids where !contactTags.contains(where: { $0.contactId == id && $0.tagId == tag.id }) {
            await toggleTag(tag, on: id)
        }
    }

    /// Enriches a specific set of selected contacts, publishing progress.
    func enrichContacts(_ ids: Set<String>) async {
        let targets = contacts.filter { ids.contains($0.id) && $0.enriched != true }
        guard !targets.isEmpty, bulkEnrichProgress == nil else { return }
        bulkEnrichProgress = (0, targets.count)
        var done = 0
        for contact in targets {
            await enrichContact(contact)
            done += 1
            bulkEnrichProgress = (done, targets.count)
        }
        bulkEnrichProgress = nil
    }

    /// Groups of likely-duplicate contacts sharing a normalized email or name.
    func duplicateGroups() -> [[Contact]] {
        var byKey: [String: [Contact]] = [:]
        for contact in contacts {
            let email = contact.email?.lowercased().trimmingCharacters(in: .whitespaces)
            let key = (email?.isEmpty == false)
                ? "e:\(email!)"
                : "n:\(contact.name.lowercased().trimmingCharacters(in: .whitespaces))"
            byKey[key, default: []].append(contact)
        }
        return byKey.values
            .filter { $0.count > 1 }
            .map { $0.sorted { ($0.createdAt ?? "") < ($1.createdAt ?? "") } }
            .sorted { $0.count > $1.count }
    }

    /// Distinct lead sources present across contacts (for the filter sheet).
    var leadSources: [String] {
        Array(Set(contacts.compactMap { $0.leadSource?.isEmpty == false ? $0.leadSource : nil })).sorted()
    }

    /// Enriches every not-yet-enriched contact, publishing progress as it goes.
    func enrichAllUnenriched() async {
        let unenriched = contacts.filter { $0.enriched != true }
        guard !unenriched.isEmpty, bulkEnrichProgress == nil else { return }
        bulkEnrichProgress = (0, unenriched.count)
        var done = 0
        for contact in unenriched {
            await enrichContact(contact)
            done += 1
            bulkEnrichProgress = (done, unenriched.count)
        }
        bulkEnrichProgress = nil
    }

    // MARK: - Enrichment

    /// Enriches a contact via the `enrich-contact` edge function and persists any
    /// new fields, mirroring the web flow. Returns true on success.
    @discardableResult
    func enrichContact(_ contact: Contact) async -> Bool {
        guard let token else {
            loadError = "You need to be signed in to enrich contacts."
            return false
        }
        var request = URLRequest(url: SupabaseConfig.functionsURL.appendingPathComponent("enrich-contact"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let payload: [String: Any] = [
            "contact": [
                "name": contact.name,
                "company": contact.company ?? "",
                "title": contact.title ?? "",
                "email": contact.email ?? "",
            ],
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (respData, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                loadError = "Enrichment is unavailable right now."
                return false
            }
            guard let obj = try? JSONSerialization.jsonObject(with: respData) as? [String: Any],
                  let enriched = obj["enriched"] as? [String: Any] else {
                loadError = "No enrichment found for this contact."
                return false
            }

            var values: [String: AnyEncodable] = [
                "enriched": AnyEncodable(true),
                "enriched_at": AnyEncodable(ISO8601DateFormatter().string(from: Date())),
            ]
            func put(_ key: String, _ value: Any?, onlyIfEmpty existing: String? = nil) {
                guard let str = value as? String, !str.isEmpty else { return }
                if let existing, !existing.isEmpty { return }
                values[key] = AnyEncodable(str)
            }
            put("linkedin", enriched["linkedin"])
            put("website", enriched["website"])
            put("location", enriched["location"])
            put("industry", enriched["industry"])
            put("mobile_phone", enriched["mobilePhone"])
            put("work_phone", enriched["workPhone"])
            put("title", enriched["title"], onlyIfEmpty: contact.title)
            put("email", enriched["email"], onlyIfEmpty: contact.email)
            put("phone", enriched["phone"], onlyIfEmpty: contact.phone)
            put("avatar", enriched["avatar"], onlyIfEmpty: contact.avatar)

            try await service.update(table: "contacts", token: token, match: ["id": contact.id], values: values)
            await loadContacts()
            return true
        } catch {
            loadError = "Could not enrich contact."
            return false
        }
    }

    // MARK: - Notes

    /// AI insights returned by the `meeting-notes` edge function.
    struct NoteInsights {
        var summary: String?
        var keyTopics: [String] = []
        var actionItems: [NoteAction] = []
        var followUps: [NoteFollowUp] = []
        var decisions: [String] = []
        var insights: [String] = []
        var mentionedPeople: [MentionedPerson] = []
        var openQuestions: [String] = []
        var analytics: MeetingAnalytics?
    }

    /// Sends recorded audio to the `transcribe-audio` edge function and returns
    /// the transcript text, mirroring the web recorder flow.
    func transcribeAudio(_ audio: Data, language: String = "en") async -> String? {
        guard let token else { return nil }
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: SupabaseConfig.functionsURL.appendingPathComponent("transcribe-audio"))
        request.httpMethod = "POST"
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func appendField(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"recording.m4a\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
        body.append(audio)
        body.append("\r\n".data(using: .utf8)!)
        appendField("langCode", language)
        appendField("language", language)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return nil }
            guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
            return obj["transcript"] as? String
        } catch {
            return nil
        }
    }

    /// Sends recorded audio to the `transcribe-diarize` edge function and returns
    /// a speaker-labelled transcript ([mm:ss] Speaker 1: …) using a server-side
    /// transcription model. Returns nil when no speech could be transcribed.
    func transcribeWithDiarization(_ audio: Data, language: String = "en", fallback: String = "") async -> String? {
        guard let token else { return nil }
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: SupabaseConfig.functionsURL.appendingPathComponent("transcribe-diarize"))
        request.httpMethod = "POST"
        request.timeoutInterval = 120
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func appendField(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"recording.wav\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
        body.append(audio)
        body.append("\r\n".data(using: .utf8)!)
        appendField("langCode", language)
        if !fallback.isEmpty { appendField("fallbackText", fallback) }
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let transcript = obj["transcript"] as? String,
                  !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { return nil }
            return transcript
        } catch {
            return nil
        }
    }

    /// Builds a compact context string describing a single note for AI Q&A.
    nonisolated static func noteContext(_ note: MeetingNote) -> String {
        var lines: [String] = ["Title: \(note.title)"]
        if let s = note.summary, !s.isEmpty { lines.append("Summary: \(s)") }
        if let t = note.keyTopics, !t.isEmpty { lines.append("Key topics: \(t.joined(separator: ", "))") }
        if let a = note.actionItems, !a.isEmpty {
            lines.append("Action items:\n" + a.map { "- \($0.task)" }.joined(separator: "\n"))
        }
        if let d = note.decisions, !d.isEmpty {
            lines.append("Decisions:\n" + d.map { "- \($0)" }.joined(separator: "\n"))
        }
        if let m = note.manualNotes, !m.isEmpty { lines.append("Notes: \(m)") }
        if let tr = note.transcript, !tr.isEmpty { lines.append("Transcript:\n\(tr)") }
        return lines.joined(separator: "\n\n")
    }

    /// Answers a question scoped to a single meeting note, reusing the `ai-chat`
    /// edge function. Tools are disabled so it only reads from the note context.
    func askNote(_ note: MeetingNote, question: String, history: [ChatMessage] = []) async -> String? {
        guard let token else { return nil }
        var request = URLRequest(url: SupabaseConfig.functionsURL.appendingPathComponent("ai-chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var messages: [[String: String]] = [
            ["role": "user", "content": "You are a meeting assistant answering questions about ONE meeting note only. Base every answer strictly on the information below and say so if something isn't covered. Keep answers concise.\n\n\(Self.noteContext(note))"],
            ["role": "assistant", "content": "Got it — ask me anything about this meeting."],
        ]
        messages += history.map { ["role": $0.role.rawValue, "content": $0.content] }
        messages.append(["role": "user", "content": question])

        let body: [String: Any] = [
            "messages": messages,
            "contacts": [],
            "stages": [],
            "notes": [],
            "enableTools": false,
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (bytes, response) = try await URLSession.shared.bytes(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return nil }
            let contentType = (http.value(forHTTPHeaderField: "Content-Type") ?? "").lowercased()
            if contentType.contains("application/json") {
                var raw = Data()
                for try await b in bytes { raw.append(b) }
                if let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
                   let message = obj["message"] as? String, !message.isEmpty {
                    return message
                }
                return nil
            }
            var answer = ""
            for try await line in bytes.lines {
                guard line.hasPrefix("data:") else { continue }
                let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
                if payload == "[DONE]" { break }
                if let d = payload.data(using: .utf8),
                   let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                   let choices = obj["choices"] as? [[String: Any]],
                   let delta = choices.first?["delta"] as? [String: Any],
                   let content = delta["content"] as? String {
                    answer += content
                }
            }
            return answer.isEmpty ? nil : answer
        } catch {
            return nil
        }
    }

    /// Calls the `meeting-notes` edge function to summarise a transcript / notes.
    func generateInsights(transcript: String, durationSeconds: Int, templateId: String? = nil) async -> NoteInsights? {
        guard let token, transcript.trimmingCharacters(in: .whitespacesAndNewlines).count > 10 else { return nil }
        var request = URLRequest(url: SupabaseConfig.functionsURL.appendingPathComponent("meeting-notes"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        var body: [String: Any] = ["transcript": transcript, "durationSeconds": durationSeconds]
        if let templateId { body["templateId"] = templateId }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return nil }
            guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let notes = obj["notes"] as? [String: Any] else { return nil }
            return Self.parseInsights(notes)
        } catch {
            return nil
        }
    }

    /// Creates a meeting note for the signed-in user and refreshes the list.
    /// Returns the created note on success.
    @discardableResult
    func addNote(
        title: String,
        manualNotes: String?,
        transcript: String?,
        durationSeconds: Int,
        insights: NoteInsights?
    ) async -> MeetingNote? {
        guard let token, let userId = session.userId else {
            loadError = "You need to be signed in to save notes."
            return nil
        }
        let cleanTitle = title.trimmingCharacters(in: .whitespaces)
        let resolvedTitle = cleanTitle.isEmpty
            ? (insights?.keyTopics.first ?? "Meeting \(Self.shortDate())")
            : cleanTitle

        var values: [String: AnyEncodable] = [
            "user_id": AnyEncodable(userId),
            "title": AnyEncodable(resolvedTitle),
            "duration_seconds": AnyEncodable(durationSeconds),
        ]
        func put(_ key: String, _ value: String?) {
            if let value, !value.trimmingCharacters(in: .whitespaces).isEmpty {
                values[key] = AnyEncodable(value)
            }
        }
        put("manual_notes", manualNotes)
        put("transcript", transcript)
        put("summary", insights?.summary)
        if let topics = insights?.keyTopics, !topics.isEmpty {
            values["key_topics"] = AnyEncodable(topics)
        }
        if let items = insights?.actionItems, !items.isEmpty {
            values["action_items"] = AnyEncodable(items)
        }
        if let follow = insights?.followUps, !follow.isEmpty {
            values["follow_ups"] = AnyEncodable(follow)
        }
        if let decisions = insights?.decisions, !decisions.isEmpty {
            values["decisions"] = AnyEncodable(decisions)
        }
        if let extra = insights?.insights, !extra.isEmpty {
            values["insights"] = AnyEncodable(extra)
        }
        if let people = insights?.mentionedPeople, !people.isEmpty {
            values["mentioned_people"] = AnyEncodable(people)
        }
        if let questions = insights?.openQuestions, !questions.isEmpty {
            values["open_questions"] = AnyEncodable(questions)
        }
        if let analytics = insights?.analytics, analytics.hasContent {
            values["analytics"] = AnyEncodable(analytics)
        }

        do {
            let created = try await service.insertReturning(
                [MeetingNote].self,
                table: "meeting_notes",
                token: token,
                values: [values]
            )
            if let note = created.first {
                notes.insert(note, at: 0)
                return note
            }
        } catch {
            loadError = "Could not save note."
        }
        return nil
    }

    /// Persists edits to a note (summary, action items, etc.) made in the detail
    /// view. Updates the in-memory copy optimistically and writes changed columns.
    @discardableResult
    func updateNote(_ note: MeetingNote) async -> Bool {
        guard let token else { return false }
        let previous = notes
        if let index = notes.firstIndex(where: { $0.id == note.id }) {
            notes[index] = note
        }
        var values: [String: AnyEncodable] = [
            "title": AnyEncodable(note.title),
        ]
        values["summary"] = AnyEncodable(note.summary ?? "")
        values["action_items"] = AnyEncodable(note.actionItems ?? [])
        values["follow_ups"] = AnyEncodable(note.followUps ?? [])
        values["decisions"] = AnyEncodable(note.decisions ?? [])
        values["key_topics"] = AnyEncodable(note.keyTopics ?? [])
        values["category"] = AnyEncodable(note.category)
        do {
            try await service.update(table: "meeting_notes", token: token, match: ["id": note.id], values: values)
            return true
        } catch {
            notes = previous
            loadError = "Could not save note changes."
            return false
        }
    }

    func deleteNote(_ note: MeetingNote) async {
        guard let token else { return }
        let previous = notes
        notes.removeAll { $0.id == note.id }
        do {
            try await service.delete(table: "meeting_notes", token: token, match: ["id": note.id])
        } catch {
            notes = previous
            loadError = "Could not delete note."
        }
    }

    // MARK: - Card analytics

    /// Records a card analytics event (share/save) keyed by the user's card slug.
    /// Best-effort: failures are ignored so sharing is never disrupted.
    func recordCardEvent(_ eventType: String, source: String? = nil) {
        guard let token, let slug = profile?.cardSlug, !slug.isEmpty else { return }
        var values: [String: AnyEncodable] = [
            "slug": AnyEncodable(slug),
            "event_type": AnyEncodable(eventType),
        ]
        if let userId = session.userId { values["user_id"] = AnyEncodable(userId) }
        if let source { values["source"] = AnyEncodable(source) }
        Task {
            try? await service.insert(table: "card_events", token: token, values: values)
        }
    }

    /// Fetches aggregate view/share/save counts for the user's card slug.
    func fetchCardAnalytics() async -> CardAnalytics? {
        guard let token, let slug = profile?.cardSlug, !slug.isEmpty else { return nil }
        do {
            let rows = try await service.fetch(
                [CardEventRow].self,
                table: "card_events",
                token: token,
                query: [
                    URLQueryItem(name: "slug", value: "eq.\(slug)"),
                    URLQueryItem(name: "select", value: "event_type"),
                    URLQueryItem(name: "limit", value: "5000"),
                ]
            )
            var analytics = CardAnalytics()
            for row in rows {
                switch row.eventType {
                case "view": analytics.views += 1
                case "share": analytics.shares += 1
                case "save_contact": analytics.saves += 1
                default: break
                }
            }
            return analytics
        } catch {
            return nil
        }
    }

    /// Parses the `notes` payload from the `meeting-notes` edge function into a
    /// structured `NoteInsights`, mirroring the web `handleSummarize` mapping.
    private static func parseInsights(_ notes: [String: Any]) -> NoteInsights {
        var result = NoteInsights()
        result.summary = notes["summary"] as? String
        result.keyTopics = (notes["keyTopics"] as? [String]) ?? []
        result.decisions = (notes["decisions"] as? [String]) ?? []
        result.insights = (notes["insights"] as? [String]) ?? []
        result.openQuestions = (notes["openQuestions"] as? [String]) ?? []

        result.actionItems = (notes["actionItems"] as? [Any] ?? []).compactMap { raw in
            if let str = raw as? String { return NoteAction(task: str) }
            guard let obj = raw as? [String: Any], let task = obj["task"] as? String else { return nil }
            return NoteAction(
                task: task,
                owner: obj["owner"] as? String,
                deadline: obj["deadline"] as? String,
                done: obj["done"] as? Bool,
                priority: obj["priority"] as? String
            )
        }

        result.followUps = (notes["followUps"] as? [Any] ?? []).compactMap { raw in
            if let str = raw as? String { return NoteFollowUp(description: str) }
            guard let obj = raw as? [String: Any] else { return nil }
            let desc = (obj["description"] as? String) ?? (obj["task"] as? String) ?? ""
            guard !desc.isEmpty else { return nil }
            return NoteFollowUp(description: desc, with: obj["with"] as? String, urgency: obj["urgency"] as? String)
        }

        result.mentionedPeople = (notes["mentionedPeople"] as? [Any] ?? []).compactMap { raw in
            if let str = raw as? String { return MentionedPerson(name: str) }
            guard let obj = raw as? [String: Any], let name = obj["name"] as? String else { return nil }
            return MentionedPerson(name: name, role: obj["role"] as? String, context: obj["context"] as? String)
        }

        if let analytics = notes["analytics"] as? [String: Any] {
            var parsed = MeetingAnalytics()
            parsed.talkTimeRatio = analytics["talkTimeRatio"] as? [String: Double]
            parsed.questionsAsked = analytics["questionsAsked"] as? Int
            parsed.sentimentScore = analytics["sentimentScore"] as? Double
            parsed.sentimentLabel = analytics["sentimentLabel"] as? String
            parsed.engagementLevel = analytics["engagementLevel"] as? String
            parsed.topSpeaker = analytics["topSpeaker"] as? String
            parsed.keyMetrics = (analytics["keyMetrics"] as? [[String: Any]])?.compactMap { m in
                guard let label = m["label"] as? String, let value = m["value"] as? String else { return nil }
                return NoteMetric(label: label, value: value, icon: m["icon"] as? String)
            }
            if parsed.hasContent { result.analytics = parsed }
        }
        return result
    }

    /// Re-runs the AI on a note's content and persists the refreshed insights.
    /// Returns the updated note on success.
    @discardableResult
    func reanalyzeNote(_ note: MeetingNote, templateId: String? = nil) async -> MeetingNote? {
        let text = note.transcript ?? note.manualNotes ?? ""
        guard text.trimmingCharacters(in: .whitespacesAndNewlines).count > 10 else { return nil }
        let prompt = "Title: \(note.title)\n\n\(text)"
        guard let insights = await generateInsights(
            transcript: prompt,
            durationSeconds: note.durationSeconds ?? 0,
            templateId: templateId
        ) else { return nil }
        guard let token else { return nil }

        var updated = note
        if let summary = insights.summary, !summary.isEmpty { updated.summary = summary }
        if !insights.keyTopics.isEmpty { updated.keyTopics = insights.keyTopics }
        if !insights.actionItems.isEmpty { updated.actionItems = insights.actionItems }
        if !insights.followUps.isEmpty { updated.followUps = insights.followUps }
        if !insights.decisions.isEmpty { updated.decisions = insights.decisions }
        if !insights.insights.isEmpty { updated.insights = insights.insights }
        if !insights.mentionedPeople.isEmpty { updated.mentionedPeople = insights.mentionedPeople }
        if !insights.openQuestions.isEmpty { updated.openQuestions = insights.openQuestions }
        if let analytics = insights.analytics { updated.analytics = analytics }

        var values: [String: AnyEncodable] = [:]
        values["summary"] = AnyEncodable(updated.summary ?? "")
        values["key_topics"] = AnyEncodable(updated.keyTopics ?? [])
        values["action_items"] = AnyEncodable(updated.actionItems ?? [])
        values["follow_ups"] = AnyEncodable(updated.followUps ?? [])
        values["decisions"] = AnyEncodable(updated.decisions ?? [])
        values["insights"] = AnyEncodable(updated.insights ?? [])
        values["mentioned_people"] = AnyEncodable(updated.mentionedPeople ?? [])
        values["open_questions"] = AnyEncodable(updated.openQuestions ?? [])
        if let analytics = updated.analytics { values["analytics"] = AnyEncodable(analytics) }
        do {
            try await service.update(table: "meeting_notes", token: token, match: ["id": note.id], values: values)
            if let index = notes.firstIndex(where: { $0.id == note.id }) { notes[index] = updated }
            return updated
        } catch {
            loadError = "Could not re-analyze note."
            return nil
        }
    }

    private static func shortDate() -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: Date())
    }

    // MARK: - Note ↔ contact linking

    /// Loads the contacts linked to a meeting note via `meeting_participants`.
    func participants(for noteId: String) async -> [MeetingParticipant] {
        guard let token else { return [] }
        do {
            return try await service.fetch(
                [MeetingParticipant].self,
                table: "meeting_participants",
                token: token,
                query: [URLQueryItem(name: "meeting_note_id", value: "eq.\(noteId)")]
            )
        } catch {
            return []
        }
    }

    /// Links a CRM contact to a meeting note. Optionally logs a follow-up
    /// activity on the contact for each open action item so nothing is lost.
    @discardableResult
    func linkContact(_ contact: Contact, toNote note: MeetingNote, createTasks: Bool) async -> MeetingParticipant? {
        guard let token, let userId = session.userId else {
            loadError = "You need to be signed in to link contacts."
            return nil
        }
        let values: [String: AnyEncodable] = [
            "user_id": AnyEncodable(userId),
            "meeting_note_id": AnyEncodable(note.id),
            "contact_id": AnyEncodable(contact.id),
            "name": AnyEncodable(contact.name),
        ]
        do {
            let created = try await service.insertReturning(
                [MeetingParticipant].self,
                table: "meeting_participants",
                token: token,
                values: [values]
            )
            if createTasks, let items = note.actionItems, !items.isEmpty {
                await logFollowUps(items.map(\.task), forContact: contact, note: note, userId: userId, token: token)
            }
            return created.first
        } catch {
            loadError = "Could not link contact to note."
            return nil
        }
    }

    /// Removes a contact link from a meeting note.
    func unlinkParticipant(_ participant: MeetingParticipant) async {
        guard let token else { return }
        do {
            try await service.delete(table: "meeting_participants", token: token, match: ["id": participant.id])
        } catch {
            loadError = "Could not remove the linked contact."
        }
    }

    /// Logs each action item as a contact activity so they surface in the CRM.
    private func logFollowUps(_ items: [String], forContact contact: Contact, note: MeetingNote, userId: String, token: String) async {
        let rows: [[String: AnyEncodable]] = items.map { item in
            [
                "user_id": AnyEncodable(userId),
                "contact_id": AnyEncodable(contact.id),
                "type": AnyEncodable("task"),
                "title": AnyEncodable(item),
                "description": AnyEncodable("From note “\(note.title)”"),
            ]
        }
        guard !rows.isEmpty else { return }
        do {
            try await service.insertReturning(
                [ContactActivityStub].self,
                table: "contact_activities",
                token: token,
                values: rows
            )
        } catch {
            // Activity logging is best-effort; the link still succeeded.
        }
    }

    // MARK: - Events

    /// Loads the user's events and all event-contact links.
    func loadEvents() async {
        guard let token else { return }
        isLoadingEvents = true
        defer { isLoadingEvents = false }
        do {
            async let eventsResult = service.fetch(
                [Event].self,
                table: "events",
                token: token,
                query: [URLQueryItem(name: "order", value: "start_date.desc")]
            )
            async let linksResult = service.fetch(
                [EventContact].self,
                table: "event_contacts",
                token: token
            )
            let (loadedEvents, loadedLinks) = try await (eventsResult, linksResult)
            events = loadedEvents
            eventContacts = loadedLinks
        } catch {
            // Events are optional; keep existing values on failure.
        }
    }

    /// Creates a new event for the signed-in user. Returns the created event.
    @discardableResult
    func addEvent(_ draft: EventDraft) async -> Event? {
        guard let token, let userId = session.userId else {
            loadError = "You need to be signed in to add events."
            return nil
        }
        let trimmed = draft.title.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }

        let iso = ISO8601DateFormatter()
        var values: [String: AnyEncodable] = [
            "user_id": AnyEncodable(userId),
            "title": AnyEncodable(trimmed),
            "event_type": AnyEncodable(draft.eventType),
            "start_date": AnyEncodable(iso.string(from: draft.startDate)),
        ]
        func put(_ key: String, _ value: String) {
            let clean = value.trimmingCharacters(in: .whitespaces)
            if !clean.isEmpty { values[key] = AnyEncodable(clean) }
        }
        put("description", draft.description)
        put("location", draft.location)
        put("website", draft.website)
        if draft.hasEndDate {
            values["end_date"] = AnyEncodable(iso.string(from: draft.endDate))
        }

        do {
            let created = try await service.insertReturning(
                [Event].self,
                table: "events",
                token: token,
                values: [values]
            )
            if let event = created.first {
                events.insert(event, at: 0)
                return event
            }
        } catch {
            loadError = "Could not create event."
        }
        return nil
    }

    /// Deletes an event and its contact links.
    func deleteEvent(_ event: Event) async {
        guard let token else { return }
        let previousEvents = events
        let previousLinks = eventContacts
        events.removeAll { $0.id == event.id }
        eventContacts.removeAll { $0.eventId == event.id }
        do {
            try await service.delete(table: "event_contacts", token: token, match: ["event_id": event.id])
            try await service.delete(table: "events", token: token, match: ["id": event.id])
        } catch {
            events = previousEvents
            eventContacts = previousLinks
            loadError = "Could not delete event."
        }
    }

    /// Contacts linked to a given event.
    func contacts(forEvent eventId: String) -> [Contact] {
        let ids = Set(eventContacts.filter { $0.eventId == eventId }.map(\.contactId))
        return contacts.filter { ids.contains($0.id) }
    }

    /// Number of contacts linked to an event.
    func contactCount(forEvent eventId: String) -> Int {
        eventContacts.filter { $0.eventId == eventId }.count
    }

    // MARK: - Event files

    /// Loads the files (passes, badges, tickets) attached to an event.
    func loadEventFiles(_ eventId: String) async -> [EventFile] {
        guard let token else { return [] }
        do {
            return try await service.fetch(
                [EventFile].self,
                table: "event_files",
                token: token,
                query: [
                    URLQueryItem(name: "event_id", value: "eq.\(eventId)"),
                    URLQueryItem(name: "order", value: "created_at.desc"),
                ]
            )
        } catch {
            return []
        }
    }

    /// Uploads a file to the `event-passes` bucket and records it in `event_files`.
    func uploadEventFile(
        eventId: String,
        fileName: String,
        fileExtension: String,
        contentType: String,
        isPdf: Bool,
        bytes: Data
    ) async -> EventFile? {
        guard let token, let userId = session.userId else { return nil }
        let path = "\(userId)/\(eventId)/\(UUID().uuidString).\(fileExtension)"
        do {
            _ = try await service.uploadPublicObject(
                bucket: "event-passes",
                path: path,
                data: bytes,
                contentType: contentType,
                token: token
            )
            let created = try await service.insertReturning(
                [EventFile].self,
                table: "event_files",
                token: token,
                values: [[
                    "event_id": AnyEncodable(eventId),
                    "user_id": AnyEncodable(userId),
                    "file_name": AnyEncodable(fileName),
                    "file_path": AnyEncodable(path),
                    "file_type": AnyEncodable(isPdf ? "pdf" : "image"),
                    "file_size": AnyEncodable(bytes.count),
                ]]
            )
            return created.first
        } catch {
            loadError = "Could not upload file."
            return nil
        }
    }

    /// Removes an event file from storage and the database.
    func deleteEventFile(_ file: EventFile) async {
        guard let token else { return }
        do {
            try await service.delete(table: "event_files", token: token, match: ["id": file.id])
        } catch {
            loadError = "Could not remove file."
        }
    }

    /// Public URL for an event file's stored object.
    func eventFileURL(_ file: EventFile) -> URL {
        SupabaseConfig.publicObjectURL(bucket: "event-passes", path: file.filePath)
    }

    /// Adds or removes a contact from an event.
    func toggleContact(_ contactId: String, on eventId: String) async {
        guard let token, let userId = session.userId else { return }
        if let link = eventContacts.first(where: { $0.eventId == eventId && $0.contactId == contactId }) {
            let previous = eventContacts
            eventContacts.removeAll { $0.id == link.id }
            do {
                try await service.delete(table: "event_contacts", token: token, match: ["id": link.id])
            } catch {
                eventContacts = previous
                loadError = "Could not remove contact."
            }
        } else {
            do {
                let created = try await service.insertReturning(
                    [EventContact].self,
                    table: "event_contacts",
                    token: token,
                    values: [[
                        "event_id": AnyEncodable(eventId),
                        "contact_id": AnyEncodable(contactId),
                        "user_id": AnyEncodable(userId),
                    ]]
                )
                eventContacts.append(contentsOf: created)
            } catch {
                loadError = "Could not add contact."
            }
        }
    }

    /// Builds a plain-text recap of an event, mirroring the web summary.
    func summary(forEvent event: Event) -> String {
        let linked = contacts(forEvent: event.id)
        let industries = Set(linked.compactMap { $0.industry?.isEmpty == false ? $0.industry : nil })
        let companies = Set(linked.compactMap { $0.company?.isEmpty == false ? $0.company : nil })

        var lines: [String] = []
        lines.append("\(event.title) — Event Summary")
        lines.append("")
        lines.append("\(event.formattedDate)")
        if let location = event.location, !location.isEmpty {
            lines.append(location)
        }
        lines.append("")
        lines.append("Key metrics")
        lines.append("• Contacts made: \(linked.count)")
        lines.append("• Companies represented: \(companies.count)")
        lines.append("• Industries covered: \(industries.count)")
        if !companies.isEmpty {
            lines.append("")
            lines.append("Companies")
            for company in companies.sorted() { lines.append("• \(company)") }
        }
        if !linked.isEmpty {
            lines.append("")
            lines.append("Contacts")
            for contact in linked {
                let detail = contact.subtitle.isEmpty ? "" : " — \(contact.subtitle)"
                lines.append("• \(contact.name)\(detail)")
            }
        }
        return lines.joined(separator: "\n")
    }

    var followUpCount: Int {
        contacts.filter { $0.followUpDate != nil }.count
    }

    var enrichedCount: Int {
        contacts.filter { $0.enriched == true }.count
    }

    /// Public share link for the signed-in user's card, mirroring the web `buildCardLink`.
    var cardLink: String {
        let slug = profile?.cardSlug?.isEmpty == false
            ? profile!.cardSlug!
            : (profile?.name?.lowercased().replacingOccurrences(of: " ", with: "-") ?? "card")
        return "https://cardr.ai/card/\(slug)"
    }

    /// Whether the user's card is set up enough to share.
    var cardReady: Bool {
        profile?.name?.isEmpty == false
    }

    // MARK: - Agents

    /// Loads the user's installed agents plus the available templates.
    func loadAgents() async {
        guard let token else { return }
        do {
            agents = try await service.fetch(
                [Agent].self,
                table: "agents",
                token: token,
                query: [URLQueryItem(name: "order", value: "created_at.desc")]
            )
        } catch {
            // Agents are optional; keep existing values on failure.
        }
    }

    /// Loads the most recent agent runs for the live activity feed.
    func loadRecentAgentRuns(limit: Int = 25) async {
        guard let token else { return }
        do {
            recentAgentRuns = try await service.fetch(
                [AgentRun].self,
                table: "agent_runs",
                token: token,
                query: [
                    URLQueryItem(name: "order", value: "created_at.desc"),
                    URLQueryItem(name: "limit", value: String(limit)),
                ]
            )
        } catch {
            // Agent runs are optional; keep existing values on failure.
        }
    }

    /// Looks up the agent name for a given run.
    func agentName(forRun run: AgentRun) -> String {
        agents.first { $0.id == run.agentId }?.name ?? "Agent"
    }

    /// Installed (non-template) agents.
    var myAgents: [Agent] { agents.filter { $0.isTemplate != true } }

    /// Template agents available to install.
    var agentTemplates: [Agent] { agents.filter { $0.isTemplate == true } }

    /// Installs a template agent into the user's account and refreshes.
    func installAgent(_ template: Agent) async {
        guard let token, let userId = session.userId else { return }
        do {
            let created = try await service.insertReturning(
                [Agent].self,
                table: "agents",
                token: token,
                values: [[
                    "user_id": AnyEncodable(userId),
                    "name": AnyEncodable(template.name),
                    "description": AnyEncodable(template.description ?? ""),
                    "type": AnyEncodable(template.type),
                    "system_prompt": AnyEncodable(template.systemPrompt ?? ""),
                    "is_template": AnyEncodable(false),
                    "status": AnyEncodable("active"),
                ]]
            )
            agents.insert(contentsOf: created, at: 0)
        } catch {
            loadError = "Could not install agent."
        }
    }

    /// Toggles an installed agent between active and paused.
    func toggleAgentStatus(_ agent: Agent) async {
        guard let token else { return }
        guard let index = agents.firstIndex(where: { $0.id == agent.id }) else { return }
        let next = agent.isActive ? "paused" : "active"
        let previous = agents[index].status
        agents[index].status = next
        do {
            try await service.update(
                table: "agents",
                token: token,
                match: ["id": agent.id],
                values: ["status": AnyEncodable(next)]
            )
        } catch {
            agents[index].status = previous
            loadError = "Could not update agent."
        }
    }

    /// Removes an installed agent.
    func deleteAgent(_ agent: Agent) async {
        guard let token else { return }
        let previous = agents
        agents.removeAll { $0.id == agent.id }
        do {
            try await service.delete(table: "agents", token: token, match: ["id": agent.id])
        } catch {
            agents = previous
            loadError = "Could not remove agent."
        }
    }

    // MARK: - Automations

    /// Loads the user's outreach sequences and their runs.
    func loadSequences() async {
        guard let token else { return }
        do {
            async let seqResult = service.fetch(
                [AutomationSequence].self,
                table: "automation_sequences",
                token: token,
                query: [URLQueryItem(name: "order", value: "created_at.desc")]
            )
            async let runsResult = service.fetch(
                [SequenceRun].self,
                table: "automation_sequence_runs",
                token: token,
                query: [URLQueryItem(name: "order", value: "created_at.desc")]
            )
            let (loadedSeq, loadedRuns) = try await (seqResult, runsResult)
            sequences = loadedSeq
            sequenceRuns = loadedRuns
        } catch {
            // Automations are optional; keep existing values on failure.
        }
    }

    /// Number of contacts enrolled in a given sequence.
    func runCount(forSequence sequenceId: String) -> Int {
        sequenceRuns.filter { $0.sequenceId == sequenceId }.count
    }

    /// Deletes a sequence and drops its runs locally.
    func deleteSequence(_ sequence: AutomationSequence) async {
        guard let token else { return }
        let previousSeq = sequences
        let previousRuns = sequenceRuns
        sequences.removeAll { $0.id == sequence.id }
        sequenceRuns.removeAll { $0.sequenceId == sequence.id }
        do {
            try await service.delete(table: "automation_sequences", token: token, match: ["id": sequence.id])
        } catch {
            sequences = previousSeq
            sequenceRuns = previousRuns
            loadError = "Could not delete sequence."
        }
    }

    /// Loads meeting notes with their AI analytics for the Analytics dashboard.
    func loadAnalyticsNotes() async -> [AnalyticsNote] {
        guard let token else { return [] }
        do {
            return try await service.fetch(
                [AnalyticsNote].self,
                table: "meeting_notes",
                token: token,
                query: [URLQueryItem(name: "order", value: "created_at.asc")]
            )
        } catch {
            return []
        }
    }

    var thisWeekCount: Int {
        let formatter = ISO8601DateFormatter()
        let weekAgo = Date().addingTimeInterval(-7 * 24 * 3600)
        return contacts.filter {
            guard let raw = $0.createdAt, let date = formatter.date(from: raw) else { return false }
            return date > weekAgo
        }.count
    }

    // MARK: - Import

    /// Where imported rows should be filed.
    enum ImportEventChoice: Equatable {
        case auto          // use each row's own event name (CSV Event column)
        case none          // import as-is, no event
        case existing(String)  // a fixed existing event id
        case new(String)   // create one new event with this name
    }

    /// How to handle rows that match an existing contact.
    enum ImportMergeMode { case merge, skip }

    /// Outcome counters for an import run, mirroring the web summary toast.
    struct ImportSummary {
        var imported = 0
        var merged = 0
        var skipped = 0
        var linked = 0
    }

    /// Live progress for an import run (current, total), or nil when idle.
    var importProgress: (current: Int, total: Int)?

    /// Imports parsed rows: dedupes by email/name, merges or skips duplicates,
    /// and optionally files each contact into an event. Mirrors the web
    /// `ContactImportModal.handleImport`.
    @discardableResult
    func importContacts(
        _ rows: [ParsedImportContact],
        eventChoice: ImportEventChoice,
        mergeMode: ImportMergeMode
    ) async -> ImportSummary {
        var summary = ImportSummary()
        guard let token, let userId = session.userId, !rows.isEmpty else { return summary }

        importProgress = (0, rows.count)
        defer { importProgress = nil }

        // Resolve a single fixed event id when applicable.
        var eventCache: [String: String] = [:]
        var fixedEventId: String?
        switch eventChoice {
        case .new(let name):
            fixedEventId = await ensureEventId(name, cache: &eventCache)
        case .existing(let id):
            fixedEventId = id
        case .auto, .none:
            break
        }

        for (index, row) in rows.enumerated() {
            importProgress = (index + 1, rows.count)

            // Match an existing contact by email, else by name + company.
            let existing = contacts.first { ec in
                if let email = row.email, !email.isEmpty, let ecEmail = ec.email,
                   ecEmail.lowercased() == email.lowercased() { return true }
                if (row.email ?? "").isEmpty,
                   ec.name.lowercased() == row.name.lowercased(),
                   (ec.company ?? "").lowercased() == (row.company ?? "").lowercased() { return true }
                return false
            }

            var contactId: String?

            if let existing {
                if mergeMode == .skip {
                    summary.skipped += 1
                } else {
                    await mergeImported(row, into: existing)
                    summary.merged += 1
                    contactId = existing.id
                }
            } else if let created = await createImportedContact(row, userId: userId, token: token) {
                summary.imported += 1
                contactId = created.id
            } else {
                summary.skipped += 1
            }

            // File into an event.
            if let contactId, eventChoice != .none {
                var targetEventId: String?
                if case .auto = eventChoice {
                    if let name = row.eventName, !name.isEmpty {
                        targetEventId = await ensureEventId(name, cache: &eventCache)
                    }
                } else {
                    targetEventId = fixedEventId
                }
                if let targetEventId,
                   !eventContacts.contains(where: { $0.eventId == targetEventId && $0.contactId == contactId }) {
                    await toggleContact(contactId, on: targetEventId)
                    summary.linked += 1
                }
            }
        }

        await loadContacts()
        return summary
    }

    /// Returns an event id for a name, creating the event if it doesn't exist.
    private func ensureEventId(_ name: String, cache: inout [String: String]) async -> String? {
        let key = name.trimmingCharacters(in: .whitespaces).lowercased()
        guard !key.isEmpty else { return nil }
        if let cached = cache[key] { return cached }
        if let existing = events.first(where: { $0.title.trimmingCharacters(in: .whitespaces).lowercased() == key }) {
            cache[key] = existing.id
            return existing.id
        }
        var draft = EventDraft()
        draft.title = name.trimmingCharacters(in: .whitespaces)
        if let created = await addEvent(draft) {
            cache[key] = created.id
            return created.id
        }
        return nil
    }

    /// Inserts a brand-new contact from an imported row, returning the created row.
    private func createImportedContact(_ row: ParsedImportContact, userId: String, token: String) async -> Contact? {
        var values: [String: AnyEncodable] = [
            "user_id": AnyEncodable(userId),
            "name": AnyEncodable(row.name),
            "lead_source": AnyEncodable("import"),
            "scanned_at": AnyEncodable(ISO8601DateFormatter().string(from: Date())),
        ]
        func put(_ key: String, _ value: String?) {
            if let value, !value.trimmingCharacters(in: .whitespaces).isEmpty {
                values[key] = AnyEncodable(value)
            }
        }
        put("company", row.company)
        put("title", row.title)
        put("email", row.email)
        put("phone", row.phone)
        put("linkedin", row.linkedin)
        put("website", row.website)
        put("location", row.location)
        put("notes", row.notes)
        do {
            let created = try await service.insertReturning(
                [Contact].self,
                table: "contacts",
                token: token,
                values: [values]
            )
            if let contact = created.first {
                contacts.insert(contact, at: 0)
                return contact
            }
        } catch {
            loadError = "Could not import a contact."
        }
        return nil
    }

    /// Fills only blank fields on an existing contact from an imported row.
    private func mergeImported(_ row: ParsedImportContact, into existing: Contact) async {
        guard let token else { return }
        var values: [String: AnyEncodable] = [:]
        func fillBlank(_ key: String, current: String?, incoming: String?) {
            guard (current ?? "").isEmpty, let incoming, !incoming.trimmingCharacters(in: .whitespaces).isEmpty else { return }
            values[key] = AnyEncodable(incoming)
        }
        fillBlank("phone", current: existing.phone, incoming: row.phone)
        fillBlank("company", current: existing.company, incoming: row.company)
        fillBlank("title", current: existing.title, incoming: row.title)
        fillBlank("email", current: existing.email, incoming: row.email)
        fillBlank("linkedin", current: existing.linkedin, incoming: row.linkedin)
        fillBlank("website", current: existing.website, incoming: row.website)
        fillBlank("location", current: existing.location, incoming: row.location)
        if let incomingNotes = row.notes, !incomingNotes.trimmingCharacters(in: .whitespaces).isEmpty {
            let stamp = DateFormatter.localizedString(from: Date(), dateStyle: .medium, timeStyle: .short)
            let block = "\u{1F4E5} Imported [\(stamp)]\n\(incomingNotes)"
            values["notes"] = AnyEncodable(existing.notes?.isEmpty == false ? "\(existing.notes!)\n\n\(block)" : block)
        }
        guard !values.isEmpty else { return }
        do {
            try await service.update(table: "contacts", token: token, match: ["id": existing.id], values: values)
        } catch {
            loadError = "Could not merge a contact."
        }
    }

    // MARK: - Organization branding

    /// The signed-in user's organization id and role (if they belong to one).
    var orgId: String?
    var orgRole: String?
    /// The current org's white-label branding (defaults until loaded/saved).
    var branding: OrgBranding = .default
    var isLoadingBranding = false
    /// Bumped whenever brand colors change so views re-read `Theme` colors.
    var themeVersion = 0

    /// Pushes the current branding colors into the global `Theme`, mirroring the
    /// web `BrandingContext`. Only a saved (custom) branding row overrides the
    /// built-in palette; otherwise the CardrAI defaults are restored.
    private func applyBrandingToTheme() {
        if branding.id != nil {
            Theme.applyBranding(primary: branding.primaryColor, accent: branding.accentColor)
        } else {
            Theme.applyBranding(primary: nil, accent: nil)
        }
        themeVersion += 1
    }

    /// Whether the signed-in user can edit branding (owner/admin of an org).
    var canEditBranding: Bool {
        orgId != nil && (orgRole == "owner" || orgRole == "admin")
    }

    /// Loads the user's org membership and its branding, mirroring `useOrgBranding`.
    func loadBranding() async {
        guard let token, let userId = session.userId else { return }
        isLoadingBranding = true
        defer { isLoadingBranding = false }
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
                orgId = nil
                orgRole = nil
                branding = .default
                return
            }
            orgId = membership.orgId
            orgRole = membership.role
            let rows = try await service.fetch(
                [OrgBranding].self,
                table: "org_branding",
                token: token,
                query: [URLQueryItem(name: "org_id", value: "eq.\(membership.orgId)")]
            )
            branding = rows.first ?? .default
            applyBrandingToTheme()
        } catch {
            // Branding is optional; keep defaults on failure.
        }
    }

    /// Saves branding (insert when none exists, else update). Returns true on success.
    @discardableResult
    func saveBranding(_ draft: BrandingDraft) async -> Bool {
        guard let token, let orgId else {
            loadError = "You need to be in an organization to edit branding."
            return false
        }
        let values: [String: AnyEncodable] = [
            "app_name": AnyEncodable(draft.appName.isEmpty ? "CardrAI" : draft.appName),
            "tagline": AnyEncodable(draft.tagline.isEmpty ? "Scan. Remember. Close." : draft.tagline),
            "primary_color": AnyEncodable(draft.primaryColor),
            "accent_color": AnyEncodable(draft.accentColor),
        ]
        do {
            if branding.id != nil {
                try await service.update(table: "org_branding", token: token, match: ["org_id": orgId], values: values)
            } else {
                var insertValues = values
                insertValues["org_id"] = AnyEncodable(orgId)
                insertValues["logo_url"] = AnyEncodable(branding.logoUrl)
                insertValues["favicon_url"] = AnyEncodable(branding.faviconUrl)
                insertValues["splash_url"] = AnyEncodable(branding.splashUrl)
                let created = try await service.insertReturning(
                    [OrgBranding].self,
                    table: "org_branding",
                    token: token,
                    values: [insertValues]
                )
                if let row = created.first { branding = row }
            }
            await loadBranding()
            return true
        } catch {
            loadError = "Could not save branding."
            return false
        }
    }

    /// Resets branding back to the CardrAI defaults (clears uploaded assets).
    @discardableResult
    func resetBranding() async -> Bool {
        guard let token, let orgId else { return false }
        let values: [String: AnyEncodable] = [
            "app_name": AnyEncodable("CardrAI"),
            "tagline": AnyEncodable("Scan. Remember. Close."),
            "primary_color": AnyEncodable("217 91% 60%"),
            "accent_color": AnyEncodable("280 80% 60%"),
            "logo_url": AnyEncodable(String?.none),
            "favicon_url": AnyEncodable(String?.none),
            "splash_url": AnyEncodable(String?.none),
        ]
        do {
            if branding.id != nil {
                try await service.update(table: "org_branding", token: token, match: ["org_id": orgId], values: values)
            }
            await loadBranding()
            return true
        } catch {
            loadError = "Could not reset branding."
            return false
        }
    }

    /// Uploads a branding asset to storage and saves its public URL. Returns the URL.
    @discardableResult
    func uploadBrandingAsset(_ data: Data, fileExtension: String, contentType: String, type: String) async -> String? {
        guard let token, let orgId else {
            loadError = "You need to be in an organization to upload assets."
            return nil
        }
        let path = "\(orgId)/\(type)-\(Int(Date().timeIntervalSince1970)).\(fileExtension)"
        do {
            let url = try await service.uploadPublicObject(
                bucket: "org-branding",
                path: path,
                data: data,
                contentType: contentType,
                token: token
            )
            let field = type == "logo" ? "logo_url" : type == "favicon" ? "favicon_url" : "splash_url"
            try await service.update(
                table: "org_branding",
                token: token,
                match: ["org_id": orgId],
                values: [field: AnyEncodable(url)]
            )
            await loadBranding()
            return url
        } catch {
            loadError = "Could not upload asset."
            return nil
        }
    }

    // MARK: - Account deletion

    /// Permanently deletes the signed-in user and all their data via the
    /// `delete-account` edge function, mirroring the web DeleteAccount flow.
    /// Returns `nil` on success or a user-facing error message on failure.
    func deleteAccount() async -> String? {
        guard let token else { return "You need to be signed in." }
        var request = URLRequest(url: SupabaseConfig.functionsURL.appendingPathComponent("delete-account"))
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["confirm": "DELETE"])
        do {
            let (respData, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return "Network error. Please try again." }
            if let obj = try? JSONSerialization.jsonObject(with: respData) as? [String: Any],
               let message = obj["error"] as? String, !message.isEmpty {
                return message
            }
            guard (200...299).contains(http.statusCode) else {
                return "Deletion failed. Please try again."
            }
            return nil
        } catch {
            return "Network error. Please try again."
        }
    }
}
