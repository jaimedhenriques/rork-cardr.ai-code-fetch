import SwiftUI

/// Lets the user toggle, reorder, and preset their dashboard widgets, and pin /
/// reorder the dashboard quick actions. Mirrors the web `DashboardCustomizer`
/// with its "Sections" and "Quick Actions" tabs.
struct DashboardCustomizerView: View {
    @Bindable var store: DashboardLayoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var editMode: EditMode = .active
    @State private var tab: CustomizerTab = .sections

    enum CustomizerTab: String, CaseIterable {
        case sections = "Sections"
        case actions = "Quick Actions"
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("", selection: $tab) {
                        ForEach(CustomizerTab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowBackground(Color.clear)
                }

                if tab == .sections {
                    sectionsContent
                } else {
                    quickActionsContent
                }
            }
            .environment(\.editMode, $editMode)
            .navigationTitle("Customize")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reset") {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        if tab == .sections { store.reset() } else { store.resetQuickActions() }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
    }

    // MARK: - Sections tab

    @ViewBuilder
    private var sectionsContent: some View {
        Section {
            presetGrid
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                .listRowBackground(Color.clear)
        } header: {
            Text("Layout presets")
        }

        Section {
            ForEach(store.sections) { section in
                sectionRow(section)
            }
            .onMove { store.move(from: $0, to: $1) }
        } header: {
            Text("Widgets")
        } footer: {
            Text("Drag to reorder. Tap the eye to show or hide a widget on your home screen.")
        }
    }

    private var presetGrid: some View {
        HStack(spacing: 8) {
            ForEach(DashboardLayout.presets) { preset in
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    withAnimation(.easeInOut(duration: 0.25)) { store.applyPreset(preset.id) }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Label(preset.label, systemImage: "sparkles")
                            .font(.system(size: 11, weight: .semibold))
                            .labelStyle(.titleAndIcon)
                            .foregroundStyle(Theme.primary)
                            .lineLimit(1)
                        Text(preset.description)
                            .font(.system(size: 9))
                            .foregroundStyle(Theme.inkSecondary)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading)
                    .padding(10)
                    .background(Theme.surface)
                    .clipShape(.rect(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Theme.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func sectionRow(_ section: DashboardSection) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(section.label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text(section.description)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.inkSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                store.toggle(section.id)
            } label: {
                Image(systemName: section.visible ? "eye.fill" : "eye.slash")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(section.visible ? Theme.primary : Theme.inkSecondary.opacity(0.6))
                    .frame(width: 32, height: 32)
                    .background(section.visible ? Theme.primary.opacity(0.12) : Theme.surfaceMuted)
                    .clipShape(.rect(cornerRadius: 9))
            }
            .buttonStyle(.plain)
        }
        .opacity(section.visible ? 1 : 0.5)
    }

    // MARK: - Quick Actions tab

    @ViewBuilder
    private var quickActionsContent: some View {
        Section {
            ForEach(store.quickActions) { action in
                quickActionRow(action, pinned: true)
            }
            .onMove { store.moveQuickAction(from: $0, to: $1) }
        } header: {
            Text("Shown on dashboard")
        } footer: {
            Text("Drag to reorder. Pin up to \(QuickActionCatalog.maxSelected) shortcuts; keep at least \(QuickActionCatalog.minSelected).")
        }

        if !store.availableQuickActions.isEmpty {
            Section {
                ForEach(store.availableQuickActions) { action in
                    quickActionRow(action, pinned: false)
                }
            } header: {
                Text("Available")
            }
        }
    }

    private func quickActionRow(_ action: QuickActionItem, pinned: Bool) -> some View {
        let atMax = store.quickActionIds.count >= QuickActionCatalog.maxSelected
        let atMin = store.quickActionIds.count <= QuickActionCatalog.minSelected
        let disabled = pinned ? atMin : atMax
        return HStack(spacing: 12) {
            Image(systemName: action.icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(pinned ? action.tint : Theme.inkSecondary)
                .frame(width: 34, height: 34)
                .background((pinned ? action.tint : Theme.inkSecondary).opacity(0.12))
                .clipShape(.rect(cornerRadius: 9))
            Text(action.label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(pinned ? Theme.ink : Theme.inkSecondary)
            Spacer(minLength: 0)
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                if pinned { store.removeQuickAction(action.id) } else { store.addQuickAction(action.id) }
            } label: {
                Image(systemName: pinned ? "minus.circle.fill" : "plus.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(pinned ? Theme.destructive : Theme.primary)
                    .opacity(disabled ? 0.3 : 1)
            }
            .buttonStyle(.plain)
            .disabled(disabled)
        }
        .opacity(pinned ? 1 : 0.85)
    }
}
