import SwiftUI
import UIKit

/// A full-screen "show this to share" mode: a large, scannable QR code with the
/// user's name, designed to be held up for someone else to scan. Brightens the
/// screen and uses the selected card design for a premium hand-off moment.
struct CardShareScreen: View {
    @Environment(\.dismiss) private var dismiss

    let name: String
    let subtitle: String?
    let link: String
    let design: CardDesign

    @State private var appear = false
    @State private var previousBrightness: CGFloat = UIScreen.main.brightness

    var body: some View {
        ZStack {
            Rectangle()
                .fill(design.background)
                .ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer()

                VStack(spacing: 6) {
                    Text(name)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(design.foreground)
                        .multilineTextAlignment(.center)
                    if let subtitle {
                        Text(subtitle)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(design.foregroundSecondary)
                    }
                }

                QRCodeView(string: link, foreground: Theme.ink)
                    .frame(width: 260, height: 260)
                    .padding(22)
                    .background(.white)
                    .clipShape(.rect(cornerRadius: 28))
                    .shadow(color: .black.opacity(0.25), radius: 24, y: 12)
                    .scaleEffect(appear ? 1 : 0.85)
                    .opacity(appear ? 1 : 0)

                Label("Scan to save my contact", systemImage: "qrcode.viewfinder")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(design.foregroundSecondary)

                Spacer()
                Spacer()
            }
            .padding(.horizontal, 32)

            VStack {
                HStack {
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(design.foreground)
                            .frame(width: 42, height: 42)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                Spacer()
            }
        }
        .statusBarHidden()
        .onAppear {
            previousBrightness = UIScreen.main.brightness
            UIScreen.main.brightness = 1.0
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) { appear = true }
        }
        .onDisappear {
            UIScreen.main.brightness = previousBrightness
        }
    }
}
