import Foundation
import CryptoKit
import Observation

/// Drives the "Claude remote-control" screen: minting, listing, and revoking
/// MCP API keys against the `user_api_keys` table — mirroring the web
/// `ApiKeyManager` exactly (csp_ prefix, SHA-256 hash, max 5 active keys).
@MainActor
@Observable
final class ApiKeysViewModel {
    var keys: [ApiKey] = []
    var isLoading = true
    var isGenerating = false
    var newKey: String?
    var errorMessage: String?

    private let service = SupabaseService.shared
    private unowned let session: SessionStore

    /// Max active keys, matching the web limit.
    let maxKeys = 5

    init(session: SessionStore) {
        self.session = session
    }

    /// The shared MCP server endpoint to paste into Claude Desktop / Cursor.
    var mcpURL: String {
        SupabaseConfig.functionsURL.appendingPathComponent("mcp-server").absoluteString
    }

    var canGenerate: Bool {
        !isGenerating && keys.count < maxKeys
    }

    func load() async {
        guard let token = session.accessToken, let userId = session.userId else {
            isLoading = false
            return
        }
        do {
            let fetched = try await service.fetch(
                [ApiKey].self,
                table: "user_api_keys",
                token: token,
                query: [
                    URLQueryItem(name: "user_id", value: "eq.\(userId)"),
                    URLQueryItem(name: "revoked_at", value: "is.null"),
                    URLQueryItem(name: "order", value: "created_at.desc"),
                ]
            )
            keys = fetched
        } catch {
            errorMessage = "Couldn't load your API keys."
        }
        isLoading = false
    }

    func generate() async {
        guard let token = session.accessToken, let userId = session.userId, canGenerate else { return }
        isGenerating = true
        errorMessage = nil
        defer { isGenerating = false }

        var randomBytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        let apiKey = "csp_" + randomBytes.map { String(format: "%02x", $0) }.joined()

        let digest = SHA256.hash(data: Data(apiKey.utf8))
        let hashHex = digest.map { String(format: "%02x", $0) }.joined()
        let keyPrefix = String(apiKey.prefix(12)) + "..."

        do {
            try await service.insert(
                table: "user_api_keys",
                token: token,
                values: [
                    "user_id": AnyEncodable(userId),
                    "key_hash": AnyEncodable(hashHex),
                    "key_prefix": AnyEncodable(keyPrefix),
                    "label": AnyEncodable("MCP API Key"),
                ]
            )
            newKey = apiKey
            await load()
        } catch {
            errorMessage = "Failed to generate API key."
        }
    }

    func revoke(_ key: ApiKey) async {
        guard let token = session.accessToken else { return }
        do {
            try await service.update(
                table: "user_api_keys",
                token: token,
                match: ["id": key.id],
                values: ["revoked_at": AnyEncodable(ISO8601DateFormatter().string(from: Date()))]
            )
            keys.removeAll { $0.id == key.id }
        } catch {
            errorMessage = "Failed to revoke key."
        }
    }

    func dismissNewKey() {
        newKey = nil
    }
}
