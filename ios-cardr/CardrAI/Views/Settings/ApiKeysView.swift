import SwiftUI

/// "Claude remote-control" — lets users mint MCP API keys and connect CardrAI to
/// Claude Desktop, Cursor, or any MCP-compatible client. Mirrors the web
/// `ApiKeyManager` (MCP URL, key reveal, key list, quick-setup guide).
struct ApiKeysView: View {
    @Environment(SessionStore.self) private var session
    @State private var model: ApiKeysViewModel?
    @State private var copiedField: String?

    private let availableTools = [
        "list_contacts", "get_contact", "list_notes", "get_note",
        "list_events", "list_pipeline_stages", "list_calendar_events",
        "list_tags", "list_folders",
    ]

    var body: some View {
        ScrollView {
            if let model {
                VStack(spacing: 18) {
                    intro
                    mcpEndpoint(model)
                    if let key = model.newKey {
                        newKeyReveal(model, key: key)
                    }
                    keyList(model)
                    quickSetup(model)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 40)
                .animation(.spring(response: 0.4, dampingFraction: 0.8), value: model.newKey)
                .animation(.spring(response: 0.4, dampingFraction: 0.8), value: model.keys)
            }
        }
        .background(Theme.background)
        .navigationTitle("Claude remote-control")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if model == nil {
                let vm = ApiKeysViewModel(session: session)
                model = vm
                await vm.load()
            }
        }
    }

    // MARK: - Intro

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Theme.brandGradient)
                    .frame(width: 44, height: 44)
                    .overlay {
                        Image(systemName: "sparkles")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Control CardrAI from Claude")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                    Text("Connect any MCP client to read your contacts, notes, and pipeline.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer(minLength: 0)
            }
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.border, lineWidth: 1)
        )
        .shadow(color: Theme.ink.opacity(0.04), radius: 10, y: 5)
    }

    // MARK: - MCP endpoint

    private func mcpEndpoint(_ model: ApiKeysViewModel) -> some View {
        cardSection {
            sectionLabel(icon: "link", text: "MCP Server URL")
            HStack(spacing: 8) {
                Text(model.mcpURL)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Theme.surfaceMuted)
                    .clipShape(.rect(cornerRadius: 10))
                copyButton(model.mcpURL, field: "mcp")
            }
            Text("Use this URL in Claude Desktop, Cursor, or any MCP-compatible client.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.inkSecondary)
        }
    }

    // MARK: - New key reveal

    private func newKeyReveal(_ model: ApiKeysViewModel, key: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel(icon: "key.fill", text: "New API Key — copy now", tint: Theme.primary)
            Text("This key is shown only once. Save it somewhere safe.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.inkSecondary)
            HStack(spacing: 8) {
                Text(key)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Theme.surfaceMuted)
                    .clipShape(.rect(cornerRadius: 10))
                copyButton(key, field: "newkey")
            }
            Button("I've saved it — dismiss") {
                withAnimation { model.dismissNewKey() }
            }
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Theme.inkSecondary)
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.primary.opacity(0.4), lineWidth: 1)
        )
        .shadow(color: Theme.primary.opacity(0.1), radius: 12, y: 6)
        .transition(.scale(scale: 0.96).combined(with: .opacity))
    }

    // MARK: - Key list

    private func keyList(_ model: ApiKeysViewModel) -> some View {
        cardSection {
            HStack {
                sectionLabel(icon: "key", text: "API Keys")
                Spacer()
                Button {
                    Task { await model.generate() }
                } label: {
                    HStack(spacing: 4) {
                        if model.isGenerating {
                            ProgressView().controlSize(.mini)
                        } else {
                            Image(systemName: "plus")
                                .font(.system(size: 12, weight: .bold))
                        }
                        Text("Generate")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(model.canGenerate ? Theme.primary : Theme.inkSecondary.opacity(0.5))
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(!model.canGenerate)
            }

            if model.isLoading {
                Text("Loading…")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            } else if model.keys.isEmpty {
                Text("No API keys yet. Generate one to connect MCP clients.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.7))
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 16)
            } else {
                VStack(spacing: 8) {
                    ForEach(model.keys) { key in
                        keyRow(model, key: key)
                    }
                }
            }

            if model.keys.count >= model.maxKeys {
                Text("Max \(model.maxKeys) active keys. Revoke one to generate another.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.warning)
            }

            if let error = model.errorMessage {
                Text(error)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.destructive)
            }
        }
    }

    private func keyRow(_ model: ApiKeysViewModel, key: ApiKey) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(key.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text(key.keyPrefix)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.inkSecondary)
                if let used = key.lastUsedAt {
                    Text("Last used \(formatted(used))")
                        .font(.system(size: 11))
                        .monospacedDigit()
                        .foregroundStyle(Theme.inkSecondary.opacity(0.8))
                }
            }
            Spacer(minLength: 0)
            Button {
                Task { await model.revoke(key) }
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.destructive)
                    .frame(width: 30, height: 30)
                    .background(Theme.destructive.opacity(0.1))
                    .clipShape(.rect(cornerRadius: 8))
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(12)
        .background(Theme.surfaceMuted)
        .clipShape(.rect(cornerRadius: 12))
    }

    // MARK: - Quick setup

    private func quickSetup(_ model: ApiKeysViewModel) -> some View {
        cardSection {
            sectionLabel(icon: "wand.and.stars", text: "Quick setup")
            VStack(alignment: .leading, spacing: 8) {
                Text("1. Generate an API key above")
                Text("2. Add it to your MCP client config:")
            }
            .font(.system(size: 12))
            .foregroundStyle(Theme.inkSecondary)

            Text(configSnippet(model.mcpURL))
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Theme.surfaceMuted)
                .clipShape(.rect(cornerRadius: 10))

            Text("Available tools")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.inkSecondary)
                .padding(.top, 2)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 6)], alignment: .leading, spacing: 6) {
                ForEach(availableTools, id: \.self) { tool in
                    Text(tool)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(Theme.accent.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
        }
    }

    private func configSnippet(_ url: String) -> String {
        """
        {
          "mcpServers": {
            "cardr": {
              "url": "\(url)",
              "headers": {
                "Authorization": "Bearer YOUR_API_KEY"
              }
            }
          }
        }
        """
    }

    // MARK: - Reusable pieces

    @ViewBuilder
    private func cardSection<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            content()
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .stroke(Theme.border, lineWidth: 1)
        )
        .shadow(color: Theme.ink.opacity(0.04), radius: 10, y: 5)
    }

    private func sectionLabel(icon: String, text: String, tint: Color = Theme.inkSecondary) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(tint == Theme.inkSecondary ? Theme.primary : tint)
            Text(text)
                .font(.system(size: 11, weight: .bold))
                .textCase(.uppercase)
                .tracking(1)
                .foregroundStyle(tint)
        }
    }

    private func copyButton(_ value: String, field: String) -> some View {
        Button {
            UIPasteboard.general.string = value
            withAnimation { copiedField = field }
            Task {
                try? await Task.sleep(for: .seconds(1.5))
                if copiedField == field { withAnimation { copiedField = nil } }
            }
        } label: {
            Image(systemName: copiedField == field ? "checkmark" : "doc.on.doc")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(copiedField == field ? Theme.success : Theme.primary)
                .frame(width: 38, height: 38)
                .background(Theme.surfaceMuted)
                .clipShape(.rect(cornerRadius: 10))
        }
        .buttonStyle(PressableButtonStyle())
    }

    private func formatted(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return "recently" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}
