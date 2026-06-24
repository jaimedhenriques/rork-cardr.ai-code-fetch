import SwiftUI
import UIKit

/// Invite a teammate to the organization by email + role, returning a shareable
/// join link. Mirrors the web invite flow.
struct InviteMemberView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var role: OrgRole = .member
    @State private var isInviting = false
    @State private var joinLink: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    CardSurface {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("EMAIL")
                                .font(.caption2.weight(.bold)).tracking(0.5)
                                .foregroundStyle(Theme.inkSecondary)
                            TextField("teammate@company.com", text: $email)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(.horizontal, 12).frame(height: 42)
                                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10))

                            Text("ROLE")
                                .font(.caption2.weight(.bold)).tracking(0.5)
                                .foregroundStyle(Theme.inkSecondary)
                            Picker("Role", selection: $role) {
                                ForEach(OrgRole.allCases.filter { $0 != .owner }) { item in
                                    Text(item.label).tag(item)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                    }

                    if let joinLink {
                        CardSurface {
                            VStack(alignment: .leading, spacing: 10) {
                                Label("Invitation created", systemImage: "checkmark.circle.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.success)
                                if !joinLink.isEmpty {
                                    Text(joinLink)
                                        .font(.caption.monospaced())
                                        .foregroundStyle(Theme.inkSecondary)
                                        .lineLimit(2)
                                    Button {
                                        UIPasteboard.general.string = joinLink
                                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                                    } label: {
                                        Label("Copy join link", systemImage: "doc.on.doc")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(Theme.primary)
                                    }
                                }
                            }
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Theme.destructive)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button { Task { await invite() } } label: {
                        HStack {
                            if isInviting { ProgressView().tint(.white) }
                            Text(isInviting ? "Sending…" : "Send invitation")
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(.white)
                        .background(Theme.brandGradient)
                        .clipShape(.rect(cornerRadius: 12))
                    }
                    .buttonStyle(PressableButtonStyle())
                    .disabled(isInviting || !email.contains("@"))
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Invite teammate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func invite() async {
        isInviting = true
        errorMessage = nil
        let link = await data.inviteMember(email: email, role: role.rawValue)
        isInviting = false
        if let link {
            joinLink = link
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } else {
            errorMessage = data.loadError ?? "Could not send the invitation."
            data.loadError = nil
        }
    }
}

/// Create-organization sheet for owners without an org yet.
struct CreateOrgView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var slug = ""
    @State private var isCreating = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    CardSurface {
                        VStack(alignment: .leading, spacing: 12) {
                            field("Organization name", text: $name, placeholder: "Acme Inc.")
                            field("URL slug (optional)", text: $slug, placeholder: "acme")
                        }
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Theme.destructive)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Button { Task { await create() } } label: {
                        HStack {
                            if isCreating { ProgressView().tint(.white) }
                            Text(isCreating ? "Creating…" : "Create organization")
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(.white)
                        .background(Theme.brandGradient)
                        .clipShape(.rect(cornerRadius: 12))
                    }
                    .buttonStyle(PressableButtonStyle())
                    .disabled(isCreating || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("New organization")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold)).tracking(0.5)
                .foregroundStyle(Theme.inkSecondary)
            TextField(placeholder, text: text)
                .font(.subheadline)
                .autocorrectionDisabled()
                .textInputAutocapitalization(label.contains("slug") ? .never : .words)
                .padding(.horizontal, 12).frame(height: 42)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private func create() async {
        isCreating = true
        errorMessage = nil
        let ok = await data.createOrganization(name: name, slug: slug)
        isCreating = false
        if ok {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss()
        } else {
            errorMessage = data.loadError ?? "Could not create the organization."
            data.loadError = nil
        }
    }
}
