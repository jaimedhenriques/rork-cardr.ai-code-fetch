import SwiftUI

/// A first-time onboarding sheet explaining how to scan, shown once.
/// Mirrors the web `showHowTo` overlay.
struct ScanHowToView: View {
    @Environment(\.dismiss) private var dismiss
    let onGotIt: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(Theme.primary.opacity(0.12))
                                .frame(width: 80, height: 80)
                            Image(systemName: "viewfinder")
                                .font(.system(size: 32, weight: .semibold))
                                .foregroundStyle(Theme.primary)
                        }
                        Text("Scan any badge or card")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Theme.ink)
                        Text("Point your camera at a business card or event badge. We'll read the details, save the contact, and enrich it with AI — automatically.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.inkSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 8)

                    VStack(alignment: .leading, spacing: 18) {
                        howToRow(
                            icon: "checkmark.seal",
                            title: "Event Badge",
                            description: "Capture the full badge including all text. Works best in good lighting."
                        )
                        howToRow(
                            icon: "creditcard",
                            title: "Paper Card",
                            description: "Frame the card in the viewfinder. Hold steady for auto-capture."
                        )
                        howToRow(
                            icon: "qrcode",
                            title: "LinkedIn QR",
                            description: "Point at a LinkedIn QR code. We'll read it instantly and pull the profile."
                        )
                        howToRow(
                            icon: "square.stack.3d.up",
                            title: "Batch Mode",
                            description: "Turn on batch mode to scan multiple cards in one go, then export them all."
                        )
                        howToRow(
                            icon: "sparkles",
                            title: "AI Enrichment",
                            description: "Every scanned contact gets a verified email, phone, and LinkedIn in the background."
                        )
                    }

                    HStack {
                        Spacer()
                        Text("Tap Got it to dismiss this guide permanently.")
                            .font(.caption)
                            .foregroundStyle(Theme.inkSecondary.opacity(0.7))
                        Spacer()
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 32)
            }
            .background(Theme.background)
            .navigationTitle("How to Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Got it") {
                        onGotIt()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }

    private func howToRow(icon: String, title: String, description: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.primary)
                .frame(width: 40, height: 40)
                .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(description)
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 0)
        }
    }
}
