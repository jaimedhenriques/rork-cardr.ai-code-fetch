import Foundation
import Observation

/// Owns authentication state for the whole app and restores sessions on launch.
@MainActor
@Observable
final class SessionStore {
    enum Status {
        case loading
        case signedOut
        case signedIn
    }

    var status: Status = .loading
    var session: AuthSession?
    var authError: String?
    var isSubmitting = false

    private let service = SupabaseService.shared
    private let accessKey = "cardr.accessToken"
    private let refreshKey = "cardr.refreshToken"

    var accessToken: String? { session?.accessToken }
    var userId: String? { session?.user.id }

    func restore() async {
        guard let refresh = Keychain.get(refreshKey) else {
            status = .signedOut
            return
        }
        do {
            let restored = try await service.refresh(refreshToken: refresh)
            persist(restored)
            session = restored
            status = .signedIn
        } catch {
            clearTokens()
            status = .signedOut
        }
    }

    func signIn(email: String, password: String) async {
        await authenticate { try await self.service.signIn(email: email, password: password) }
    }

    func signUp(email: String, password: String) async {
        await authenticate { try await self.service.signUp(email: email, password: password) }
    }

    func signInWithApple(idToken: String, nonce: String) async {
        await authenticate { try await self.service.signInWithApple(idToken: idToken, nonce: nonce) }
    }

    func sendPasswordReset(email: String) async -> Bool {
        do {
            try await service.sendPasswordReset(email: email)
            return true
        } catch {
            authError = (error as? LocalizedError)?.errorDescription ?? "Could not send reset email."
            return false
        }
    }

    /// The signed-in user's email, if available.
    var userEmail: String? { session?.user.email }

    /// Re-verifies the user's password without disturbing the active session,
    /// used to confirm identity before destructive actions like deletion.
    func verifyPassword(_ password: String) async -> Bool {
        guard let email = session?.user.email, !email.isEmpty else { return false }
        do {
            _ = try await service.signIn(email: email, password: password)
            return true
        } catch {
            return false
        }
    }

    func signOut() {
        RealtimeClient.shared.disconnect()
        clearTokens()
        session = nil
        status = .signedOut
    }

    private func authenticate(_ operation: @escaping () async throws -> AuthSession) async {
        authError = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let result = try await operation()
            persist(result)
            session = result
            status = .signedIn
        } catch {
            authError = (error as? LocalizedError)?.errorDescription ?? "Authentication failed."
        }
    }

    private func persist(_ session: AuthSession) {
        Keychain.set(session.accessToken, for: accessKey)
        Keychain.set(session.refreshToken, for: refreshKey)
    }

    private func clearTokens() {
        Keychain.delete(accessKey)
        Keychain.delete(refreshKey)
    }
}
