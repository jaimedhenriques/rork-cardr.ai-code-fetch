import SwiftUI

/// A single speaker turn parsed from a transcript. Used to render diarized
/// transcripts (e.g. "Speaker 1: …") as styled rows, Otter-style.
nonisolated struct TranscriptSegment: Identifiable {
    let id = UUID()
    let speaker: String?
    let text: String

    /// A stable color per speaker so each one reads consistently down the list.
    @MainActor var tint: Color {
        guard let speaker else { return Theme.inkSecondary }
        let palette: [Color] = [Theme.primary, Theme.success, Theme.warning, Theme.accent]
        let index = abs(speaker.hashValue) % palette.count
        return palette[index]
    }

    /// Splits a transcript into speaker-labelled segments. Lines beginning with a
    /// short "Label:" prefix (e.g. "Speaker 1:", "John:") start a new segment;
    /// other lines append to the current one. Returns a single unlabelled segment
    /// when no speaker labels are present.
    nonisolated static func parse(_ transcript: String) -> [TranscriptSegment] {
        let lines = transcript.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var segments: [(speaker: String?, text: String)] = []

        for rawLine in lines {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { continue }
            if let (speaker, rest) = speakerPrefix(line) {
                segments.append((speaker, rest))
            } else if var last = segments.popLast() {
                last.text += (last.text.isEmpty ? "" : " ") + line
                segments.append(last)
            } else {
                segments.append((nil, line))
            }
        }

        return segments
            .filter { !$0.text.trimmingCharacters(in: .whitespaces).isEmpty || $0.speaker != nil }
            .map { TranscriptSegment(speaker: $0.speaker, text: $0.text) }
    }

    /// Detects a leading "Label:" speaker prefix and returns (speaker, remainder).
    private nonisolated static func speakerPrefix(_ line: String) -> (String, String)? {
        guard let colon = line.firstIndex(of: ":") else { return nil }
        let label = String(line[line.startIndex..<colon]).trimmingCharacters(in: .whitespaces)
        // A plausible speaker label: short, no sentence punctuation, not empty.
        guard !label.isEmpty, label.count <= 24,
              label.split(separator: " ").count <= 3,
              !label.contains(where: { ".?!".contains($0) })
        else { return nil }
        let rest = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
        return (label, rest)
    }
}
