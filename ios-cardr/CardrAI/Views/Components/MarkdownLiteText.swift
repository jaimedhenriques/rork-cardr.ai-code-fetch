import SwiftUI

/// Lightweight renderer for AI-polished notes markdown (headings, bullets,
/// inline bold), mirroring the web `renderMarkdownLite`.
struct MarkdownLiteText: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
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
            Text(inline(line.replacingOccurrences(of: "^#{1,4}\\s*", with: "", options: .regularExpression)))
                .font(.footnote.weight(.bold))
                .foregroundStyle(Theme.ink)
                .padding(.top, 4)
        } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
            HStack(alignment: .top, spacing: 8) {
                Circle()
                    .fill(Theme.primary)
                    .frame(width: 4, height: 4)
                    .padding(.top, 7)
                Text(inline(String(line.dropFirst(2))))
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink.opacity(0.85))
            }
        } else {
            Text(inline(line))
                .font(.subheadline)
                .foregroundStyle(Theme.ink.opacity(0.85))
        }
    }

    /// Parses inline markdown (bold/italic) into an AttributedString.
    private func inline(_ raw: String) -> AttributedString {
        (try? AttributedString(markdown: raw)) ?? AttributedString(raw)
    }
}
