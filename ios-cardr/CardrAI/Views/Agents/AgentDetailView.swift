import SwiftUI

/// Agent detail — mirrors the web `AgentDetail`. Shows status with an
/// activate/pause toggle, the agent's instructions, and a remove action.
struct AgentDetailView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss
    let agentId: String

    private var agent: Agent? { data.agents.first { $0.id == agentId } }

    var body: some View {
        ScrollView {
            if let agent {
                VStack(alignment: .leading, spacing: 16) {
                    header(agent)
                    statusCard(agent)
                    instructions(agent)
                    removeButton(agent)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 40)
            } else {
                Text("Agent not found.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.inkSecondary)
                    .padding(.top, 60)
            }
        }
        .background(Theme.background)
        .navigationTitle(agent?.name ?? "Agent")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func header(_ agent: Agent) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.brandGradient)
                    .frame(width: 50, height: 50)
                Image(systemName: agent.symbol)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(agent.name)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.ink)
                if let description = agent.description, !description.isEmpty {
                    Text(description)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func statusCard(_ agent: Agent) -> some View {
        CardSurface(padding: 16) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Theme.primary.opacity(0.12))
                        .frame(width: 40, height: 40)
                    Image(systemName: "sparkles")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Status")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(agent.isActive ? "Ready to run" : "Paused")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer(minLength: 0)
                Toggle("", isOn: Binding(
                    get: { agent.isActive },
                    set: { _ in Task { await data.toggleAgentStatus(agent) } }
                ))
                .labelsHidden()
                .tint(Theme.primary)
            }
        }
    }

    private func instructions(_ agent: Agent) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Instructions")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.inkSecondary)
            CardSurface(padding: 16) {
                Text(agent.systemPrompt?.isEmpty == false
                     ? agent.systemPrompt!
                     : "This agent runs automatically in the background based on its type.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func removeButton(_ agent: Agent) -> some View {
        Button(role: .destructive) {
            Task {
                await data.deleteAgent(agent)
                dismiss()
            }
        } label: {
            HStack {
                Image(systemName: "trash")
                Text("Remove agent")
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Theme.destructive)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.destructive.opacity(0.1))
            .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(PressableButtonStyle())
        .padding(.top, 4)
    }
}
