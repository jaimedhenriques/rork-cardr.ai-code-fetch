import SwiftUI
import UIKit

/// Organization management — members, invitations, domains, settings, and
/// branding, organized into tabs. Mirrors the web `OrgAdmin` panel.
struct OrgAdminView: View {
    @Environment(DataStore.self) private var data

    @State private var tab: OrgTab = .members
    @State private var memberSearch = ""
    @State private var showInvite = false
    @State private var showCreate = false

    enum OrgTab: String, CaseIterable, Identifiable {
        case members, domains, settings, branding
        var id: String { rawValue }
        var label: String {
            switch self {
            case .members: return "Members"
            case .domains: return "Domains"
            case .settings: return "Settings"
            case .branding: return "Branding"
            }
        }
    }

    var body: some View {
        Group {
            if data.organization == nil {
                createOrgPrompt
            } else {
                orgContent
            }
        }
        .task {
            if data.organization == nil { await data.loadOrganization() }
        }
        .sheet(isPresented: $showInvite) { InviteMemberView() }
        .sheet(isPresented: $showCreate) { CreateOrgView() }
    }

    // MARK: - No org yet

    private var createOrgPrompt: some View {
        CardSurface(padding: 20) {
            VStack(spacing: 12) {
                Image(systemName: "building.2.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(Theme.primary)
                Text("Create your organization")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Text("Invite teammates, manage roles and domains, and white-label the app for your company.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)
                Button { showCreate = true } label: {
                    Label("Create organization", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(.white)
                        .background(Theme.brandGradient)
                        .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Org content

    @ViewBuilder
    private var orgContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            orgHeader
            Picker("Section", selection: $tab) {
                ForEach(OrgTab.allCases) { item in Text(item.label).tag(item) }
            }
            .pickerStyle(.segmented)

            switch tab {
            case .members: membersTab
            case .domains: domainsTab
            case .settings: settingsTab
            case .branding:
                if data.canEditBranding {
                    BrandingEditorView()
                } else {
                    infoNote("Only owners and admins can edit branding.")
                }
            }
        }
    }

    private var orgHeader: some View {
        CardSurface(padding: 16) {
            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Theme.brandGradient)
                    .frame(width: 46, height: 46)
                    .overlay {
                        Image(systemName: "building.2.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(data.organization?.name ?? "Organization")
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text("/\(data.organization?.slug ?? "")")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                Text("\(data.orgMembers.count)/\(data.organization?.maxSeats.map(String.init) ?? "∞")")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.primary)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Theme.primary.opacity(0.1), in: Capsule())
            }
        }
    }

    // MARK: - Members tab

    @ViewBuilder
    private var membersTab: some View {
        if data.isOrgAdmin {
            Button { showInvite = true } label: {
                Label("Invite teammate", systemImage: "person.badge.plus")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(Theme.brandGradient)
                    .clipShape(.rect(cornerRadius: 12))
            }
            .buttonStyle(PressableButtonStyle())
        }

        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.inkSecondary).font(.system(size: 14))
            TextField("Search members", text: $memberSearch)
                .font(.subheadline)
                .autocorrectionDisabled()
        }
        .padding(.horizontal, 12).frame(height: 40)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))

        ForEach(filteredMembers) { member in
            MemberRow(member: member)
        }

