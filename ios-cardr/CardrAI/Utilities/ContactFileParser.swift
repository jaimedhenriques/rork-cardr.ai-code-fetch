import Foundation

/// Parses contacts from CSV and VCF/vCard text, mirroring the web
/// `ContactImportModal` parsing (quoted fields, header detection, vCards).
enum ContactFileParser {

    // MARK: - CSV

    static func parseCSV(_ text: String) -> [ParsedImportContact] {
        let rows = splitCSVRows(text)
        guard rows.count >= 2 else { return [] }
        let headers = parseCSVLine(rows[0]).map { $0.lowercased().replacingOccurrences(of: "\"", with: "").replacingOccurrences(of: "'", with: "") }

        func find(_ candidates: [String]) -> Int {
            headers.firstIndex { h in candidates.contains { h == $0 || h.contains($0) } } ?? -1
        }
        let nameIdx = headers.firstIndex { h in
            h.contains("name") && !h.contains("last") && !h.contains("first") && !h.contains("company") && !h.contains("event")
        } ?? -1
        let firstIdx = find(["first name", "firstname", "given"])
        let lastIdx = find(["last name", "lastname", "surname", "family"])
        let emailIdx = find(["email", "e-mail"])
        let phoneIdx = find(["phone", "tel", "mobile", "cell"])
        let companyIdx = find(["company", "organization", "organisation", "org", "employer"])
        let titleIdx = find(["title", "job", "role", "position"])
        let linkedinIdx = find(["linkedin"])
        let websiteIdx = find(["website", "url", "web"])
        let locationIdx = find(["location", "city", "address"])
        let notesIdx = find(["notes", "note", "comment"])
        let eventIdx = find(["event", "folder", "list", "tag"])

        return rows.dropFirst().compactMap { line -> ParsedImportContact? in
            let cols = parseCSVLine(line)
            func get(_ idx: Int) -> String {
                guard idx >= 0, idx < cols.count else { return "" }
                return cols[idx].trimmingCharacters(in: CharacterSet(charactersIn: "\"")).trimmingCharacters(in: .whitespaces)
            }
            let first = get(firstIdx)
            let last = get(lastIdx)
            let fullName = !get(nameIdx).isEmpty ? get(nameIdx) : "\(first) \(last)".trimmingCharacters(in: .whitespaces)
            guard !fullName.isEmpty, fullName != "Unknown" else { return nil }
            func opt(_ idx: Int) -> String? { let v = get(idx); return v.isEmpty ? nil : v }
            return ParsedImportContact(
                name: fullName,
                email: opt(emailIdx),
                phone: opt(phoneIdx),
                company: opt(companyIdx),
                title: opt(titleIdx),
                linkedin: opt(linkedinIdx),
                website: opt(websiteIdx),
                location: opt(locationIdx),
                notes: opt(notesIdx),
                eventName: opt(eventIdx)
            )
        }
    }

    /// Splits CSV text into rows, respecting newlines inside quoted fields.
    private static func splitCSVRows(_ text: String) -> [String] {
        var rows: [String] = []
        var current = ""
        var inQuotes = false
        let chars = Array(text)
        var i = 0
        while i < chars.count {
            let ch = chars[i]
            if ch == "\"" {
                if inQuotes && i + 1 < chars.count && chars[i + 1] == "\"" {
                    current.append("\"\"")
                    i += 1
                } else {
                    inQuotes.toggle()
                    current.append(ch)
                }
            } else if (ch == "\n" || ch == "\r") && !inQuotes {
                if !current.trimmingCharacters(in: .whitespaces).isEmpty { rows.append(current) }
                current = ""
                if ch == "\r" && i + 1 < chars.count && chars[i + 1] == "\n" { i += 1 }
            } else {
                current.append(ch)
            }
            i += 1
        }
        if !current.trimmingCharacters(in: .whitespaces).isEmpty { rows.append(current) }
        return rows
    }

    /// Parses one CSV line into fields, handling quoted fields with escaped quotes.
    private static func parseCSVLine(_ line: String) -> [String] {
        var result: [String] = []
        var current = ""
        var inQuotes = false
        let chars = Array(line)
        var i = 0
        while i < chars.count {
            let ch = chars[i]
            if ch == "\"" {
                if inQuotes && i + 1 < chars.count && chars[i + 1] == "\"" {
                    current.append("\"")
                    i += 1
                } else {
                    inQuotes.toggle()
                }
            } else if ch == "," && !inQuotes {
                result.append(current)
                current = ""
            } else {
                current.append(ch)
            }
            i += 1
        }
        result.append(current)
        return result.map { $0.trimmingCharacters(in: .whitespaces) }
    }

    // MARK: - VCF

    static func parseVCF(_ text: String) -> [ParsedImportContact] {
        let cards = text.components(separatedBy: "BEGIN:VCARD").dropFirst()
        return cards.compactMap { card -> ParsedImportContact? in
            func field(_ key: String) -> String {
                guard let range = card.range(of: "\(key)[;:]([^\\r\\n]+)", options: [.regularExpression, .caseInsensitive]) else { return "" }
                let match = String(card[range])
                if let colon = match.range(of: ":", options: .backwards) {
                    return String(match[colon.upperBound...]).trimmingCharacters(in: .whitespaces)
                }
                return match.trimmingCharacters(in: .whitespaces)
            }
            let fn = field("FN")
            let n = field("N")
            let name: String
            if !fn.isEmpty {
                name = fn
            } else if !n.isEmpty {
                name = n.split(separator: ";").filter { !$0.isEmpty }.reversed().joined(separator: " ")
            } else {
                name = "Unknown"
            }
            guard !name.isEmpty, name != "Unknown" else { return nil }
            func opt(_ value: String) -> String? { value.isEmpty ? nil : value }
            return ParsedImportContact(
                name: name,
                email: opt(field("EMAIL")),
                phone: opt(field("TEL")),
                company: opt(field("ORG").replacingOccurrences(of: ";", with: " ").trimmingCharacters(in: .whitespaces)),
                title: opt(field("TITLE"))
            )
        }
    }
}
