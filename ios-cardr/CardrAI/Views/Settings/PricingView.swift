import SwiftUI

/// Pricing screen — mirrors the web `Pricing` page. Shows three tiers
/// (Starter/Pro/Business) with feature lists and a billing toggle.
struct PricingView: View {
    @Environment(\.openURL) private var openURL
    @State private var annual = true

    private struct Plan: Identifiable {
        let id: String
        let name: String
        let icon: String
        let monthlyPrice: String
        let annualPrice: String
        let features: [String]
        let excluded: [String]
        let cta: String
        let isPopular: Bool
    }

    private let plans: [Plan] = [
        Plan(
            id: "starter", name: "Starter", icon: "sparkles",
            monthlyPrice: "$0", annualPrice: "$0",
            features: [
                "25 contacts", "15 AI enrichments/mo", "25 meeting notes",
                "60 min transcription/mo", "Digital card", "QR sharing", "CSV export",
            ],
            excluded: ["Custom branding", "CRM integrations", "Priority support", "API access"],
            cta: "Current plan", isPopular: false
        ),
        Plan(
            id: "pro", name: "Pro", icon: "bolt.fill",
            monthlyPrice: "$9.99", annualPrice: "$7.99",
            features: [
                "Unlimited contacts", "150 AI enrichments/mo", "Unlimited notes",
                "10 hr transcription/mo", "All export formats", "CRM integrations",
                "Custom branding", "Priority support",
            ],
            excluded: ["White-label", "Per-user seats"],
            cta: "Upgrade to Pro", isPopular: true
        ),
        Plan(
            id: "business", name: "Business", icon: "building.2.fill",
            monthlyPrice: "$29.99", annualPrice: "$24.99",
            features: [
                "Everything in Pro", "Unlimited enrichments", "Unlimited transcription",
                "API access", "White-label", "Per-user seats", "SSO",
            ],
            excluded: [],
            cta: "Contact sales", isPopular: false
        ),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                billingToggle
                ForEach(plans) { plan in
                    planCard(plan)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Pricing")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var billingToggle: some View {
        HStack(spacing: 12) {
            Text("Monthly")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(!annual ? Theme.ink : Theme.inkSecondary)
            Toggle("", isOn: $annual).labelsHidden().tint(Theme.primary)
            Text("Annual")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(annual ? Theme.ink : Theme.inkSecondary)
            if annual {
                Text("Save 20%")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.success)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Theme.success.opacity(0.12), in: Capsule())
            }
            Spacer()
        }
        .padding(.horizontal, 4)
    }

    private func planCard(_ plan: Plan) -> some View {
        let price = annual ? plan.annualPrice : plan.monthlyPrice
        return CardSurface(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    Image(systemName: plan.icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(plan.isPopular ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.primary.opacity(0.15)))
                        .clipShape(.rect(cornerRadius: 12))
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(plan.name)
                                .font(.headline)
                                .foregroundStyle(Theme.ink)
                            if plan.isPopular {
                                Text("Most popular")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 7).padding(.vertical, 2)
                                    .background(Theme.primary.opacity(0.12), in: Capsule())
                            }
                        }
                        Text("\(price)/mo")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer()
                }

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(plan.features, id: \.self) { feature in
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.success)
                            Text(feature)
                                .font(.subheadline)
                                .foregroundStyle(Theme.ink)
                        }
                    }
                    ForEach(plan.excluded, id: \.self) { feature in
                        HStack(spacing: 8) {
                            Image(systemName: "xmark.circle")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.inkSecondary.opacity(0.4))
                            Text(feature)
                                .font(.subheadline)
                                .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                        }
                    }
                }

                Button {
                    if plan.id != "starter" {
                        openURL(URL(string: "https://cardr.ai/pricing")!)
                    }
                } label: {
                    Text(plan.cta)
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(plan.isPopular ? .white : Theme.primary)
                        .background(plan.isPopular ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.primary.opacity(0.1)))
                        .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(plan.id == "starter")
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(plan.isPopular ? Theme.primary.opacity(0.3) : .clear, lineWidth: 2)
        )
    }
}
