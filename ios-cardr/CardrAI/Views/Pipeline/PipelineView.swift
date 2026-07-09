import SwiftUI
import UIKit

/// Native CRM pipeline — mirrors the web `Pipeline` page: a horizontal stage
/// summary, collapsible stage sections, and per-contact stage moves.
struct PipelineView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var expandedStage: String?
    @State private var showSettings = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if !data.stages.isEmpty {
                    summaryRow
                }
                stageSections
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Pipeline")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showSettings = true } label: {
                    Image(systemName: "slider.horizontal.3")
                }
            }
        }
        .overlay {
            if data.isLoadingStages && data.stages.isEmpty {
                ProgressView().tint(Theme.primary)
            }
        }
        .sheet(isPresented: $showSettings) {
            StageSettingsView()
        }
        .refreshable { await data.loadAll() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Sales Pipeline")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.ink)
            Text("\(data.contacts.count) leads · \(data.stages.count) stages")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var summaryRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(data.stages) { stage in
                    summaryCard(stage)
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func summaryCard(_ stage: PipelineStage) -> some View {
        let count = data.contacts(in: stage.id).count
        let total = max(data.stagedContactCount, 1)
        let pct = min(1.0, Double(count) / Double(total))
        let color = Color(hex: String(stage.color.dropFirst()))
        let isExpanded = expandedStage == stage.id
        return Button {
            withAnimation(.snappy(duration: 0.25)) {
                expandedStage = isExpanded ? nil : stage.id
            }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 5) {
                    Circle().fill(color).frame(width: 7, height: 7)
                    Text(stage.name)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                }
                Text("\(count)")
                    .font(.system(size: 17, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
                GeometryReader { geo in
                    Capsule().fill(Theme.surfaceMuted)
                        .overlay(alignment: .leading) {
                            Capsule().fill(color).frame(width: geo.size.width * pct)
                        }
                }
                .frame(height: 4)
            }
            .padding(10)
            .frame(width: 92, alignment: .leading)
            .background(isExpanded ? color.opacity(0.08) : Theme.surface)
            .clipShape(.rect(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isExpanded ? color.opacity(0.6) : Theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(PressableButtonStyle())
    }

    @ViewBuilder
    private var stageSections: some View {
        let unstaged = data.contacts(in: nil)
        if !unstaged.isEmpty {
            stageSection(
                id: "unstaged",
                title: "Unassigned",
                color: Theme.inkSecondary,
                contacts: unstaged,
                currentStageId: nil
            )
        }
        ForEach(data.stages) { stage in
            stageSection(
                id: stage.id,
                title: stage.name,
                color: Color(hex: String(stage.color.dropFirst())),
                contacts: data.contacts(in: stage.id),
                currentStageId: stage.id
            )
        }
    }

    private func stageSection(
        id: String,
        title: String,
        color: Color,
        contacts: [Contact],
        currentStageId: String?
    ) -> some View {
        let isExpanded = expandedStage == id
        return VStack(spacing: 0) {
            Button {
                withAnimation(.snappy(duration: 0.25)) {
                    expandedStage = isExpanded ? nil : id
                }
            } label: {
                HStack(spacing: 12) {
                    Circle().fill(color).frame(width: 11, height: 11)
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                    Text("\(contacts.count)")
                        .font(.system(size: 13))
                        .monospacedDigit()
                        .foregroundStyle(Theme.inkSecondary)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                .padding(14)
                .background(Theme.surface)
                .clipShape(.rect(cornerRadius: Theme.cardRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cardRadius)
                        .stroke(Theme.border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(spacing: 8) {
                    if contacts.isEmpty {
                        emptyStage(color: color)
                    } else {
                        ForEach(contacts) { contact in
                            PipelineContactCard(contact: contact, currentStageId: currentStageId)
                        }
                    }
                }
                .padding(.top, 8)
                .padding(.leading, 12)
            }
        }
    }

    private func emptyStage(color: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: "plus")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 36, height: 36)
                .background(color.opacity(0.12))
                .clipShape(.rect(cornerRadius: 10))
            Text("No contacts yet")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.inkSecondary)
            Text("Move contacts here from other stages")
                .font(.system(size: 11))
                .foregroundStyle(Theme.inkSecondary.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
    }
}

/// A single contact inside a pipeline stage, with an inline stage picker.
private struct PipelineContactCard: View {
    @Environment(DataStore.self) private var data
    let contact: Contact
    let currentStageId: String?

    @State private var showMove = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(Theme.brandGradient.opacity(0.15))
                    Text(contact.initials)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.primary)
                }
                .frame(width: 34, height: 34)

                VStack(alignment: .leading, spacing: 2) {
                    Text(contact.name)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    if !contact.subtitle.isEmpty {
                        Text(contact.subtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.inkSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                Button {
                    withAnimation(.snappy(duration: 0.2)) { showMove.toggle() }
                } label: {
                    Text("Move")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                }
                .buttonStyle(.plain)
            }

            if let raw = contact.followUpDate, let label = Self.followUp(raw) {
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.system(size: 11))
                    Text("Follow-up: \(label)")
                        .font(.system(size: 11, weight: .medium))
                        .monospacedDigit()
                    Spacer()
                }
                .foregroundStyle(Theme.warning)
                .padding(.top, 6)
            }

            if showMove {
                Divider().padding(.vertical, 8)
                FlowChips(stages: data.stages.filter { $0.id != currentStageId }) { stage in
                    Task { await data.moveContact(contact, to: stage.id) }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation { showMove = false }
                }
            }
        }
        .padding(12)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1)
        )
    }

    private static func followUp(_ raw: String) -> String? {
        let iso = ISO8601DateFormatter()
        let date: Date
        if let d = iso.date(from: raw) {
            date = d
        } else {
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            guard let d = f.date(from: String(raw.prefix(10))) else { return nil }
            date = d
        }
        let out = DateFormatter()
        out.dateFormat = "MMM d"
        return out.string(from: date)
    }
}

