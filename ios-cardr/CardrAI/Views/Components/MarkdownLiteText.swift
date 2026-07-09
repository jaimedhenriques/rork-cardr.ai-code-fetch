import SwiftUI

/// Lightweight renderer for AI-polished notes markdown (headings, bullets,
/// inline bold), mirroring the web `renderMarkdownLite`.
struct MarkdownLiteText: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                lineView(line)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var lines: [String] {
        text.split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
    }

    @ViewBuilder
    private func lineView(_ line: String) -> some View {
        if line.isEmpty {
            Color.clear.frame(height: 2)
        } else if line.hasPrefix("#") {
            let level = line.prefix(4).prefix(while: { $0 == "#" }).count
            Text(inline(line.replacingOccurrences(of: "^#{1,4}\\s*", with: "", options: .regularExpression)))
                .font(headingFont(level))
                .foregroundStyle(Theme.ink)
                .padding(.top, level <= 1 ? 8 : 6)
        } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
            HStack(alignment: .top, spacing: 8) {
                Circle()
                    .fill(Theme.primary)
                    .frame(width: 4, height: 4)
                    .padding(.top, 8)
                Text(inline(String(line.dropFirst(2))))
                    .readingStyle()
            }
        } else {
            Text(inline(line))
                .readingStyle()
        }
    }

    /// Real heading hierarchy (mirrors the web polished-notes renderer):
    /// # → 20pt bold, ## → 17pt bold, ### and deeper → 15pt semibold.
    private func headingFont(_ level: Int) -> Font {
        switch level {
        case 1: return .system(size: 20, weight: .bold)
        case 2: return .system(size: 17, weight: .bold)
        default: return .system(size: 15, weight: .semibold)
        }
    }

    /// Parses inline markdown (bold/italic) into an AttributedString.
    private func inline(_ raw: String) -> AttributedString {
        (try? AttributedString(markdown: raw)) ?? AttributedString(raw)
    }
}