        if !data.orgInvitations.isEmpty {
            Text("PENDING INVITATIONS")
                .font(.caption2.weight(.bold)).tracking(0.8)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 8)
            ForEach(data.orgInvitations) { invite in
                InvitationRow(invitation: invite)
            }
        }
    }

    private var filteredMembers: [OrgMember] {
        let q = memberSearch.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return data.orgMembers }
        return data.orgMembers.filter {
            $0.displayName.lowercased().contains(q) || ($0.email?.lowercased().contains(q) ?? false)
        }
    }

    // MARK: - Domains tab

    @ViewBuilder
    private var domainsTab: some View {
        if data.isOrgAdmin {
            AddDomainField()
        }
        if data.orgDomains.isEmpty {
            infoNote("Add an email domain so colleagues can join automatically.")
        } else {
            ForEach(data.orgDomains) { domain in
                CardSurface(padding: 14) {
                    HStack(spacing: 12) {
                        Image(systemName: "globe")
                            .foregroundStyle(domain.verified ? Theme.success : Theme.warning)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(domain.domain)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Text(domain.verified ? "Verified" : "Pending DNS verification")
                                .font(.caption2)
                                .foregroundStyle(domain.verified ? Theme.success : Theme.warning)
                        }
                        Spacer()
                        if data.isOrgAdmin {
                            Button { Task { await data.removeDomain(domain) } } label: {
                                Image(systemName: "trash")
                                    .foregroundStyle(Theme.destructive)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Settings tab

    @ViewBuilder
    private var settingsTab: some View {
        if data.isOrgOwner {
            OrgSettingsForm()
        } else {
            infoNote("Only the owner can change organization settings.")
        }
    }

    private func infoNote(_ text: String) -> some View {
        CardSurface(padding: 16) {
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Member row

private struct MemberRow: View {
    @Environment(DataStore.self) private var data
    let member: OrgMember
    @State private var showRemove = false

    var body: some View {
        CardSurface(padding: 14) {
            HStack(spacing: 12) {
                Text(member.initials)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Theme.brandGradient, in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(member.displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    if let email = member.email, !email.isEmpty {
                        Text(email)
                            .font(.caption2)
                            .foregroundStyle(Theme.inkSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                if data.isOrgAdmin && member.role != "owner" {
                    Menu {
                        ForEach(OrgRole.allCases.filter { $0 != .owner }) { role in
                            Button {
                                Task { await data.updateMemberRole(member, to: role.rawValue) }
                            } label: {
                                Label(role.label, systemImage: member.role == role.rawValue ? "checkmark" : role.icon)
                            }
                        }
                        Divider()
                        Button(role: .destructive) { showRemove = true } label: {
                            Label("Remove", systemImage: "person.badge.minus")
                        }
                    } label: {
                        roleBadge
                    }
                } else {
                    roleBadge
                }
            }
        }
        .confirmationDialog("Remove \(member.displayName)?", isPresented: $showRemove, titleVisibility: .visible) {
            Button("Remove", role: .destructive) { Task { await data.removeMember(member) } }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var roleBadge: some View {
        let role = OrgRole(rawValue: member.role) ?? .member
        return HStack(spacing: 4) {
            Image(systemName: role.icon).font(.system(size: 10))
            Text(role.label).font(.caption2.weight(.semibold))
        }
        .foregroundStyle(role == .owner ? Theme.warning : (role == .admin ? Theme.primary : Theme.inkSecondary))
        .padding(.horizontal, 9).padding(.vertical, 5)
        .background(Theme.surfaceMuted, in: Capsule())
    }
}

// MARK: - Invitation row

private struct InvitationRow: View {
    @Environment(DataStore.self) private var data
    let invitation: OrgInvitation

    var body: some View {
        CardSurface(padding: 14) {
            HStack(spacing: 12) {
                Image(systemName: "envelope.badge")
                    .foregroundStyle(Theme.warning)
                    .frame(width: 34, height: 34)
                    .background(Theme.warning.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(invitation.email)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Text("Invited as \(invitation.role)")
                        .font(.caption2)
                        .foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                if data.isOrgAdmin {
                    Button { Task { await data.cancelInvitation(invitation) } } label: {
                        Text("Cancel")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
        }
    }
}

// MARK: - Add domain field

private struct AddDomainField: View {
    @Environment(DataStore.self) private var data
    @State private var domain = ""

    var body: some View {
        HStack(spacing: 8) {
            TextField("company.com", text: $domain)
                .font(.subheadline)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 12).frame(height: 40)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
            Button {
                let value = domain
                domain = ""
                Task { await data.addDomain(value) }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(Theme.primary, in: RoundedRectangle(cornerRadius: 12))
            }
            .disabled(domain.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }
}

// MARK: - Org settings form

private struct OrgSettingsForm: View {
    @Environment(DataStore.self) private var data
    @State private var name = ""
    @State private var slug = ""
    @State private var isSaving = false
    @State private var didLoad = false

    var body: some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                labeledField("Organization name", text: $name)
                labeledField("URL slug", text: $slug)
                Button {
                    isSaving = true
                    Task {
                        await data.updateOrganization(name: name, slug: slug)
                        isSaving = false
                    }
                } label: {
                    HStack {
                        if isSaving { ProgressView().tint(.white) }
                        Text("Save changes")
                    }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(Theme.brandGradient)
                    .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(isSaving || name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .onAppear {
            guard !didLoad else { return }
            didLoad = true
            name = data.organization?.name ?? ""
            slug = data.organization?.slug ?? ""
        }
    }

    private func labeledField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold)).tracking(0.5)
                .foregroundStyle(Theme.inkSecondary)
            TextField(label, text: text)
                .font(.subheadline)
                .autocorrectionDisabled()
                .padding(.horizontal, 12).frame(height: 40)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10))
        }
    }
}
