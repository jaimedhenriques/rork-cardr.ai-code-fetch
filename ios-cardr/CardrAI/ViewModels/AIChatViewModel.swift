import Foundation
import Observation

/// A single chat turn in the AI assistant conversation.
nonisolated struct ChatMessage: Identifiable, Equatable {
    enum Role: String { case user, assistant }
    let id = UUID()
    let role: Role
    var content: String
}

/// Drives the native AI assistant, mirroring the web `AIChat` page: it streams
/// responses from the `ai-chat` edge function and executes the same contact
/// tool calls (create / update / delete / move) against the shared `DataStore`.
@MainActor
@Observable
final class AIChatViewModel {
    var messages: [ChatMessage] = []
    var input = ""
    var isLoading = false
    var errorMessage: String?

    /// Prompt chips shown on the empty state — same set as the web app.
    let suggestions = [
        "Give me a monthly networking summary",
        "How many contacts per pipeline stage?",
        "Who should I follow up with?",
        "Summarize all my meeting notes",
        "Show industry breakdown of my contacts",
        "Create a contact named John Smith at Acme Corp",
        "Enrich all my contacts that are missing details",
    ]

    private unowned let session: SessionStore
    private unowned let data: DataStore

    init(session: SessionStore, data: DataStore) {
        self.session = session
        self.data = data
    }

    private var chatURL: URL {
        SupabaseConfig.functionsURL.appendingPathComponent("ai-chat")
    }

    var canSend: Bool {
        !isLoading && !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func send(_ text: String? = nil) async {
        let message = (text ?? input).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !isLoading else { return }

        messages.append(ChatMessage(role: .user, content: message))
        input = ""
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            try await stream(history: messages)
        } catch {
            messages.append(ChatMessage(
                role: .assistant,
                content: "Sorry, I ran into a problem. Please try again."
            ))
        }
    }

    // MARK: - Networking

    private func stream(history: [ChatMessage]) async throws {
        guard let token = session.accessToken else {
            throw SupabaseError.message("You need to be signed in.")
        }

        var request = URLRequest(url: chatURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody(history: history))

        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let http = response as? HTTPURLResponse else { throw SupabaseError.network }
        guard (200...299).contains(http.statusCode) else {
            throw SupabaseError.message("The assistant is unavailable right now.")
        }

        let contentType = (http.value(forHTTPHeaderField: "Content-Type") ?? "").lowercased()

        // Tool-call / non-streaming responses come back as a single JSON object.
        if contentType.contains("application/json") {
            var raw = Data()
            for try await byte in bytes { raw.append(byte) }
            try await handleJSON(raw)
            return
        }

        // Otherwise consume the SSE stream and append deltas live.
        var assistant = ""
        var didAppend = false
        for try await line in bytes.lines {
            guard line.hasPrefix("data:") else { continue }
            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            if payload == "[DONE]" { break }
            guard let delta = parseDelta(payload) else { continue }
            assistant += delta
            if didAppend {
                messages[messages.count - 1].content = assistant
            } else {
                messages.append(ChatMessage(role: .assistant, content: assistant))
                didAppend = true
            }
        }

        if !didAppend && assistant.isEmpty {
            messages.append(ChatMessage(
                role: .assistant,
                content: "I didn't catch that — could you rephrase?"
            ))
        }
    }

    private func requestBody(history: [ChatMessage]) -> [String: Any] {
        let contactsPayload: [[String: Any]] = data.contacts.map { c in
            var dict: [String: Any] = ["id": c.id, "name": c.name]
            if let v = c.title { dict["title"] = v }
            if let v = c.company { dict["company"] = v }
            if let v = c.email { dict["email"] = v }
            if let v = c.phone { dict["phone"] = v }
            if let v = c.linkedin { dict["linkedin"] = v }
            if let v = c.location { dict["location"] = v }
            if let v = c.industry { dict["industry"] = v }
            if let v = c.notes { dict["notes"] = v }
            if let v = c.scannedAt { dict["scannedAt"] = v }
            if let v = c.enriched { dict["enriched"] = v }
            if let v = c.stageId { dict["stageId"] = v }
            if let v = c.conversationStatus { dict["conversationStatus"] = v }
            return dict
        }
        let stagesPayload: [[String: Any]] = data.stages.map { ["id": $0.id, "name": $0.name] }
        let notesPayload: [[String: Any]] = data.notes.prefix(50).map { note in
            var dict: [String: Any] = ["id": note.id, "title": note.title]
            if let v = note.summary { dict["summary"] = v }
            if let v = note.createdAt { dict["created_at"] = v }
            return dict
        }
        return [
            "messages": history.map { ["role": $0.role.rawValue, "content": $0.content] },
            "contacts": contactsPayload,
            "stages": stagesPayload,
            "notes": notesPayload,
            "enableTools": true,
        ]
    }

