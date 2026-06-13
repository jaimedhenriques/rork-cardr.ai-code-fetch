import Foundation

/// Minimal Supabase Realtime client built on `URLSessionWebSocketTask`.
///
/// Speaks the Phoenix channels protocol that Supabase Realtime uses: it opens a
/// single WebSocket, joins one channel per subscribed table with a
/// `postgres_changes` binding, keeps the socket alive with heartbeats, and
/// reconnects with backoff. When the backend pushes a change for a subscribed
/// table, the registered handler fires so the `DataStore` can refresh that slice
/// of data — mirroring the web app's `supabase.channel(...).on("postgres_changes")`.
@MainActor
final class RealtimeClient {
    static let shared = RealtimeClient()

    /// A single table subscription: what to listen to and what to do on change.
    private struct Subscription {
        let table: String
        let filter: String?
        let handler: () -> Void
        var joined: Bool = false
    }

    private var task: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .default)
    private var subscriptions: [String: Subscription] = [:]
    private var token: String?
    private var isConnected = false
    private var isConnecting = false
    private var shouldReconnect = false
    private var heartbeatTask: Task<Void, Never>?
    private var reconnectAttempts = 0
    private var refCounter = 0

    private init() {}

    // MARK: - Lifecycle

    /// Opens the realtime socket (idempotent). Pass the current access token so
    /// row level security applies to the subscribed changes.
    func connect(token: String) {
        self.token = token
        shouldReconnect = true
        guard !isConnected, !isConnecting else { return }
        openSocket()
    }

    /// Updates the access token used for RLS (e.g. after a refresh) and re-joins
    /// channels so the new token takes effect.
    func updateToken(_ token: String) {
        guard token != self.token else { return }
        self.token = token
        guard isConnected else { return }
        for key in subscriptions.keys { subscriptions[key]?.joined = false }
        rejoinAll()
    }

    /// Tears down the socket and clears all subscriptions.
    func disconnect() {
        shouldReconnect = false
        heartbeatTask?.cancel()
        heartbeatTask = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        isConnected = false
        isConnecting = false
        subscriptions.removeAll()
        reconnectAttempts = 0
    }

    // MARK: - Subscriptions

    /// Subscribes to row changes on `table`, optionally constrained by a
    /// PostgREST-style `filter` (e.g. `user_id=eq.<uuid>`). The `handler` is
    /// invoked on the main actor whenever an insert/update/delete arrives.
    func subscribe(table: String, filter: String?, handler: @escaping () -> Void) {
        let key = filter.map { "\(table):\($0)" } ?? table
        guard subscriptions[key] == nil else { return }
        subscriptions[key] = Subscription(table: table, filter: filter, handler: handler)
        if isConnected { joinChannel(key: key) }
    }

    // MARK: - Socket

    private func openSocket() {
        isConnecting = true
        let task = session.webSocketTask(with: SupabaseConfig.realtimeURL)
        self.task = task
        task.resume()
        receive()
        // Phoenix considers the socket open immediately; join channels and start
        // the heartbeat. Any failure surfaces via the receive loop and triggers a
        // reconnect.
        isConnecting = false
        isConnected = true
        reconnectAttempts = 0
        startHeartbeat()
        rejoinAll()
    }

    private func rejoinAll() {
        for key in subscriptions.keys where subscriptions[key]?.joined == false {
            joinChannel(key: key)
        }
    }

    private func joinChannel(key: String) {
        guard let sub = subscriptions[key] else { return }
        var change: [String: Any] = [
            "event": "*",
            "schema": "public",
            "table": sub.table,
        ]
        if let filter = sub.filter { change["filter"] = filter }
        var payload: [String: Any] = [
            "config": ["postgres_changes": [change]],
        ]
        if let token { payload["access_token"] = token }
        send(topic: "realtime:\(key)", event: "phx_join", payload: payload)
        subscriptions[key]?.joined = true
    }

    private func send(topic: String, event: String, payload: [String: Any]) {
        guard let task else { return }
        refCounter += 1
        let message: [String: Any] = [
            "topic": topic,
            "event": event,
            "payload": payload,
            "ref": String(refCounter),
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let string = String(data: data, encoding: .utf8) else { return }
        task.send(.string(string)) { [weak self] error in
            if error != nil {
                Task { @MainActor in self?.handleDisconnect() }
            }
        }
    }

    private func receive() {
        task?.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case .success(let message):
                    self.handle(message)
                    self.receive()
                case .failure:
                    self.handleDisconnect()
                }
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        let text: String
        switch message {
        case .string(let value): text = value
        case .data(let data): text = String(data: data, encoding: .utf8) ?? ""
        @unknown default: return
        }
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let event = json["event"] as? String,
              let topic = json["topic"] as? String else { return }

        guard event == "postgres_changes" else { return }
        // Topic is "realtime:<key>"; strip the prefix to find the subscription.
        let key = String(topic.dropFirst("realtime:".count))
        subscriptions[key]?.handler()
    }

    private func startHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(25))
                if Task.isCancelled { return }
                self?.send(topic: "phoenix", event: "heartbeat", payload: [:])
            }
        }
    }

    private func handleDisconnect() {
        guard isConnected || isConnecting else { return }
        isConnected = false
        isConnecting = false
        heartbeatTask?.cancel()
        heartbeatTask = nil
        task = nil
        for key in subscriptions.keys { subscriptions[key]?.joined = false }
        guard shouldReconnect else { return }
        scheduleReconnect()
    }

    private func scheduleReconnect() {
        reconnectAttempts += 1
        let delay = min(Double(reconnectAttempts) * 1.5, 15)
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard let self, self.shouldReconnect, !self.isConnected else { return }
            self.openSocket()
        }
    }
}
