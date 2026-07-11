import SwiftUI

/// Support page — mirrors the web `Support` page.
struct SupportView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("We're a small team and we read every message.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                supportCard(
                    icon: "envelope.fill",
                    title: "Email us",
                    description: "Typical response time: under 24 hours on business days.",
                    action: "support@cardr.ai"
                ) {
                    openURL(URL(string: "mailto:support@cardr.ai")!)
                }

                supportCard(
                    icon: "creditcard.fill",
                    title: "Account & billing",
                    description: "Questions about your plan or billing? Email us and we'll sort it out quickly."
                ) {
                    openURL(URL(string: "mailto:support@cardr.ai")!)
                }

                supportCard(
                    icon: "lock.shield.fill",
                    title: "Privacy",
                    description: "See our privacy policy or email privacy@cardr.ai."
                ) {
                    openURL(URL(string: "mailto:privacy@cardr.ai")!)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Support")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func supportCard(icon: String, title: String, description: String, action: String? = nil, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            CardSurface {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                            .frame(width: 38, height: 38)
                            .background(Theme.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                        Text(title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                    }
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.leading)
                    if let action {
                        Text(action)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.primary)
                            .underline()
                    }
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
    }
}
