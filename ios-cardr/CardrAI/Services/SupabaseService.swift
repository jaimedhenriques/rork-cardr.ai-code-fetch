import Foundation

/// Lightweight async client for the CardrAI Supabase backend.
/// Handles GoTrue auth (password + refresh) and PostgREST data access with
/// the current session's bearer token so row level security applies.
final class SupabaseService {
    static let shared = SupabaseService()

    private let session = URLSession.shared
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        decoder = JSONDecoder()
        encoder = JSONEncoder()
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws -> AuthSession {
        try await authRequest(
            path: "token",
            query: [URLQueryItem(name: "grant_type", value: "password")],
            body: ["email": email, "password": password]
        )
    }

    func signUp(email: String, password: String) async throws -> AuthSession {
        try await authRequest(
            path: "signup",
            query: [],
            body: ["email": email, "password": password]
        )
    }

    func refresh(refreshToken: String) async throws -> AuthSession {
        try await authRequest(
            path: "token",
            query: [URLQueryItem(name: "grant_type", value: "refresh_token")],
            body: ["refresh_token": refreshToken]
        )
    }

    func sendPasswordReset(email: String) async throws {
        var request = URLRequest(url: SupabaseConfig.authURL.appendingPathComponent("recover"))
        request.httpMethod = "POST"
        applyAuthHeaders(&request, token: nil)
        request.httpBody = try encoder.encode(["email": email])
        _ = try await perform(request)
    }

    private func authRequest(
        path: String,
        query: [URLQueryItem],
        body: [String: String]
    ) async throws -> AuthSession {
        var components = URLComponents(
            url: SupabaseConfig.authURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty { components.queryItems = query }
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        applyAuthHeaders(&request, token: nil)
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw SupabaseError.network }
        if !(200...299).contains(http.statusCode) {
            if let err = try? decoder.decode(AuthErrorResponse.self, from: data) {
                throw SupabaseError.message(err.message)
            }
            throw SupabaseError.message("Authentication failed (\(http.statusCode)).")
        }
        do {
            return try decoder.decode(AuthSession.self, from: data)
        } catch {
            throw SupabaseError.decoding
        }
    }

    // MARK: - REST

    func fetch<T: Decodable>(
        _ type: T.Type,
        table: String,
        token: String,
        query: [URLQueryItem] = []
    ) async throws -> T {
        var components = URLComponents(
            url: SupabaseConfig.restURL.appendingPathComponent(table),
            resolvingAgainstBaseURL: false
        )!
        var items = [URLQueryItem(name: "select", value: "*")]
        items.append(contentsOf: query)
        components.queryItems = items

        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        applyAuthHeaders(&request, token: token)

        let (data, response) = try await perform(request)
        try validate(response, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw SupabaseError.decoding
        }
    }

    func insert(
        table: String,
        token: String,
        values: [String: AnyEncodable]
    ) async throws {
        let components = URLComponents(
            url: SupabaseConfig.restURL.appendingPathComponent(table),
            resolvingAgainstBaseURL: false
        )!

        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        applyAuthHeaders(&request, token: token)
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try encoder.encode(values)

        let (data, response) = try await perform(request)
        try validate(response, data: data)
    }

    /// Inserts rows and decodes the representation returned by PostgREST.
    func insertReturning<T: Decodable>(
        _ type: T.Type,
        table: String,
        token: String,
        values: [[String: AnyEncodable]]
    ) async throws -> T {
        let components = URLComponents(
            url: SupabaseConfig.restURL.appendingPathComponent(table),
            resolvingAgainstBaseURL: false
        )!

        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        applyAuthHeaders(&request, token: token)
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try encoder.encode(values)

        let (data, response) = try await perform(request)
        try validate(response, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw SupabaseError.decoding
        }
    }

    func update(
        table: String,
        token: String,
        match: [String: String],
        values: [String: AnyEncodable]
    ) async throws {
        var components = URLComponents(
            url: SupabaseConfig.restURL.appendingPathComponent(table),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = match.map { URLQueryItem(name: $0.key, value: "eq.\($0.value)") }

        var request = URLRequest(url: components.url!)
        request.httpMethod = "PATCH"
        applyAuthHeaders(&request, token: token)
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try encoder.encode(values)

        let (data, response) = try await perform(request)
        try validate(response, data: data)
    }

    func delete(table: String, token: String, match: [String: String]) async throws {
        var components = URLComponents(
            url: SupabaseConfig.restURL.appendingPathComponent(table),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = match.map { URLQueryItem(name: $0.key, value: "eq.\($0.value)") }

        var request = URLRequest(url: components.url!)
        request.httpMethod = "DELETE"
        applyAuthHeaders(&request, token: token)

        let (data, response) = try await perform(request)
        try validate(response, data: data)
    }

    // MARK: - Storage

    /// Uploads `data` to a public storage bucket and returns its public URL.
    /// Mirrors the web `supabase.storage.from(bucket).upload(...)` + `getPublicUrl`.
    func uploadPublicObject(
        bucket: String,
        path: String,
        data: Data,
        contentType: String,
        token: String
    ) async throws -> String {
        let endpoint = SupabaseConfig.storageURL
            .appendingPathComponent("object")
            .appendingPathComponent(bucket)
            .appendingPathComponent(path)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("true", forHTTPHeaderField: "x-upsert")
        request.httpBody = data

        let (respData, response) = try await perform(request)
        try validate(response, data: respData)
        return SupabaseConfig.publicObjectURL(bucket: bucket, path: path).absoluteString
    }

    // MARK: - Helpers

    private func applyAuthHeaders(_ request: inout URLRequest, token: String?) {
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token ?? SupabaseConfig.anonKey)", forHTTPHeaderField: "Authorization")
    }

    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw SupabaseError.network
        }
    }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw SupabaseError.network }
        guard (200...299).contains(http.statusCode) else {
            if let text = String(data: data, encoding: .utf8), !text.isEmpty {
                throw SupabaseError.message(text)
            }
            throw SupabaseError.message("Request failed (\(http.statusCode)).")
        }
    }
}

/// Type-erased Encodable wrapper for heterogeneous PATCH payloads.
nonisolated struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init<T: Encodable>(_ value: T) {
        encodeClosure = value.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
