import SwiftUI

/// A transparent plan-tier and remaining-credits card for the Settings screen.
/// Shows the current plan, all metered resources with progress bars, and
/// status banners when limits are approaching or exhausted.
struct PlanUsageCard: View {
    @Environment(DataStore.self) private var data

    private var plan: PlanType { data.currentPlan }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            planHeader
            Divider().background(Theme.border)
            metricsList
            statusBanner
            if let resetDate = resetDateString {
                Text(resetDate)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.border, lineWidth: 1)
        )
        .shadow(color: Theme.ink.opacity(0.05), radius: 12, y: 6)
    }

    // MARK: - Header

    private var planHeader: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Theme.brandGradient)
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: plan.icon)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white)
                }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text("\(plan.label) plan")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    if plan == .starter {
                        Text("Free")
                            .font(.system(size: 10, weight: .bold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.inkSecondary)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Theme.surfaceMuted, in: Capsule())
                    }
                    if data.userSubscription.cancelAtPeriodEnd && plan != .starter {
                        Text("Cancelling")
                            .font(.system(size: 10, weight: .bold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.warning)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Theme.warning.opacity(0.12), in: Capsule())
                    }
                }
                Text(data.isLoadingPlan ? "Loading usage…" : (plan.isLifetime ? "Lifetime limits" : "Resets monthly"))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 0)
            NavigationLink { PricingView() } label: {
                HStack(spacing: 2) {
                    Text("Upgrade")
                        .font(.system(size: 11, weight: .semibold))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(Theme.primary)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Metrics

    private var metricsList: some View {
        VStack(spacing: 14) {
            ForEach(data.usageMetrics) { metric in
                metricRow(metric)
            }
        }
    }

    private func metricRow(_ metric: UsageMetric) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: metric.icon)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                    Text(metric.label)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                if metric.isUnlimited {
                    HStack(spacing: 2) {
                        Image(systemName: "infinity")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Unlimited")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(Theme.primary)
                } else {
                    HStack(spacing: 2) {
                        Text("\(metric.remaining) left")
                            .font(.system(size: 11, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(barColor(metric))
                        Text("of \(metric.limit)\(metric.unit.map { " \($0)" } ?? "")")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                    }
                }
            }
            if !metric.isUnlimited {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Theme.surfaceMuted)
                        Capsule()
                            .fill(barColor(metric))
                            .frame(width: max(4, geo.size.width * metric.fraction))
                    }
                }
                .frame(height: 6)
            }
        }
    }

    private func barColor(_ metric: UsageMetric) -> Color {
        if metric.isExhausted { return Theme.destructive }
        if metric.isNearLimit { return Theme.warning }
        return Theme.primary
    }

    // MARK: - Status banner

    @ViewBuilder
    private var statusBanner: some View {
        let exhausted = data.usageMetrics.filter { $0.isExhausted }
        let nearLimit = data.usageMetrics.filter { $0.isNearLimit }
        if !exhausted.isEmpty {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.destructive)
                Text("\(exhausted.count) resource\(exhausted.count > 1 ? "s" : "") exhausted — upgrade to unlock more.")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.destructive)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Theme.destructive.opacity(0.08), in: .rect(cornerRadius: 10))
        } else if !nearLimit.isEmpty {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.warning)
                Text("Approaching limit on \(nearLimit.count) resource\(nearLimit.count > 1 ? "s" : "").")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.warning)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Theme.warning.opacity(0.08), in: .rect(cornerRadius: 10))
        }
    }

    // MARK: - Reset date

    private var resetDateString: String? {
        guard !plan.isLifetime,
              let periodEnd = data.userSubscription.currentPeriodEnd,
              plan != .starter else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        let isoFormatter = ISO8601DateFormatter()
        guard let date = isoFormatter.date(from: periodEnd) else { return nil }
        return "Usage resets \(formatter.string(from: date))"
    }
}