    // MARK: - Parsing

    private func parseDelta(_ payload: String) -> String? {
        guard let data = payload.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = obj["choices"] as? [[String: Any]],
              let delta = choices.first?["delta"] as? [String: Any],
              let content = delta["content"] as? String
        else { return nil }
        return content
    }

    private func handleJSON(_ raw: Data) async throws {
        guard let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any] else {
            throw SupabaseError.decoding
        }
        if let toolCalls = obj["tool_calls"] as? [[String: Any]] {
            let results = await processToolCalls(toolCalls)
            var text = "Done!\n\n" + results.joined(separator: "\n")
            if let message = obj["message"] as? String, !message.isEmpty {
                text += "\n\n" + message
            }
            messages.append(ChatMessage(role: .assistant, content: text))
            return
        }
        if let message = obj["message"] as? String {
            messages.append(ChatMessage(role: .assistant, content: message))
        }
    }

    // MARK: - Tool calls

    private func processToolCalls(_ calls: [[String: Any]]) async -> [String] {
        var results: [String] = []
        for call in calls {
            let fn = (call["function"] as? [String: Any]) ?? call
            guard let name = fn["name"] as? String else { continue }
            let args = parseArguments(fn["arguments"])

            switch name {
            case "create_contact":
                guard let cname = args["name"] as? String, !cname.isEmpty else {
                    results.append("Skipped a contact with no name.")
                    continue
                }
                var draft = ContactDraft()
                draft.name = cname
                draft.company = (args["company"] as? String) ?? ""
                draft.title = (args["title"] as? String) ?? ""
                draft.email = (args["email"] as? String) ?? ""
                draft.phone = (args["phone"] as? String) ?? ""
                draft.notes = (args["notes"] as? String) ?? ""
                let ok = await data.addContact(draft)
                results.append(ok ? "Created contact: \(cname)" : "Could not create \(cname).")

            case "update_contact":
                if let contact = findContact(args) {
                    var draft = ContactDraft(from: contact)
                    if let v = args["company"] as? String { draft.company = v }
                    if let v = args["title"] as? String { draft.title = v }
                    if let v = args["email"] as? String { draft.email = v }
                    if let v = args["phone"] as? String { draft.phone = v }
                    if let v = args["notes"] as? String { draft.notes = v }
                    let ok = await data.updateContact(contact, with: draft)
                    if let stageId = args["stage_id"] as? String {
                        await data.moveContact(contact, to: stageId)
                    }
                    results.append(ok ? "Updated contact: \(contact.name)" : "Could not update \(contact.name).")
                } else {
                    results.append("Contact not found.")
                }

            case "delete_contact":
                if let contact = findContact(args) {
                    await data.deleteContact(contact)
                    results.append("Deleted contact: \(contact.name)")
                } else {
                    results.append("Contact not found.")
                }

            case "move_contacts_to_stage":
                let stageId = args["stage_id"] as? String
                let names = (args["contact_names"] as? [String]) ?? []
                var moved = 0
                for n in names {
                    if let c = data.contacts.first(where: { $0.name.lowercased() == n.lowercased() }) {
                        await data.moveContact(c, to: stageId)
                        moved += 1
                    }
                }
                results.append("Moved \(moved) contact\(moved == 1 ? "" : "s").")

            case "enrich_contact":
                if let contact = findContact(args) {
                    await data.enrichContact(contact)
                    results.append("Enriched contact: \(contact.name)")
                } else {
                    results.append("Contact not found to enrich.")
                }

            case "enrich_contacts":
                let names = (args["contact_names"] as? [String]) ?? []
                if names.isEmpty {
                    // No names → enrich everyone still missing details.
                    let before = data.unenrichedCount
                    await data.enrichAllUnenriched()
                    results.append(before > 0 ? "Enriched \(before) contact\(before == 1 ? "" : "s")." : "Everyone is already enriched.")
                } else {
                    var enriched = 0
                    for n in names {
                        if let c = data.contacts.first(where: { $0.name.lowercased() == n.lowercased() }) {
                            await data.enrichContact(c)
                            enriched += 1
                        }
                    }
                    results.append("Enriched \(enriched) contact\(enriched == 1 ? "" : "s").")
                }

            default:
                results.append("Action \(name) isn't available on mobile yet.")
            }
        }
        return results
    }

    private func parseArguments(_ value: Any?) -> [String: Any] {
        if let dict = value as? [String: Any] { return dict }
        if let str = value as? String,
           let data = str.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return dict
        }
        return [:]
    }

    private func findContact(_ args: [String: Any]) -> Contact? {
        if let name = args["contact_name"] as? String {
            if let match = data.contacts.first(where: { $0.name.lowercased() == name.lowercased() }) {
                return match
            }
        }
        if let id = args["contact_id"] as? String {
            return data.contacts.first(where: { $0.id == id })
        }
        return nil
    }
}
