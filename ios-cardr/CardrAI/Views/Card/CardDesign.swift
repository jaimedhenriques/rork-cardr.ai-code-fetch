import SwiftUI

/// Selectable visual themes for the user's digital card. Persisted locally via
/// `@AppStorage` so the choice sticks without any backend change.
enum CardDesign: String, CaseIterable, Identifiable {
    case gradient, dark, minimal, glass

    var id: String { rawValue }

    var label: String {
        switch self {
        case .gradient: return "Gradient"
        case .dark: return "Dark"
        case .minimal: return "Minimal"
        case .glass: return "Glass"
        }
    }

    /// Background style for the card face.
    var background: AnyShapeStyle {
        switch self {
        case .gradient: return AnyShapeStyle(Theme.brandGradient)
        case .dark: return AnyShapeStyle(
            LinearGradient(colors: [Color(hex: "1B1B21"), Color(hex: "2A2A35")],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        case .minimal: return AnyShapeStyle(Color.white)
        case .glass: return AnyShapeStyle(
            LinearGradient(colors: [Theme.primary.opacity(0.85), Theme.accent.opacity(0.7)],
                           startPoint: .top, endPoint: .bottom)
        )
        }
    }

    /// Primary text/foreground color on the card.
    var foreground: Color {
        switch self {
        case .gradient, .dark, .glass: return .white
        case .minimal: return Theme.ink
        }
    }

    /// Secondary (muted) foreground.
    var foregroundSecondary: Color {
        switch self {
        case .gradient, .dark, .glass: return .white.opacity(0.85)
        case .minimal: return Theme.inkSecondary
        }
    }

    /// QR foreground color for good contrast against the card.
    var qrForeground: Color {
        switch self {
        case .minimal: return Theme.ink
        default: return Theme.ink
        }
    }

    var usesGlassOverlay: Bool { self == .glass }
}
