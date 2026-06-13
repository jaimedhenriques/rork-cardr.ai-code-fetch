import Foundation

nonisolated struct AuthUser: Codable, Hashable {
    let id: String
    let email: String?
}

nonisolated struct AuthSession: Codable, Hashable {
    let accessToken: String
    let refreshToken: String
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

nonisolated struct AuthErrorResponse: Codable {
    let error: String?
    let errorDescription: String?
    let msg: String?

    enum CodingKeys: String, CodingKey {
        case error
        case errorDescription = "error_description"
        case msg
    }

    var message: String {
        errorDescription ?? msg ?? error ?? "Something went wrong. Please try again."
    }
}

nonisolated enum SupabaseError: LocalizedError {
    case message(String)
    case network
    case decoding

    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        case .network: return "Network error. Check your connection and try again."
        case .decoding: return "Unexpected response from the server."
        }
    }
}
