import Foundation

/// Scanner-specific helpers: duplicate detection, merging, active-event linking,
/// and scanning-session export — mirroring the web `ScanBadge` flow.
extension DataStore {
    /// A likely duplicate match for a freshly scanned contact.
    struct DuplicateMatch {
        let existing: Contact
        let reason: String
    }

    private func normalized(_ value: String?) -> String {
        (value ?? "").lowercased().filter { $0.isLetter || $0.isNumber }
    }

    private func normalizedPhone(_ value: String?) -> String {
        (value ?? "").filter { $0.isNumber || $0 == "+" }
    }

    /// Finds an existing contact that likely matches the scanned result —
    /// matching first on email, then phone, then name (+ company when present).
    func findDuplicate(for result: ScanResult) -> DuplicateMatch? {
        let email = normalized(result.email)
        let phone = normalizedPhone(result.phone)
        let name = normalized(result.name)
        let company = normalized(result.company)

        if !email.isEmpty, let hit = contacts.first(where: { normalized($0.email) == email }) {
            return DuplicateMatch(existing: hit, reason: "Same email: \(hit.email ?? "")")
        }
        if phone.count >= 7, let hit = contacts.first(where: { normalizedPhone($0.phone) == phone }) {
            return DuplicateMatch(existing: hit, reason: "Same phone: \(hit.phone ?? "")")
        }
        if name.count >= 3, let hit = contacts.first(where: {
            normalized($0.name) == name && (company.isEmpty || normalized($0.company) == company)
        }) {
            return DuplicateMatch(existing: hit, reason: "Same name\(company.isEmpty ? "" : " & company"): \(hit.name)")
        }
        return nil
    }

    /// Merges scanned fields into an existing contact, only filling empty values.
    /// Returns the updated contact on success.
    @discardableResult
    func mergeScanned(_ result: ScanResult, into existing: Contact) async -> Contact? {
        guard let token else { return nil }
        var values: [String: AnyEncodable] = [:]
        func fill(_ key: String, current: String?, scanned: String?) {
            guard (current ?? "").trimmingCharacters(in: .whitespaces).isEmpty else { return }
            if let scanned, !scanned.trimmingCharacters(in: .whitespaces).isEmpty {
                values[key] = AnyEncodable(scanned)
            }
        }
        fill("company", current: existing.company, scanned: result.company)
        fill("title", current: existing.title, scanned: result.title)
        fill("email", current: existing.email, scanned: result.email)
        fill("phone", current: existing.phone, scanned: result.phone)
        fill("linkedin", current: existing.linkedin, scanned: result.linkedin)
        fill("website", current: existing.website, scanned: result.website)
        fill("location", current: existing.location, scanned: result.location)

        guard !values.isEmpty else { return existing }
        do {
            try await service.update(table: "contacts", token: token, match: ["id": existing.id], values: values)
            await loadContacts()
            return contacts.first { $0.id == existing.id } ?? existing
        } catch {
            loadError = "Could not merge contact."
            return nil
        }
    }

    /// Links a contact to the active event (if auto-assign is on and an event is set).
    func linkScannedContactToActiveEvent(_ contact: Contact) async {
        guard autoAssignToEvent, let eventId = activeEventId else { return }
        guard !eventContacts.contains(where: { $0.eventId == eventId && $0.contactId == contact.id }) else { return }
        await toggleContact(contact.id, on: eventId)
    }

    // MARK: - Scanning session

    /// Adds a contact to the current scanning session (deduped).
    func addToSession(_ contactId: String) {
        guard !sessionContactIds.contains(contactId) else { return }
        sessionContactIds.append(contactId)
    }

    /// Clears the current scanning session.
    func clearSession() {
        sessionContactIds.removeAll()
    }

    /// Contacts captured in the current scanning session.
    var sessionContacts: [Contact] {
        contacts.filter { sessionContactIds.contains($0.id) }
    }

    /// Builds a CSV of the current scanning session for download/share.
    func buildSessionCSV() -> String {
        let columns: [(String, (Contact) -> String?)] = [
            ("Name", { $0.name }),
            ("Title", { $0.title }),
            ("Company", { $0.company }),
            ("Email", { $0.email }),
            ("Phone", { $0.phone }),
            ("LinkedIn", { $0.linkedin }),
            ("Website", { $0.website }),
            ("Location", { $0.location }),
            ("Notes", { $0.notes }),
            ("Event", { [weak self] _ in self?.activeEvent?.title }),
        ]
        func esc(_ value: String?) -> String {
            let s = value ?? ""
            if s.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" || $0 == "\r" }) {
                return "\"\(s.replacingOccurrences(of: "\"", with: "\"\""))\""
            }
            return s
        }
        let header = columns.map { $0.0 }.joined(separator: ",")
        let rows = sessionContacts.map { contact in
            columns.map { esc($0.1(contact)) }.joined(separator: ",")
        }
        return ([header] + rows).joined(separator: "\n")
    }

    /// Emails the current scanning session via the `quick-export-contacts` edge
    /// function. Returns true on success.
    func emailSessionExport(to recipient: String) async -> Bool {
        guard let token else { return false }
        let ids = sessionContactIds
        guard !ids.isEmpty else { return false }
        var request = URLRequest(url: SupabaseConfig.functionsURL.appendingPathComponent("quick-export-contacts"))
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let scope = activeEvent?.title ?? "Scanning session — \(Self.exportDate())"
        var payload: [String: Any] = [
            "recipientEmail": recipient,
            "contactIds": ids,
            "scopeLabel": scope,
            "timezone": TimeZone.current.identifier,
        ]
        if let title = activeEvent?.title { payload["eventName"] = title }
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                loadError = "Couldn't send the export."
                return false
            }
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = obj["error"] as? String {
                loadError = message
                return false
            }
            return true
        } catch {
            loadError = "Couldn't send the export."
            return false
        }
    }

    private static func exportDate() -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f.string(from: Date())
    }
}
