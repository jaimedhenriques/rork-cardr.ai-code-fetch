import SwiftUI

/// Native account-deletion flow mirroring the web `DeleteAccount` page:
/// warning → safety checklist → password re-auth → type-DELETE confirm →
/// animated phase progress → done. Permanently deletes the user and all data.
struct DeleteAccountView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    enum Step {
        case warning, checklist, reauth, confirm, running, done, error
    }

    enum PhaseState { case pending, active, done, error }

    struct Phase: Identifiable {
        let id: String
        let label: String
        let detail: String
        let icon: String
    }

    private static let phases: [Phase] = [
        Phase(id: "stripe", label: "Cancelling subscription", detail: "Stopping any active billing", icon: "creditcard"),
        Phase(id: "data", label: "Purging database records", detail: "Contacts, notes, events, tags…", icon: "cylinder.split.1x2"),
        Phase(id: "storage", label: "Removing uploaded files", detail: "Avatars, scans, exports", icon: "externaldrive"),
        Phase(id: "auth", label: "Deleting your account", detail: "Final irreversible step", icon: "person.crop.circle.badge.xmark"),
    ]

    private static let ackItems: [(id: String, label: String)] = [
        ("data", "I understand all my contacts, notes, events, files and integrations will be permanently deleted"),
        ("billing", "I understand any active subscription will be cancelled and is not refundable"),
        ("noRecovery", "I understand this cannot be undone and support cannot recover my account"),
        ("exported", "I have already exported any data I want to keep (or I don't need any of it)"),
    ]

    @State private var step: Step = .warning
    @State private var acks: Set<String> = []
    @State private var password = ""
    @State private var reauthError: String?
    @State private var reauthLoading = false
    @State private var confirmText = ""
    @State private var phaseStates: [String: PhaseState] = [:]
    @State private var errorMsg: String?

    private let required = "DELETE"

    private var allAcked: Bool { acks.count == Self.ackItems.count }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                switch step {
                case .warning: warningStep
                case .checklist: checklistStep
                case .reauth: reauthStep
                case .confirm: confirmStep
                case .running, .done, .error: runningStep
                }
            }
            .padding(16)
            .padding(.bottom, 40)
            .animation(.spring(response: 0.4, dampingFraction: 0.88), value: step)
        }
        .background(Theme.background)
        .navigationTitle("Delete account")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(step == .running)
        .interactiveDismissDisabled(step == .running)
    }

    // MARK: - Step 1: Warning

    private var warningStep: some View {
        VStack(spacing: 16) {
            CardSurface(padding: 18) {
                HStack(alignment: .top, spacing: 12) {
                    iconBadge("exclamationmark.shield.fill", tint: Theme.destructive)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("This action cannot be undone")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.ink)
                        Text("Deleting your account is permanent and immediate. There is no recovery window and support cannot restore your data.")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }
            }
            .overlay(alignment: .leading) {
                Rectangle().fill(Theme.destructive).frame(width: 4)
                    .clipShape(.rect(topLeadingRadius: Theme.cardRadius, bottomLeadingRadius: Theme.cardRadius))
            }

            CardSurface(padding: 18) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("WHAT WILL BE DELETED")
                        .font(.system(size: 11, weight: .bold)).tracking(1)
                        .foregroundStyle(Theme.primary)
                    ForEach([
                        "All saved contacts, notes, events, folders and tags",
                        "Uploaded files: avatars, business-card scans, CSV exports",
                        "Connected integrations (Pipedrive, Google Calendar, etc.)",
                        "Active subscriptions will be cancelled",
                        "Your login email — you will not be able to sign back in",
                    ], id: \.self) { item in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "xmark")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.destructive)
                                .padding(.top, 2)
                            Text(item)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.ink)
                        }
                    }
                }
            }

            if let email = session.userEmail {
                CardSurface(padding: 14) {
                    Text("Signed in as ")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                    + Text(email)
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Theme.ink)
                }
            }

            HStack(spacing: 10) {
                secondaryButton("Cancel") { dismiss() }
                destructiveButton("Continue") { step = .checklist }
            }
        }
    }

    // MARK: - Step 2: Checklist

    private var checklistStep: some View {
        VStack(spacing: 16) {
            CardSurface(padding: 18) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        iconBadge("checkmark.shield.fill", tint: Theme.warning, size: 34)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Safety checklist")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(Theme.ink)
                            Text("Confirm each item to continue")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.inkSecondary)
                        }
                    }
                    ForEach(Self.ackItems, id: \.id) { item in
                        Button {
                            if acks.contains(item.id) { acks.remove(item.id) } else { acks.insert(item.id) }
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: acks.contains(item.id) ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 20))
                                    .foregroundStyle(acks.contains(item.id) ? Theme.primary : Theme.inkSecondary.opacity(0.4))
                                Text(item.label)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.ink)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .background(acks.contains(item.id) ? Theme.primary.opacity(0.06) : Theme.surfaceMuted.opacity(0.4),
                                        in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(acks.contains(item.id) ? Theme.primary.opacity(0.4) : Theme.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                    Text("\(acks.count)/\(Self.ackItems.count) confirmed")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            HStack(spacing: 10) {
                secondaryButton("Back") { step = .warning }
                destructiveButton("Continue", enabled: allAcked) { step = .reauth }
            }
        }
    }

    // MARK: - Step 3: Re-auth

    private var reauthStep: some View {
        VStack(spacing: 16) {
            CardSurface(padding: 18) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        iconBadge("key.fill", tint: Theme.primary, size: 34)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Verify it's you")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(Theme.ink)
                            Text("Re-enter your password to continue")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.inkSecondary)
                        }
                    }
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .textFieldStyle(.roundedBorder)
                        .onChange(of: password) { _, _ in reauthError = nil }
                    if let reauthError {
                        Text(reauthError)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            HStack(spacing: 10) {
                secondaryButton("Back") {
                    password = ""; reauthError = nil; step = .checklist
                }
                destructiveButton(reauthLoading ? "Verifying…" : "Verify & continue", enabled: !password.isEmpty && !reauthLoading) {
                    Task { await verify() }
                }
            }
        }
    }

    // MARK: - Step 4: Confirm

    private var confirmStep: some View {
        VStack(spacing: 16) {
            CardSurface(padding: 22) {
                VStack(spacing: 14) {
                    iconBadge("exclamationmark.triangle.fill", tint: Theme.destructive, size: 52, iconSize: 24)
                    Text("Final confirmation")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    (Text("Type ") + Text(required).font(.system(size: 14, weight: .bold, design: .monospaced)).foregroundColor(Theme.destructive) + Text(" below to permanently delete your account and all associated data."))
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.center)
                    TextField(required, text: $confirmText)
                        .multilineTextAlignment(.center)
                        .font(.system(size: 16, weight: .semibold, design: .monospaced))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                        .textFieldStyle(.roundedBorder)
                }
                .frame(maxWidth: .infinity)
            }
            HStack(spacing: 10) {
                secondaryButton("Back") { confirmText = ""; step = .reauth }
                destructiveButton("Delete my account", enabled: confirmText == required) {
                    Task { await runDeletion() }
                }
            }
        }
    }

    // MARK: - Step 5: Running / done / error

    private var runningStep: some View {
        CardSurface(padding: 18) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    switch step {
                    case .done:
                        iconBadge("checkmark", tint: Theme.success, size: 30, iconSize: 15)
                        Text("Account deleted").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                    case .error:
                        iconBadge("xmark", tint: Theme.destructive, size: 30, iconSize: 15)
                        Text("Deletion failed").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                    default:
                        ProgressView().tint(Theme.primary)
                        Text("Deleting your account…").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                    }
                    Spacer()
                }

                ForEach(Self.phases) { phase in
                    phaseRow(phase)
                }

                if step == .done {
                    Text("You have been signed out on this device.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkSecondary)
                }
                if step == .error, let errorMsg {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(errorMsg)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(Theme.destructive)
                        secondaryButton("Back to settings") { dismiss() }
                    }
                }
            }
        }
    }

    private func phaseRow(_ phase: Phase) -> some View {
        let state = phaseStates[phase.id] ?? .pending
        let tint: Color = {
            switch state {
            case .pending: return Theme.inkSecondary
            case .active: return Theme.primary
            case .done: return Theme.success
            case .error: return Theme.destructive
            }
        }()
        return HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(tint.opacity(0.15))
                    .frame(width: 34, height: 34)
                Group {
                    switch state {
                    case .active: ProgressView().controlSize(.small).tint(tint)
                    case .done: Image(systemName: "checkmark")
                    case .error: Image(systemName: "xmark")
                    case .pending: Image(systemName: phase.icon)
                    }
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tint)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(phase.label).font(.system(size: 14, weight: .semibold)).foregroundStyle(state == .done ? Theme.success : Theme.ink)
                Text(phase.detail).font(.system(size: 11)).foregroundStyle(Theme.inkSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(tint.opacity(state == .pending ? 0 : 0.05), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(state == .pending ? Theme.border : tint.opacity(0.4), lineWidth: 1)
        )
        .opacity(state == .pending ? 0.6 : 1)
    }

    // MARK: - Logic

    private func verify() async {
        reauthLoading = true
        defer { reauthLoading = false }
        let ok = await session.verifyPassword(password)
        if ok {
            password = ""
            step = .confirm
        } else {
            reauthError = "Incorrect password. Please try again."
        }
    }

    private func runDeletion() async {
        step = .running
        errorMsg = nil
        let order = ["stripe", "data", "storage", "auth"]

        // Drive a visible phase progression while the request runs.
        let walk = Task { @MainActor in
            for id in order {
                phaseStates[id] = .active
                try? await Task.sleep(for: .milliseconds(650))
                if phaseStates[id] == .active { phaseStates[id] = .done }
            }
        }

        let error = await data.deleteAccount()
        _ = await walk.value

        if let error {
            if let activeId = order.first(where: { phaseStates[$0] == .active }) {
                phaseStates[activeId] = .error
            } else {
                phaseStates["auth"] = .error
            }
            errorMsg = error
            step = .error
            return
        }

        for id in order { phaseStates[id] = .done }
        step = .done
        try? await Task.sleep(for: .milliseconds(900))
        session.signOut()
    }

    // MARK: - Building blocks

    private func iconBadge(_ icon: String, tint: Color, size: CGFloat = 40, iconSize: CGFloat = 18) -> some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(tint.opacity(0.12))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: icon)
                    .font(.system(size: iconSize, weight: .semibold))
                    .foregroundStyle(tint)
            }
    }

    private func secondaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
    }

    private func destructiveButton(_ title: String, enabled: Bool = true, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(enabled ? AnyShapeStyle(Theme.destructive) : AnyShapeStyle(Theme.inkSecondary.opacity(0.3)),
                            in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!enabled)
    }
}
