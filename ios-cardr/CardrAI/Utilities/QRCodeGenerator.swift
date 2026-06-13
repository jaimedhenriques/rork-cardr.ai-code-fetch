import SwiftUI
import CoreImage.CIFilterBuiltins
import UIKit

/// Generates crisp QR codes for the user's digital card link, with optional
/// brand-tinted foreground. Cached by string + color for fast re-renders.
enum QRCodeGenerator {
    private static let context = CIContext()
    private static var cache: [String: UIImage] = [:]

    /// Returns a high-resolution QR `UIImage` for `string`, tinted `foreground`
    /// on a transparent background. Returns nil if generation fails.
    static func image(for string: String, foreground: UIColor = .black, scale: CGFloat = 12) -> UIImage? {
        let key = "\(string)|\(foreground.hashValue)|\(scale)"
        if let cached = cache[key] { return cached }

        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let base = filter.outputImage else { return nil }

        let transformed = base.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        // Tint: map black modules to the brand color, keep background transparent.
        let colorFilter = CIFilter.falseColor()
        colorFilter.inputImage = transformed
        colorFilter.color0 = CIColor(color: foreground)
        colorFilter.color1 = CIColor(red: 1, green: 1, blue: 1, alpha: 0)
        guard let tinted = colorFilter.outputImage,
              let cgImage = context.createCGImage(tinted, from: tinted.extent) else { return nil }

        let result = UIImage(cgImage: cgImage)
        cache[key] = result
        return result
    }
}

/// A SwiftUI view that renders the QR code for a card link.
struct QRCodeView: View {
    let string: String
    var foreground: Color = Theme.ink

    var body: some View {
        if let image = QRCodeGenerator.image(for: string, foreground: UIColor(foreground)) {
            Image(uiImage: image)
                .resizable()
                .interpolation(.none)
                .aspectRatio(1, contentMode: .fit)
                .accessibilityLabel("QR code for your digital card")
        } else {
            RoundedRectangle(cornerRadius: 12)
                .fill(Theme.surfaceMuted)
                .overlay(
                    Image(systemName: "qrcode")
                        .font(.largeTitle)
                        .foregroundStyle(Theme.inkSecondary)
                )
        }
    }
}
