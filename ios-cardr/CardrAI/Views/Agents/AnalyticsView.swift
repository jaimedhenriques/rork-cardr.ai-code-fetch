import SwiftUI

/// Analytics — mirrors the web `Analytics` page. Aggregates AI meeting insights
/// (sentiment, questions, engagement, top speakers) over a selectable range.
struct AnalyticsView: View {
    private enum Scope: String, CaseIterable, Identifiable {
        case me = "My insights"
        case team = "Team"
        var id: String { rawValue }
    }

    @Environment(DataStore.self) private var data
    @State private var notes: [AnalyticsNote] = []
    @State private var loaded = false
    @State private var rangeDays = 30
    @State private var scope: Scope = .me

    private let ranges: [(label: String, days: Int)] = [
        ("7d", 7), ("30d", 30), ("90d", 90), ("All", 9999),
    ]

    private static let iso = ISO8601DateFormatter()

    private func parse(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        if let d = Self.iso.date(from: raw) { return d }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f.date(from: String(raw.prefix(19)))
    }

    private var filtered: [AnalyticsNote] {
        guard rangeDays < 9999 else { return notes }
        let cutoff = Date().addingTimeInterval(-Double(rangeDays) * 86400)
        return notes.filter { (parse($0.createdAt) ?? .distantPast) > cutoff }
    }

    private var withAnalytics: [AnalyticsNote] { filtered.filter(\.hasAnalytics) }

    private var avgSentiment: Double? {
        let scores = withAnalytics.compactMap { $0.analytics?.sentimentScore }
        return scores.isEmpty ? nil : scores.reduce(0, +) / Double(scores.count)
    }

    private var totalQuestions: Int {
        withAnalytics.reduce(0) { $0 + ($1.analytics?.questionsAsked ?? 0) }
    }

    private var totalMinutes: Int {
        filtered.reduce(0) { $0 + ($1.durationSeconds ?? 0) } / 60
    }

    private var highEngagementPct: Int? {
        guard !withAnalytics.isEmpty else { return nil }
        let high = withAnalytics.filter { ($0.analytics?.engagementLevel?.lowercased()) == "high" }.count
        return high == 0 ? nil : Int(Double(high) / Double(withAnalytics.count) * 100)
    }

    private struct Speaker: Identifiable { let id: String; let avgRatio: Int; let topCount: Int; let meetings: Int }

    private var speakers: [Speaker] {
        var map: [String: (total: Double, count: Int, top: Int)] = [:]
        for note in withAnalytics {
            if let ratio = note.analytics?.talkTimeRatio {
                for (name, val) in ratio {
                    var entry = map[name] ?? (0, 0, 0)
                    entry.total += val; entry.count += 1
                    map[name] = entry
                }
            }
            if let top = note.analytics?.topSpeaker {
                var entry = map[top] ?? (0, 0, 0)
                entry.top += 1
                map[top] = entry
            }
        }
        return map.map { name, s in
            Speaker(id: name, avgRatio: Int((s.total / Double(max(s.count, 1))) * 100), topCount: s.top, meetings: s.count)
        }
        .sorted { $0.topCount != $1.topCount ? $0.topCount > $1.topCount : $0.avgRatio > $1.avgRatio }
        .prefix(8).map { $0 }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if data.orgId != nil { scopePicker }
                rangePicker
                if scope == .team {
                    TeamAnalyticsSection(rangeDays: rangeDays)
                } else if !loaded {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                } else if withAnalytics.isEmpty {
                    emptyState
                } else {
                    summaryGrid
                    if !speakers.isEmpty { speakerCard }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard !loaded else { return }
            notes = await data.loadAnalyticsNotes()
            loaded = true
        }
        .refreshable { notes = await data.loadAnalyticsNotes() }
    }

    private var scopePicker: some View {
        HStack(spacing: 4) {
            ForEach(Scope.allCases) { option in
                let active = scope == option
                Button {
                    withAnimation(.snappy(duration: 0.2)) { scope = option }
                } label: {
                    Text(option.rawValue)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(active ? Theme.ink : Theme.inkSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(active ? Theme.surface : .clear)
                        .clipShape(RoundedRectangle(cornerRadius: 9))
                        .shadow(color: active ? .black.opacity(0.08) : .clear, radius: 3, y: 1)
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
        .padding(4)
        .background(Theme.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var rangePicker: some View {
        HStack(spacing: 8) {
            ForEach(ranges, id: \.days) { range in
                let active = rangeDays == range.days
                Button {
                    withAnimation(.snappy(duration: 0.2)) { rangeDays = range.days }
                } label: {
                    Text(range.label)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(active ? .white : Theme.inkSecondary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(active ? Theme.primary : Theme.surfaceMuted)
                        .clipShape(Capsule())
                }
                .buttonStyle(PressableButtonStyle())
            }
            Spacer(minLength: 0)
        }
    }

    private var summaryGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            metric(
                "Avg sentiment",
                avgSentiment != nil ? "\(Int(avgSentiment! * 100))%" : "—",
                "across \(withAnalytics.count) meeting\(withAnalytics.count == 1 ? "" : "s")",
                sentimentIcon, sentimentTint
            )
            metric("Questions", "\(totalQuestions)", "total asked", "questionmark.bubble.fill", Theme.primary)
            metric("Meetings", "\(filtered.count)", "\(totalMinutes) min recorded", "mic.fill", Theme.accent)
            metric(
                "Engagement",
                highEngagementPct != nil ? "\(highEngagementPct!)%" : "—",
                "high engagement", "bolt.fill", Theme.warning
            )
        }
    }

    private var sentimentIcon: String {
        guard let s = avgSentiment else { return "face.dashed" }
        if s >= 0.6 { return "face.smiling.inverse" }
        if s >= 0.4 { return "face.dashed.fill" }
        return "face.dashed"
    }

    private var sentimentTint: Color {
        guard let s = avgSentiment else { return Theme.inkSecondary }
        if s >= 0.6 { return Theme.success }
        if s >= 0.4 { return Theme.warning }
        return Theme.destructive
    }

    private func metric(_ label: String, _ value: String, _ caption: String, _ icon: String, _ tint: Color) -> some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(label.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer(minLength: 0)
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(tint)
                }
                Text(value)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.ink)
                Text(caption)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var speakerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Most active speakers")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.inkSecondary)
            CardSurface(padding: 16) {
                VStack(spacing: 14) {
                    ForEach(Array(speakers.enumerated()), id: \.element.id) { index, speaker in
                        HStack(spacing: 12) {
                            Text("\(index + 1)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Theme.inkSecondary)
                                .frame(width: 16, alignment: .trailing)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(speaker.id)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Theme.ink)
                                    .lineLimit(1)
                                Text("\(speaker.meetings) meeting\(speaker.meetings == 1 ? "" : "s") · avg \(speaker.avgRatio)% talk time")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                            Spacer(minLength: 0)
                            if speaker.topCount > 0 {
                                Text("🎤 \(speaker.topCount)x")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 3)
                                    .background(Theme.primary.opacity(0.12))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text("No analytics yet")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text("Record meetings with AI insights enabled and your sentiment, engagement, and speaker stats will appear here.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 50)
        .padding(.horizontal, 12)
    }
}
