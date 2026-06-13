import SwiftUI

/// An animated audio waveform for the live recorder. Renders a scrolling row of
/// bars driven by sampled microphone levels, with the brand gradient.
struct WaveformView: View {
    let levels: [CGFloat]
    var paused: Bool = false

    var body: some View {
        GeometryReader { geo in
            let count = levels.count
            let spacing: CGFloat = 3
            let barWidth = max(2, (geo.size.width - CGFloat(count - 1) * spacing) / CGFloat(count))
            HStack(alignment: .center, spacing: spacing) {
                ForEach(Array(levels.enumerated()), id: \.offset) { _, level in
                    Capsule()
                        .fill(paused ? AnyShapeStyle(Theme.inkSecondary.opacity(0.4)) : AnyShapeStyle(Theme.brandGradient))
                        .frame(width: barWidth, height: max(3, level * geo.size.height))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .animation(.easeOut(duration: 0.12), value: levels)
        }
    }
}
