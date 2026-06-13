import Foundation

/// Parses QR/badge payloads into a structured `ScanResult` for contact creation.
/// Handles vCard (`BEGIN:VCARD`) and MeCard formats read live by the scanner.
enum ScanResultParser {
    /// Returns a `ScanResult` if `payload` is a recognizable contact code, else nil.
    static func parseVCard(_ payload: String) -> DataStore.ScanResult? {
        let text = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.uppercased().hasPrefix("BEGIN:VCARD") { return parseStandardVCard(text) }
        if text.uppercased().hasPrefix("MECARD:") { return parseMeCard(text) }
        return nil
    }

    private static func parseStandardVCard(_ text: String) -> DataStore.ScanResult? {
        var name: String?
        var company: String?
        var title: String?
        var email: String?
        var phone: String?
        var website: String?

        for rawLine in text.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[..<colon].uppercased()
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            guard !value.isEmpty else { continue }

            if key.hasPrefix("FN") {
                name = value
            } else if key.hasPrefix("N") && name == nil {
                name = value.replacingOccurrences(of: ";", with: " ")
                    .trimmingCharacters(in: .whitespaces)
            } else if key.hasPrefix("ORG") {
                company = value.replacingOccurrences(of: ";", with: " ").trimmingCharacters(in: .whitespaces)
            } else if key.hasPrefix("TITLE") {
                title = value
            } else if key.hasPrefix("EMAIL") {
                email = value
            } else if key.hasPrefix("TEL") {
                phone = value
            } else if key.hasPrefix("URL") {
                website = value
            }
        }

        guard let resolvedName = name, !resolvedName.isEmpty else { return nil }
        return DataStore.ScanResult(
            name: resolvedName,
            company: company,
            title: title,
            email: email,
            phone: phone,
            linkedin: nil,
            website: website,
            location: nil
        )
    }

    private static func parseMeCard(_ text: String) -> DataStore.ScanResult? {
        let body = String(text.dropFirst("MECARD:".count))
        var fields: [String: String] = [:]
        for segment in body.components(separatedBy: ";") {
            guard let colon = segment.firstIndex(of: ":") else { continue }
            let key = String(segment[..<colon]).uppercased()
            let value = String(segment[segment.index(after: colon)...])
            if !value.isEmpty { fields[key] = value }
        }
        guard let rawName = fields["N"], !rawName.isEmpty else { return nil }
        let name = rawName.replacingOccurrences(of: ",", with: " ").trimmingCharacters(in: .whitespaces)
        return DataStore.ScanResult(
            name: name,
            company: fields["ORG"],
            title: nil,
            email: fields["EMAIL"],
            phone: fields["TEL"],
            linkedin: nil,
            website: fields["URL"],
            location: nil
        )
    }
}
