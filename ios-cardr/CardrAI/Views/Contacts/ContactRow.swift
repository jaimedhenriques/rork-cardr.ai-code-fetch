import SwiftUI

struct ContactRow: View {
    let contact: Contact
    var showEngagement = false

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(Theme.brandGradient.opacity(0.15))
                Text(contact.initials)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.primary)
            }
            .frame(width: 46, height: 46)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 5) {
                    Text(contact.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    if contact.enriched == true {
                        Image(systemName: "sparkles")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.success)
                    }
                    if showEngagement {
                        let tier = Engagement.tier(for: contact)
                        Text(tier.rawValue)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(tier.color)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1.5)
                            .background(tier.color.opacity(0.12))
                            .clipShape(.rect(cornerRadius: 5))
                    }
                }
                if !contact.subtitle.isEmpty {
                    Text(contact.subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if contact.followUpDate != nil {
                Image(systemName: "bell.badge.fill")
                    .font(.caption)
                    .foregroundStyle(Theme.warning)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.border, lineWidth: 1)
        )
    }
}
