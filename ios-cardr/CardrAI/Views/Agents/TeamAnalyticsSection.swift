import SwiftUI

/// Org-wide "Team" scope of the Analytics screen — meeting volume, sentiment,
/// action items, talk balance, a member leaderboard, and the team's open
/// action items. Data comes from the `team-analytics` edge function.
struct TeamAnalyticsSection: View {
    @Environment(DataStore.self) private var data
    let rangeDays: Int

    @State private var team: TeamAnalytics?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading && team == nil {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
            } else if let team, team.totals.meetings > 0 {
                content(team)
            } else {
                emptyState
            }
        }
        .task(id: rangeDays) {
            isLoading = true
            team = await data.loadTeamAnalytics(rangeDays: rangeDays)
            isLoading = false
        }
    }

    @ViewBuilder
    private func content(_ team: TeamAnalytics) -> some View {
        summaryGrid(team.totals)
        if !team.members.isEmpty { leaderboard(team.members) }
        if !team.openActionItems.isEmpty { actionItems(team.openActionItems) }
    }

    // MARK: - Summary cards

    private func summaryGrid(_ totals: TeamAnalytics.Totals) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            metric(
                "Team meetings", "\(totals.meetings)",
                "\(totals.minutes) min recorded", "mic.fill", Theme.accent
            )
            metric(
                "Avg sentiment",
                totals.avgSentiment != nil ? "\(Int(totals.avgSentiment! * 100))%" : "—",
                "\(totals.totalQuestions) questions asked",
                sentimentIcon(totals.avgSentiment), sentimentTint(totals.avgSentiment)
            )
            metric(
                "Action items",
                "\(totals.actionItemsDone)/\(totals.actionItemsTotal)",
                "completed", "checkmark.circle.fill", Theme.success
            )
            metric(
                "Talk balance",
                totals.avgTalkDominance != nil ? "\(totals.avgTalkDominance!)%" : "—",
                "avg top-speaker share", "scalemass.fill", Theme.primary
            )
        }
    }

    private func sentimentIcon(_ score: Double?) -> String {
        guard let score else { return "face.dashed" }
        if score >= 0.6 { return "face.smiling.inverse" }
        if score >= 0.4 { return "face.dashed.fill" }
        return "face.dashed"
    }

    private func sentimentTint(_ score: Double?) -> Color {
        guard let score else { return Theme.inkSecondary }
        if score >= 0.6 { return Theme.success }
        if score >= 0.4 { return Theme.warning }
        return Theme.destructive
    }

    private func metric(_ label: String, _ value: String, _ caption: String, _ icon: String, _ tint: Color) -> some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(label.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer(minLength: 0)
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(tint)
                }
                Text(value)
                    .font(.system(size: 24, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
                Text(caption)
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Member leaderboard

    private func leaderboard(_ members: [TeamMemberStat]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Member leaderboard")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.inkSecondary)
            CardSurface(padding: 16) {
                VStack(spacing: 14) {
                    ForEach(Array(members.enumerated()), id: \.element.id) { index, member in
                        HStack(spacing: 12) {
                            Text("\(index + 1)")
                                .font(.system(size: 12, weight: .bold))
                                .monospacedDigit()
                                .foregroundStyle(Theme.inkSecondary)
                                .frame(width: 16, alignment: .trailing)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(member.name)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Theme.ink)
                                    .lineLimit(1)
                                Text(memberCaption(member))
                                    .font(.system(size: 11))
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                            Spacer(minLength: 0)
                            if let sentiment = member.avgSentiment {
                                Text("\(Int(sentiment * 100))%")
                                    .font(.system(size: 11, weight: .bold))
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 3)
                                    .background(Theme.primary.opacity(0.12))
                                    .clipShape(Capsule())
                            }
                            if let dominance = member.avgTalkDominance {
                                talkBar(dominance)
                            }
                        }
                    }
                }
            }
        }
    }

    private func memberCaption(_ member: TeamMemberStat) -> String {
        guard member.meetings > 0 else { return "No meetings yet" }
        return "\(member.meetings) meeting\(member.meetings == 1 ? "" : "s") · \(member.minutes) min · \(member.actionItemsDone)/\(member.actionItems) actions"
    }

    private func talkBar(_ dominance: Int) -> some View {
        ZStack(alignment: .leading) {
            Capsule().fill(Theme.surfaceMuted)
            GeometryReader { proxy in
                Capsule()
                    .fill(Theme.primary)
                    .frame(width: proxy.size.width * CGFloat(min(dominance, 100)) / 100)
            }
        }
        .frame(width: 56, height: 5)
    }

    // MARK: - Open action items

    private func actionItems(_ items: [TeamOpenActionItem]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Open action items")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.inkSecondary)
            CardSurface(padding: 16) {
                VStack(spacing: 12) {
                    ForEach(items) { item in
                        HStack(alignment: .top, spacing: 10) {
                            Circle()
                                .fill(priorityTint(item.priority))
                                .frame(width: 7, height: 7)
                                .padding(.top, 5)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.task)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Theme.ink)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(itemCaption(item))
                                    .font(.system(size: 11))
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.inkSecondary)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
            }
        }
    }

    private func itemCaption(_ item: TeamOpenActionItem) -> String {
        [item.owner, item.memberName, item.noteTitle, item.deadline]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    private func priorityTint(_ priority: String?) -> Color {
        switch priority {
        case "high": return Theme.destructive
        case "medium": return Theme.warning
        default: return Theme.inkSecondary.opacity(0.4)
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "person.3")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text("No team meetings yet")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text("When your teammates record meetings, team trends appear here.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 50)
        .padding(.horizontal, 12)
    }
}
