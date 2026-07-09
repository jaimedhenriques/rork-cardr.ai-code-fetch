import SwiftUI
import UIKit

/// Ask-anything chat scoped to a single meeting note — the signature
/// Granola/Plaud feature. Answers are grounded only in this note's content.
struct NoteChatView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    let note: MeetingNote

    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var isLoading = false
    @FocusState private var inputFocused: Bool

    private let suggestions = [
        "Summarize this meeting in 3 bullets",
        "What did I commit to?",
        "What are the open questions?",
        "Draft a follow-up email",
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            if messages.isEmpty { emptyState }
                            ForEach(messages) { message in
                                bubble(message).id(message.id)
                            }
                            if isLoading { typingBubble.id("typing") }
                        }
                        .padding(16)
                    }
                    .onChange(of: messages.count) { _, _ in
                        guard let lastId = messages.last?.id else { return }
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                    .onChange(of: isLoading) { _, loading in
                        if loading { withAnimation { proxy.scrollTo("typing", anchor: .bottom) } }
                    }
                }
                inputBar
            }
            .background(Theme.background)
            .navigationTitle("Ask this meeting")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(Theme.brandGradient, in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text(note.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Text("Answers come only from this note.")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            .padding(.bottom, 2)
            Text("TRY ASKING")
                .font(.microLabel).tracking(0.8)
                .foregroundStyle(Theme.inkSecondary)
            ForEach(suggestions, id: \.self) { suggestion in
                Button { send(suggestion) } label: {
                    HStack {
                        Text(suggestion)
                            .font(.reading)
                            .foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.up.right")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 12)
    }

    private func bubble(_ message: ChatMessage) -> some View {
        HStack {
            if message.role == .user { Spacer(minLength: 40) }
            Text(message.content)
                .font(.reading)
                .lineSpacing(5)
                .foregroundStyle(message.role == .user ? .white : Theme.ink)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(
                    message.role == .user ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.surface),
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(message.role == .user ? .clear : Theme.border, lineWidth: 1)
                )
                .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
                .textSelection(.enabled)
            if message.role == .assistant { Spacer(minLength: 40) }
        }
    }

    private var typingBubble: some View {
        HStack(spacing: 5) {
            ForEach(0..<3) { i in
                Circle().fill(Theme.inkSecondary.opacity(0.5)).frame(width: 7, height: 7)
                    .scaleEffect(isLoading ? 1 : 0.6)
                    .animation(.easeInOut(duration: 0.5).repeatForever().delay(Double(i) * 0.15), value: isLoading)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Ask about this meeting…", text: $input, axis: .vertical)
                .font(.reading)
                .lineLimit(1...4)
                .focused($inputFocused)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                .onSubmit { send() }
            Button { send() } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(canSend ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.surfaceMuted), in: Circle())
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(!canSend)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Divider() }
    }

    private var canSend: Bool {
        !isLoading && !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func send(_ text: String? = nil) {
        let question = (text ?? input).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isLoading else { return }
        inputFocused = false
        let history = messages
        messages.append(ChatMessage(role: .user, content: question))
        input = ""
        isLoading = true
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task {
            let answer = await data.askNote(note, question: question, history: history)
            isLoading = false
            messages.append(ChatMessage(
                role: .assistant,
                content: answer ?? "Sorry, I couldn't answer that right now. Please try again."
            ))
            UINotificationFeedbackGenerator().notificationOccurred(answer == nil ? .error : .success)
        }
    }
}
