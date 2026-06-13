import SwiftUI

/// CardrAI wordmark: "Card" in ink + accented "r" in brand blue.
/// Mirrors the web `CardrAIText`/`CardrAIWordmark` lockup (bold SF Pro, tight tracking).
struct CardrAIWordmark: View {
    var size: CGFloat = 28
    var textColor: Color = Theme.ink
    var accentColor: Color = Theme.primary

    var body: some View {
        HStack(spacing: 0) {
            Text("Card")
                .foregroundStyle(textColor)
            Text("r")
                .foregroundStyle(accentColor)
        }
        .font(.system(size: size, weight: .bold))
        .tracking(-size * 0.03)
    }
}

/// CardrAI icon mark: gradient rounded-square with an accented "r".
/// Mirrors the web `CardrAIIcon` — used as the app badge in headers and auth.
struct CardrAIIconMark: View {
    var size: CGFloat = 44

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(Theme.brandGradient)
            .frame(width: size, height: size)
            .overlay {
                Text("r")
                    .font(.system(size: size * 0.62, weight: .bold))
                    .tracking(-size * 0.03)
                    .foregroundStyle(.white)
                    .offset(y: -size * 0.02)
            }
            .shadow(color: Theme.primary.opacity(0.3), radius: size * 0.3, y: size * 0.18)
    }
}

#Preview {
    VStack(spacing: 24) {
        CardrAIIconMark(size: 64)
        CardrAIWordmark(size: 34)
    }
    .padding()
    .background(Theme.background)
}