/// Wrapping chip layout for the stage move picker.
private struct FlowChips: View {
    let stages: [PipelineStage]
    let onSelect: (PipelineStage) -> Void

    private let columns = [GridItem(.adaptive(minimum: 84), spacing: 6)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 6) {
            ForEach(stages) { stage in
                let color = Color(hex: String(stage.color.dropFirst()))
                Button { onSelect(stage) } label: {
                    Text(stage.name)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(color)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .frame(maxWidth: .infinity)
                        .background(color.opacity(0.1))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(color.opacity(0.35), lineWidth: 1))
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
    }
}

/// Manage pipeline stages: add a custom stage or remove existing ones.
private struct StageSettingsView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var newName = ""
    @State private var selectedColor = PipelineDefaults.palette[0]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(data.stages) { stage in
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Color(hex: String(stage.color.dropFirst())))
                                .frame(width: 12, height: 12)
                            Text(stage.name)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Text("\(data.contacts(in: stage.id).count)")
                                .font(.system(size: 12))
                                .monospacedDigit()
                                .foregroundStyle(Theme.inkSecondary)
                            Button {
                                Task { await data.deleteStage(stage) }
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.destructive)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 4)
                    }

                    Divider()

                    Text("Add a stage")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    HStack(spacing: 8) {
                        ForEach(PipelineDefaults.palette, id: \.self) { hex in
                            let color = Color(hex: String(hex.dropFirst()))
                            Button { selectedColor = hex } label: {
                                Circle()
                                    .fill(color)
                                    .frame(width: 24, height: 24)
                                    .overlay(
                                        Circle().stroke(Theme.ink, lineWidth: selectedColor == hex ? 2 : 0)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    HStack(spacing: 8) {
                        TextField("Stage name", text: $newName)
                            .textFieldStyle(.plain)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Theme.surfaceMuted)
                            .clipShape(.rect(cornerRadius: 12))
                        Button {
                            let name = newName
                            let color = selectedColor
                            Task { await data.addStage(name: name, color: color) }
                            newName = ""
                        } label: {
                            Text("Add")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(Theme.brandGradient)
                                .clipShape(.rect(cornerRadius: 12))
                        }
                        .buttonStyle(PressableButtonStyle())
                        .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Manage Stages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
