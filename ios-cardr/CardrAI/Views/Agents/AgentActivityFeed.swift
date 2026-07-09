import SwiftUI

/// Live activity feed of recent agent runs — mirrors the web `AgentActivityFeed`.
/// Shows run status, the agent, an optional subject/summary, and relative time.
struct AgentActivityFeed: View {
    @Environment(DataStore.self) private var data

    private var runs: [AgentRun] { data.recentAgentRuns }

    private var runningCount: Int {
        runs.filter { $0.status == "running" || $0.status == "pending" }.count
    }

    private var completedTodayCount: Int {
        runs.filter { run in
            guard run.status == "complete", let completed = Self.parse(run.completedAt) else { return false }
            return Calendar.current.isDateInToday(completed)
        }.count
    }

    private var failedCount: Int { runs.filter { $0.status == "error" }.count }

    var body: some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 14) {
                header
                if runs.isEmpty {
                    emptyState
                } else {
                    VStack(spacing: 8) {
                        ForEach(runs) { run in
                            runRow(run)
                        }
                    }
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Theme.primary.opacity(0.12))
                    .frame(width: 36, height: 36)
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primary)
                if runningCount > 0 {
                    Circle()
                        .fill(Theme.primary)
                        .frame(width: 9, height: 9)
                        .overlay(Circle().stroke(Theme.surface, lineWidth: 2))
                        .offset(x: 15, y: -15)
                }
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("Live activity")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text("Real-time agent runs & summaries")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 8)
            HStack(spacing: 10) {
                statDot(count: runningCount, color: Theme.primary)
                statDot(count: completedTodayCount, color: Theme.success)
                if failedCount > 0 {
                    statDot(count: failedCount, color: Theme.destructive)
                }
            }
        }
    }

    private func statDot(count: Int, color: Color) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text("\(count)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(color)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "sparkles")
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text("No agent runs yet")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text("Once your agents start working on contacts or badges, summaries will appear here in real time.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
    }

    private func runRow(_ run: AgentRun) -> some View {
        let meta = StatusMeta.from(run.status)
        return HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(meta.color.opacity(0.12))
                    .frame(width: 32, height: 32)
                Image(systemName: meta.icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(meta.color)
                    .symbolEffect(.rotate, options: meta.spin ? .repeating : .nonRepeating, isActive: meta.spin)
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(data.agentName(forRun: run))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Text("· \(meta.label)")
                        .font(.system(size: 11, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(0.5)
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer(minLength: 4)
                    Text(Self.relativeTime(run.createdAt))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.inkSecondary)
                        .monospacedDigit()
                }
                if let name = run.contactName, !name.isEmpty {
                    Label(name, systemImage: "person")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.inkSecondary)
                }
                if let summary = run.summary {
                    Text(summary)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(2)
                } else if run.status == "error", let error = run.errorMessage {
                    Text(error)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.destructive)
                        .lineLimit(2)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.background)
        .clipShape(.rect(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Status

    private struct StatusMeta {
        let icon: String
        let label: String
        let color: Color
        let spin: Bool

        static func from(_ status: String) -> StatusMeta {
            switch status {
            case "running":
                return StatusMeta(icon: "arrow.triangle.2.circlepath", label: "Running", color: Theme.primary, spin: true)
            case "complete":
                return StatusMeta(icon: "checkmark.circle.fill", label: "Complete", color: Theme.success, spin: false)
            case "error":
                return StatusMeta(icon: "xmark.circle.fill", label: "Failed", color: Theme.destructive, spin: false)
            default:
                return StatusMeta(icon: "clock", label: "Queued", color: Theme.inkSecondary, spin: false)
            }
        }
    }

    // MARK: - Dates

    private static let iso = ISO8601DateFormatter()

    private static func parse(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        if let date = iso.date(from: raw) { return date }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f.date(from: String(raw.prefix(19)))
    }

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f
    }()

    private static func relativeTime(_ raw: String?) -> String {
        guard let date = parse(raw) else { return "" }
        return relativeFormatter.localizedString(for: date, relativeTo: Date())
    }
}
