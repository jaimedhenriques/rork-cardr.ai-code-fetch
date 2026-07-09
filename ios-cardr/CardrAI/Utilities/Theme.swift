import SwiftUI

/// Central design tokens mirroring the CardrAI web brand (cream + ink + blue).
enum Theme {
    static let background = Color(hex: "F6F2EB")
    static let surface = Color.white
    static let surfaceMuted = Color(hex: "EFEAE1")
    static let ink = Color(hex: "1B1B21")
    static let inkSecondary = Color(hex: "6E6E78")
    static let border = Color(hex: "E5E1DA")
    static let success = Color(hex: "12B981")
    static let warning = Color(hex: "F6A609")
    static let destructive = Color(hex: "E04848")

    static let cardRadius: CGFloat = 18

    // MARK: - White-label brand colors

    /// Built-in CardrAI defaults, used when an org has no custom branding.
    private static let defaultPrimary = Color(hex: "3D82F5")
    private static let defaultAccent = Color(hex: "0DA3E8")

    /// Org-branding overrides as CSS-style HSL strings (e.g. "217 91% 60%").
    /// `nil` means "use the built-in default".
    private(set) static var brandPrimaryHSL: String?
    private(set) static var brandAccentHSL: String?

    /// The active primary brand color (custom override or default).
    static var primary: Color {
        if let brandPrimaryHSL, !brandPrimaryHSL.isEmpty { return Color(hslString: brandPrimaryHSL) }
        return defaultPrimary
    }

    /// The active accent brand color (custom override or default).
    static var accent: Color {
        if let brandAccentHSL, !brandAccentHSL.isEmpty { return Color(hslString: brandAccentHSL) }
        return defaultAccent
    }

    static var brandGradient: LinearGradient {
        LinearGradient(
            colors: [primary, accent],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    /// Applies org branding colors globally. Pass `nil` (or no custom branding)
    /// to revert to the built-in CardrAI palette. Mirrors the web `BrandingContext`.
    static func applyBranding(primary: String?, accent: String?) {
        brandPrimaryHSL = (primary?.isEmpty == false) ? primary : nil
        brandAccentHSL = (accent?.isEmpty == false) ? accent : nil
    }
}

// MARK: - Typography tokens (mirrors the web `.text-reading` / `.text-timestamp`)

extension Font {
    /// Granola/Otter-class reading size — for anything users actually read:
    /// transcripts, summaries, polished notes, action items. Never below 15pt.
    static let reading = Font.system(size: 15)
    static let readingSemibold = Font.system(size: 15, weight: .semibold)
    /// Speaker labels in transcripts — bigger and clearer than caption text.
    static let speakerLabel = Font.system(size: 13, weight: .semibold)
    /// Uppercase micro-labels (section eyebrows, tiny badges). Floor is 11pt —
    /// nothing readable sits below that.
    static let microLabel = Font.system(size: 11, weight: .bold)
}

extension View {
    /// App-wide reading style: 15pt with generous line height, matching the
    /// web notes typography pass.
    func readingStyle(_ color: Color = Theme.ink.opacity(0.85)) -> some View {
        self.font(.reading)
            .lineSpacing(5)
            .foregroundStyle(color)
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b, a: UInt64
        switch hex.count {
        case 3:
            (r, g, b, a) = ((int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17, 255)
        case 8:
            (r, g, b, a) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b, a) = (int >> 16, int >> 8 & 0xFF, int & 0xFF, 255)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    /// Creates a color from a CSS-style HSL string like "217 91% 60%".
    init(hslString: String) {
        let parts = hslString.split(whereSeparator: { $0 == " " || $0 == "%" })
            .compactMap { Double($0) }
        let h = (parts.count > 0 ? parts[0] : 217) / 360
        let s = (parts.count > 1 ? parts[1] : 91) / 100
        let l = (parts.count > 2 ? parts[2] : 60) / 100

        func hue(_ p: Double, _ q: Double, _ tIn: Double) -> Double {
            var t = tIn
            if t < 0 { t += 1 }
            if t > 1 { t -= 1 }
            if t < 1.0 / 6 { return p + (q - p) * 6 * t }
            if t < 1.0 / 2 { return q }
            if t < 2.0 / 3 { return p + (q - p) * (2.0 / 3 - t) * 6 }
            return p
        }

        let r: Double, g: Double, b: Double
        if s == 0 {
            r = l; g = l; b = l
        } else {
            let q = l < 0.5 ? l * (1 + s) : l + s - l * s
            let p = 2 * l - q
            r = hue(p, q, h + 1.0 / 3)
            g = hue(p, q, h)
            b = hue(p, q, h - 1.0 / 3)
        }
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }

    /// Serializes this color to a CSS-style HSL string like "217 91% 60%".
    var hslString: String {
        let ui = UIColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        ui.getRed(&r, green: &g, blue: &b, alpha: &a)
        let maxV = max(r, g, b), minV = min(r, g, b)
        let l = (maxV + minV) / 2
        var h: CGFloat = 0
        var s: CGFloat = 0
        if maxV != minV {
            let d = maxV - minV
            s = l > 0.5 ? d / (2 - maxV - minV) : d / (maxV + minV)
            switch maxV {
            case r: h = (g - b) / d + (g < b ? 6 : 0)
            case g: h = (b - r) / d + 2
            default: h = (r - g) / d + 4
            }
            h /= 6
        }
        return "\(Int((h * 360).rounded())) \(Int((s * 100).rounded()))% \(Int((l * 100).rounded()))%"
    }
}

/// A reusable elevated card surface used across screens.
struct CardSurface<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: Theme.cardRadius))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cardRadius)
                    .stroke(Theme.border, lineWidth: 1)
            )
            .shadow(color: Theme.ink.opacity(0.05), radius: 12, x: 0, y: 6)
    }
}
