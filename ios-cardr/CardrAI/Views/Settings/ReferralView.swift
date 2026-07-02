import SwiftUI

/// Referral dashboard — mirrors the web `ReferralDashboard`. Shows the user's
/// referral code, share link, and a list of who they've invited.
struct ReferralView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.openURL) private var openURL
    @State private var shareSheet = false
    @State private var copied = false

    private var referralCode: String {
        data.profile?.cardSlug?.uppercased() ?? "CARDR"
    }

    private var referralLink: String {
        "https://cardr.ai/r/\(data.profile?.cardSlug ?? "")"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                heroCard
                rewardsCard
                howItWorksCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Referrals")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $shareSheet) {
            ShareSheet(items: ["Join me on Cardr — \(referralLink)"])
        }
    }

    private var heroCard: some View {
        CardSurface(padding: 24) {
            VStack(spacing: 16) {
                ZStack {
                    Circle().fill(Theme.brandGradient.opacity(0.15)).frame(width: 72, height: 72)
                    Image(systemName: "gift.fill")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                }
                VStack(spacing: 4) {
                    Text("Refer a friend, earn rewards")
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text("Share Cardr with your network and both of you get 1 month of Pro free.")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 10) {
                    HStack {
                        Text("Your code")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.inkSecondary)
                        Spacer()
                        Text(referralCode)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Theme.ink)
                            .monospaced()
                    }
                    HStack {
                        Text("Your link")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.inkSecondary)
                        Spacer()
                        Text(referralLink)
                            .font(.caption2)
                            .foregroundStyle(Theme.primary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }
                .padding(12)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 12))

                HStack(spacing: 10) {
                    Button {
                        UIPasteboard.general.string = referralLink
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                        withAnimation { copied = true }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { withAnimation { copied = false } }
                    } label: {
                        Label(copied ? "Copied!" : "Copy link", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .foregroundStyle(Theme.primary)
                            .background(Theme.primary.opacity(0.1))
                            .clipShape(.rect(cornerRadius: 12))
                    }
                    .buttonStyle(PressableButtonStyle())

                    Button {
                        shareSheet = true
                    } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .foregroundStyle(.white)
                            .background(Theme.brandGradient)
                            .clipShape(.rect(cornerRadius: 12))
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }
        }
    }

    private var rewardsCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 12) {
                Label("Your rewards", systemImage: "rosette")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                HStack(spacing: 16) {
                    stat("0", "Friends referred")
                    stat("0", "Months earned")
                    stat("0", "Pending")
                }
            }
        }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2.weight(.bold))
                .foregroundStyle(Theme.ink)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var howItWorksCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 14) {
                Label("How it works", systemImage: "questionmark.circle")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)

                stepRow("1", "Share your link", "Send your unique referral link to a friend.")
                stepRow("2", "They sign up", "Your friend creates a Cardr account using your link.")
                stepRow("3", "You both get rewarded", "Both of you receive 1 month of Pro — free.")
            }
        }
    }

    private func stepRow(_ number: String, _ title: String, _ description: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Theme.brandGradient, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.ink)
                Text(description)
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 0)
        }
    }
}
