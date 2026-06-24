import SwiftUI

/// Exports the current scanning session as a CSV — share/download via the native
/// share sheet, or email it through the `quick-export-contacts` edge function.
struct SessionExportView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var recipient = ""
    @State private var isSending = false
    @State private var shareURL: URL?
    @State private var toast: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    summaryCard
                    downloadCard
                    emailCard
                    if let toast {
                        Text(toast)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Theme.success)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Export session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear { recipient = data.profile?.email ?? "" }
            .sheet(item: $shareURL) { url in
                ShareSheet(items: [url])
            }
        }
    }

    private var summaryCard: some View {
        CardSurface {
            HStack(spacing: 14) {
                Image(systemName: "rectangle.stack.badge.person.crop")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Theme.primary)
                    .frame(width: 46, height: 46)
                    .background(Theme.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(data.sessionContacts.count) contact\(data.sessionContacts.count == 1 ? "" : "s")")
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text(data.activeEvent?.title ?? "Scanning session")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
            }
        }
    }

    private var downloadCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 12) {
                Label("Download spreadsheet", systemImage: "square.and.arrow.down")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text("Save a CSV of this session or share it to any app.")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
                Button {
                    exportCSV()
                } label: {
                    Text("Export CSV")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(.white)
                        .background(Theme.brandGradient)
                        .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
    }

    private var emailCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 12) {
                Label("Email export", systemImage: "envelope")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                TextField("you@example.com", text: $recipient)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10))
                Button {
                    sendEmail()
                } label: {
                    HStack {
                        if isSending { ProgressView().tint(.white) }
                        Text(isSending ? "Sending…" : "Send to email")
                    }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(Theme.primary)
                    .background(Theme.primary.opacity(0.1))
                    .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(isSending || !isValidEmail(recipient))
            }
        }
    }

    private func exportCSV() {
        let csv = data.buildSessionCSV()
        let stamp = ISO8601DateFormatter().string(from: Date()).prefix(10)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("scan-session-\(stamp).csv")
        do {
            try csv.data(using: .utf8)?.write(to: url)
            shareURL = url
        } catch {
            toast = "Could not create the file."
        }
    }

    private func sendEmail() {
        let to = recipient.trimmingCharacters(in: .whitespaces)
        guard isValidEmail(to) else { return }
        isSending = true
        toast = nil
        Task {
            let ok = await data.emailSessionExport(to: to)
            isSending = false
            toast = ok ? "Sent to \(to)" : (data.loadError ?? "Couldn't send the export.")
            data.loadError = nil
        }
    }

    private func isValidEmail(_ value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        return trimmed.contains("@") && trimmed.contains(".") && trimmed.count >= 5
    }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}
