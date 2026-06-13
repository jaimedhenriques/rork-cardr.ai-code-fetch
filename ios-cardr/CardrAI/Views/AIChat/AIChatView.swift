import SwiftUI
import UIKit

/// Native AI assistant — mirrors the web `AIChat` page. Streams answers and
/// can act on contacts via tool calls handled in `AIChatViewModel`.
struct AIChatView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss
    @State private var model: AIChatViewModel?

    var body: some View {
        Group {
            if let model {
                content(model)
            } else {
                Color.clear
            }
        }
        .onAppear {
            if model == nil {
                model = AIChatViewModel(session: session, data: data)
            }
        }
    }

    private func content(_ model: AIChatViewModel) -> some View {
        VStack(spacing: 0) {
            header
            messages(model)
            inputBar(model)
        }
        .background(Theme.background)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Theme.brandGradient)
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: "sparkles")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .shadow(color: Theme.primary.opacity(0.4), radius: 10, y: 5)
            VStack(alignment: .leading, spacing: 2) {
                Text("AI Assistant")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.ink)
                Text("Ask about your network")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Theme.background)
    }

    // MARK: - Messages

    private func messages(_ model: AIChatViewModel) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    if model.messages.isEmpty {
                        emptyState(model)
                    }
                    ForEach(model.messages) { message in
                        bubble(message)
                            .id(message.id)
                    }
                    if model.isLoading && model.messages.last?.role == .user {
                        typingBubble.id("typing")
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: model.messages.last?.content) {
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .onChange(of: model.isLoading) {
                withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
            }
        }
    }

    private func emptyState(_ model: AIChatViewModel) -> some View {
        VStack(spacing: 16) {
            Text("Ask me anything about your contacts, pipeline, notes, or events. I can even create and update contacts for you.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
                .padding(.top, 24)

            FlowChips(items: model.suggestions) { suggestion in
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    Task { await model.send(suggestion) }
                } label: {
                    Text(suggestion)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Theme.primary.opacity(0.1))
                        .clipShape(Capsule())
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
    }

    private func bubble(_ message: ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 8) {
            if message.role == .assistant {
                avatar(system: "sparkles", tint: Theme.primary, background: Theme.primary.opacity(0.12))
            } else {
                Spacer(minLength: 40)
            }

            Text(message.content.isEmpty ? " " : message.content)
                .font(.system(size: 14))
                .foregroundStyle(message.role == .user ? .white : Theme.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    Group {
                        if message.role == .user {
                            Theme.brandGradient
                        } else {
                            Theme.surface
                        }
                    }
                )
                .clipShape(.rect(cornerRadius: 18))
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .stroke(message.role == .user ? .clear : Theme.border, lineWidth: 1)
                )
                .frame(maxWidth: 280, alignment: message.role == .user ? .trailing : .leading)

            if message.role == .assistant {
                Spacer(minLength: 40)
            } else {
                avatar(system: "person.fill", tint: Theme.inkSecondary, background: Theme.surfaceMuted)
            }
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private var typingBubble: some View {
        HStack(alignment: .top, spacing: 8) {
            avatar(system: "sparkles", tint: Theme.primary, background: Theme.primary.opacity(0.12))
            ProgressView()
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Theme.surface)
                .clipShape(.rect(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
            Spacer(minLength: 40)
        }
    }

    private func avatar(system: String, tint: Color, background: Color) -> some View {
        RoundedRectangle(cornerRadius: 9, style: .continuous)
            .fill(background)
            .frame(width: 28, height: 28)
            .overlay {
                Image(systemName: system)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(tint)
            }
    }

    // MARK: - Input

    private func inputBar(_ model: AIChatViewModel) -> some View {
        @Bindable var model = model
        return HStack(spacing: 10) {
            TextField("Ask anything…", text: $model.input, axis: .vertical)
                .font(.system(size: 14))
                .lineLimit(1...4)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Theme.surfaceMuted)
                .clipShape(.rect(cornerRadius: 20))
                .disabled(model.isLoading)
                .submitLabel(.send)

            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                Task { await model.send() }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(model.canSend ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.inkSecondary.opacity(0.3)))
                    .clipShape(Circle())
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(!model.canSend)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Divider()
        }
    }
}

/// Simple wrapping flow layout for suggestion chips.
private struct FlowChips<Item: Hashable, Content: View>: View {
    let items: [Item]
    @ViewBuilder let content: (Item) -> Content

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.self) { item in
                content(item)
            }
        }
    }
}

/// A minimal flow layout that wraps its children onto multiple lines.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rows: [[LayoutSubviews.Element]] = [[]]
        var x: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && !(rows[rows.count - 1].isEmpty) {
                totalHeight += rowHeight + spacing
                rowHeight = 0
                x = 0
                rows.append([])
            }
            rows[rows.count - 1].append(subview)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth && x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
