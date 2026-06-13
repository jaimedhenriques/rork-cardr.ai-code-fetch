import SwiftUI

/// A small pill used to mark features that are not yet functional.
struct UpcomingBadge: View {
    var label: String = "Upcoming"

    var body: some View {
        Label(label, systemImage: "sparkles")
            .font(.caption2.weight(.bold))
            .textCase(.uppercase)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Theme.warning.opacity(0.16))
            .foregroundStyle(Theme.warning)
            .clipShape(.capsule)
    }
}
