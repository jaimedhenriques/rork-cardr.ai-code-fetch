import SwiftUI

/// Automations — mirrors the web `Automations` page. Lists multi-step outreach
/// sequences and their runs (enrolled contacts), backed by the live tables.
struct AutomationsView: View {
    @Environment(DataStore.self) private var data
    @State private var loaded = false
    @State private var tab: AutoTab = .sequences
    @State private var showCreate = false
    @State private var enrollFor: String?
    @State private var reviewRun: SequenceRun?

    enum AutoTab: String, CaseIterable, Identifiable {
        case sequences = "Sequences"
        case runs = "Runs"
        var id: String { rawValue }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                picker
                switch tab {
                case .sequences: sequencesList
                case .runs: runsList
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Automations")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .task {
            guard !loaded else { return }
            loaded = true
            await data.loadSequences()
        }
        .refreshable { await data.loadSequences() }
        .sheet(isPresented: $showCreate) { CreateSequenceSheet() }
        .sheet(item: Binding(get: { enrollFor.map(EnrollTarget.init) }, set: { enrollFor = $0?.id })) { target in
            EnrollContactsView(sequenceId: target.id)
        }
        .sheet(item: $reviewRun) { run in
            ReviewRunSheet(run: run)
        }
    }

    private struct EnrollTarget: Identifiable { let id: String }

    private var picker: some View {
        Picker("", selection: $tab) {
            ForEach(AutoTab.allCases) { t in
                Text("\(t.rawValue) (\(t == .sequences ? data.sequences.count : data.sequenceRuns.count))")
                    .tag(t)
            }
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private var sequencesList: some View {
        if data.sequences.isEmpty {
            VStack(spacing: 14) {
                emptyState(
                    icon: "arrow.triangle.branch",
                    title: "No sequences yet",
                    message: "Create an AI-generated multi-step outreach sequence for LinkedIn and email."
                )
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showCreate = true
                } label: {
                    Label("Create your first sequence", systemImage: "sparkles")
                        .font(.system(size: 14, weight: .semibold))
                        .padding(.horizontal, 18).padding(.vertical, 11)
                        .background(Theme.primary).foregroundStyle(.white)
                        .clipShape(Capsule())
                }
                .buttonStyle(PressableButtonStyle())
            }
        } else {
            ForEach(data.sequences) { sequence in
                sequenceCard(sequence)
            }
        }
    }

    private func sequenceCard(_ sequence: AutomationSequence) -> some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(sequence.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    if let channel = sequence.channel {
                        chip(channel, Theme.primary)
                    }
                    if let tone = sequence.tone {
                        chip(tone, Theme.accent)
                    }
                    Spacer(minLength: 0)
                }
                if let description = sequence.description, !description.isEmpty {
                    Text(description)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.inkSecondary)
                }
                HStack(spacing: 6) {
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 11))
                    Text("\(data.runCount(forSequence: sequence.id)) enrolled")
                        .font(.system(size: 12))
                    Spacer(minLength: 0)
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        enrollFor = sequence.id
                    } label: {
                        Label("Enroll", systemImage: "person.badge.plus")
                            .font(.system(size: 12, weight: .semibold))
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(Theme.primary.opacity(0.12)).foregroundStyle(Theme.primary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(PressableButtonStyle())
                }
                .foregroundStyle(Theme.inkSecondary)
            }
        }
        .contextMenu {
            Button(role: .destructive) {
                Task { await data.deleteSequence(sequence) }
            } label: {
                Label("Delete sequence", systemImage: "trash")
            }
        }
    }

    @ViewBuilder
    private var runsList: some View {
        if data.sequenceRuns.isEmpty {
            emptyState(
                icon: "paperplane.fill",
                title: "No active runs",
                message: "Enroll contacts into a sequence to see their outreach runs here."
            )
        } else {
            ForEach(data.sequenceRuns) { run in
                runCard(run)
            }
        }
    }

    private func runCard(_ run: SequenceRun) -> some View {
        let contact = data.contacts.first { $0.id == run.contactId }
        let sequence = data.sequences.first { $0.id == run.sequenceId }
        return Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            reviewRun = run
        } label: {
        CardSurface(padding: 14) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.primary.opacity(0.12)).frame(width: 38, height: 38)
                    Text(String((contact?.name.first ?? "?")).uppercased())
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.primary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(contact?.name ?? "Contact")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text(sequence?.name ?? "Sequence")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                statusBadge(run.status)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            }
        }
        }
        .buttonStyle(PressableButtonStyle())
    }

    private func statusBadge(_ status: String) -> some View {
        let tint: Color = {
            switch status {
            case "running": return Theme.success
            case "completed": return Theme.primary
            case "cancelled": return Theme.destructive
            case "approved": return Theme.accent
            default: return Theme.inkSecondary
            }
        }()
        return Text(status.capitalized)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tint.opacity(0.12))
            .clipShape(Capsule())
    }

    private func chip(_ text: String, _ tint: Color) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(tint.opacity(0.12))
            .clipShape(Capsule())
    }

    private func emptyState(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 50)
        .padding(.horizontal, 12)
    }
}
