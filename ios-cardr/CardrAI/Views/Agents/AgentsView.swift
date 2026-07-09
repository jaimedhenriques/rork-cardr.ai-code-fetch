import SwiftUI

/// Agents hub — mirrors the web `Agents` page. Lists the user's installed agents
/// and the template catalog they can install, backed by the live `agents` table.
struct AgentsView: View {
    @Environment(DataStore.self) private var data
    @State private var loaded = false
    @State private var installing: String?
    @State private var path: [Agent] = []

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    hero
                    AgentActivityFeed()
                    if !data.myAgents.isEmpty {
                        sectionHeader("Your agents")
                        ForEach(data.myAgents) { agent in
                            NavigationLink(value: agent) {
                                installedCard(agent)
                            }
                            .buttonStyle(PressableButtonStyle())
                        }
                    }
                    sectionHeader(data.agentTemplates.isEmpty ? "Agent catalog" : "Add an agent")
                    if data.agentTemplates.isEmpty {
                        ForEach(fallbackTemplates) { t in fallbackCard(t) }
                    } else {
                        ForEach(data.agentTemplates) { template in
                            templateCard(template)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .background(Theme.background)
            .navigationTitle("Agents")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { DrawerMenuButton() }
            }
            .navigationDestination(for: Agent.self) { agent in
                AgentDetailView(agentId: agent.id)
            }
            .task {
                guard !loaded else { return }
                loaded = true
                await data.loadAgents()
                await data.loadRecentAgentRuns()
            }
            .refreshable {
                await data.loadAgents()
                await data.loadRecentAgentRuns()
            }
        }
        .tint(Theme.primary)
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(Theme.inkSecondary)
            .padding(.top, 4)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.brandGradient)
                    .frame(width: 46, height: 46)
                Image(systemName: "cpu")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .shadow(color: Theme.primary.opacity(0.4), radius: 12, y: 6)
            Text("AI Agents")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.ink)
            Text("Put your network on autopilot. Agents work in the background to follow up, enrich, and score your contacts.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.border, lineWidth: 1))
    }

    private func installedCard(_ agent: Agent) -> some View {
        CardSurface(padding: 16) {
            HStack(spacing: 14) {
                iconBadge(agent.symbol, Theme.primary)
                VStack(alignment: .leading, spacing: 3) {
                    Text(agent.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(agent.description ?? "")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                statusPill(agent.isActive)
            }
        }
    }

    private func templateCard(_ template: Agent) -> some View {
        CardSurface(padding: 16) {
            HStack(spacing: 14) {
                iconBadge(template.symbol, Theme.accent)
                VStack(alignment: .leading, spacing: 3) {
                    Text(template.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(template.description ?? "")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                Button {
                    Task {
                        installing = template.id
                        await data.installAgent(template)
                        installing = nil
                    }
                } label: {
                    if installing == template.id {
                        ProgressView().tint(.white).frame(width: 60, height: 30)
                    } else {
                        Text("Add")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 60, height: 30)
                            .background(Theme.primary)
                            .clipShape(Capsule())
                    }
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
    }

    private func fallbackCard(_ t: FallbackTemplate) -> some View {
        CardSurface(padding: 16) {
            HStack(spacing: 14) {
                iconBadge(t.icon, t.tint)
                VStack(alignment: .leading, spacing: 3) {
                    Text(t.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(t.description)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private func iconBadge(_ icon: String, _ tint: Color) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(tint.opacity(0.14))
                .frame(width: 44, height: 44)
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(tint)
        }
    }

    private func statusPill(_ active: Bool) -> some View {
        Text(active ? "Active" : "Paused")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(active ? Theme.success : Theme.inkSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background((active ? Theme.success : Theme.inkSecondary).opacity(0.12))
            .clipShape(Capsule())
    }

    struct FallbackTemplate: Identifiable {
        let id = UUID()
        let name: String
        let description: String
        let icon: String
        let tint: Color
    }

    private let fallbackTemplates: [FallbackTemplate] = [
        FallbackTemplate(name: "Follow-up agent", description: "Drafts personalized follow-ups for contacts you met recently.", icon: "envelope.badge.fill", tint: Theme.primary),
        FallbackTemplate(name: "Enrichment agent", description: "Continuously fills in missing details across your contacts.", icon: "sparkles", tint: Theme.success),
        FallbackTemplate(name: "Lead scorer", description: "Ranks your pipeline by who's most worth your time.", icon: "chart.line.uptrend.xyaxis", tint: Theme.accent),
        FallbackTemplate(name: "Recap agent", description: "Summarizes each event into a clean recap with next steps.", icon: "doc.text.magnifyingglass", tint: Theme.warning),
    ]
}
