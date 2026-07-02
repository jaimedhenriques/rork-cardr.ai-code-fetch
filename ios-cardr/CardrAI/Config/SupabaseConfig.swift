import Foundation

/// Connection details for the shared CardrAI Supabase backend.
/// The anon/publishable key is safe to embed in client apps — row level
/// security on the backend governs access.
enum SupabaseConfig {
    static let url = URL(string: "https://nhalxqobrsuuzmmefeid.supabase.co")!
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oYWx4cW9icnN1dXptbWVmZWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzYxNTMsImV4cCI6MjA5MDcxMjE1M30.JTMv2pWaLurqc-aCUNPkEReW1lImL6IlIpRe0k4SH0E"

    static var projectURL: URL { url }
    static var restURL: URL { url.appendingPathComponent("rest/v1") }
    static var authURL: URL { url.appendingPathComponent("auth/v1") }
    static var functionsURL: URL { url.appendingPathComponent("functions/v1") }
    static var storageURL: URL { url.appendingPathComponent("storage/v1") }

    /// WebSocket endpoint for Supabase Realtime (Phoenix channels protocol).
    static var realtimeURL: URL {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.scheme = "wss"
        components.path = "/realtime/v1/websocket"
        components.queryItems = [
            URLQueryItem(name: "apikey", value: anonKey),
            URLQueryItem(name: "vsn", value: "1.0.0"),
        ]
        return components.url!
    }

    /// Public URL for an object stored in a public storage bucket.
    static func publicObjectURL(bucket: String, path: String) -> URL {
        storageURL
            .appendingPathComponent("object/public")
            .appendingPathComponent(bucket)
            .appendingPathComponent(path)
    }
}
