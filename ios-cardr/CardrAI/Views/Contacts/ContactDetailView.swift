import SwiftUI

struct ContactDetailView: View {
    let initialContact: Contact
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var showDeleteConfirm = false
    @State private var showEdit = false
    @State private var showTagPicker = false
    @State private var isEnriching = false
    @State private var showMailComposer = false
    @State private var activities: [ContactActivity] = []
    @State private var isLoadingActivities = false
    @State private var showAddActivity = false
    @State private var newActivityTitle = ""
    @State private var newActivityType = "note"
    @State private var showStagePicker = false

    init(contact: Contact) {
        self.initialContact = contact
    }

    /// Always reflect the freshest version from the store after edits.
    private var contact: Contact {
        data.contacts.first { $0.id == initialContact.id } ?? initialContact
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                stageCard
                quickActions
                enrichButton
                tagsCard
                if hasContactInfo { infoCard }
                if let notes = contact.notes, !notes.isEmpty { notesCard(notes) }
                activitiesCard
                deleteButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Theme.background)
        .navigationTitle(contact.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") { showEdit = true }
                    .fontWeight(.semibold)
            }
        }
        .sheet(isPresented: $showEdit) {
            EditContactView(contact: contact)
        }
        .sheet(isPresented: $showTagPicker) {
            ContactTagPicker(contactId: contact.id)
        }
        .sheet(isPresented: $showMailComposer) {
            MailComposer(
                recipients: [contact.email ?? ""],
                subject: "Great connecting, \(contact.name.split(separator: " ").first.map(String.init) ?? contact.name)"
            )
        }
        .confirmationDialog("Delete this contact?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await data.deleteContact(contact); dismiss() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .task { await loadActivities() }
    }

    private var header: some View {
        CardSurface(padding: 22) {
            VStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.brandGradient.opacity(0.18))
                    Text(contact.initials)
                        .font(.title.weight(.bold))
                        .foregroundStyle(Theme.primary)
                }
                .frame(width: 80, height: 80)

                Text(contact.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.ink)
                if contact.enriched == true {
                    Label("Enriched", systemImage: "sparkles")
                        .font(.caption2.weight(.bold))
                        .textCase(.uppercase)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(Theme.success.opacity(0.14))
                        .foregroundStyle(Theme.success)
                        .clipShape(.capsule)
                }
                if !contact.subtitle.isEmpty {
                    Text(contact.subtitle)
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var quickActions: some View {
        HStack(spacing: 12) {
            if let phone = contact.phone, !phone.isEmpty {
                actionButton(icon: "phone.fill", label: "Call", tint: Theme.success) {
                    open("tel://\(digits(phone))")
                }
            }
            if let email = contact.email, !email.isEmpty {
                actionButton(icon: "envelope.fill", label: "Email", tint: Theme.primary) {
                    if MailComposer.canSendMail {
                        showMailComposer = true
                    } else {
                        open("mailto:\(email)")
                    }
                }
            }
            if let phone = contact.mobilePhone ?? contact.phone, !phone.isEmpty {
                actionButton(icon: "message.fill", label: "Text", tint: Theme.accent) {
                    open("sms://\(digits(phone))")
                }
            }
        }
    }

    private func actionButton(icon: String, label: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.headline)
                Text(label).font(.caption.weight(.medium))
            }
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(tint.opacity(0.1))
            .clipShape(.rect(cornerRadius: 14))
        }
    }

    @ViewBuilder
    private var enrichButton: some View {
        if contact.enriched != true {
            Button {
                Task {
                    isEnriching = true
                    await data.enrichContact(contact)
                    isEnriching = false
                }
            } label: {
                HStack(spacing: 8) {
                    if isEnriching {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "sparkles")
                    }
                    Text(isEnriching ? "Enriching…" : "Enrich with AI")
                        .font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.brandGradient)
                .clipShape(.rect(cornerRadius: 14))
                .shadow(color: Theme.primary.opacity(0.35), radius: 12, y: 6)
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(isEnriching)
        }
    }

    private var infoCard: some View {
        CardSurface {
            VStack(spacing: 0) {
                infoRow("Email", contact.email, "envelope")
                infoRow("Phone", contact.phone, "phone")
                infoRow("Mobile", contact.mobilePhone, "iphone")
                infoRow("Company", contact.company, "building.2")
                infoRow("Title", contact.title, "briefcase")
                infoRow("Location", contact.location, "mappin.and.ellipse")
                infoRow("Industry", contact.industry, "tag")
                infoRow("Website", contact.website, "globe", link: websiteURL)
                infoRow("LinkedIn", contact.linkedin, "link", isLast: true, link: linkedinURL)
            }
        }
    }

    @ViewBuilder
    private func infoRow(_ label: String, _ value: String?, _ icon: String, isLast: Bool = false, link: URL? = nil) -> some View {
        if let value, !value.isEmpty {
            VStack(spacing: 0) {
                Button {
                    if let link { openURL(link) }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: icon)
                            .foregroundStyle(Theme.inkSecondary)
                            .frame(width: 22)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(label).font(.caption).foregroundStyle(Theme.inkSecondary)
                            Text(value).font(.subheadline)
                                .foregroundStyle(link != nil ? Theme.primary : Theme.ink)
                        }
                        Spacer()
                        if link != nil {
                            Image(systemName: "arrow.up.right")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Theme.primary.opacity(0.6))
                        }
                    }
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(link == nil)
                if !isLast { Divider().background(Theme.border) }
            }
        }
    }

    private var websiteURL: URL? {
        guard let w = contact.website, !w.isEmpty else { return nil }
        let prefixed = w.hasPrefix("http") ? w : "https://\(w)"
        return URL(string: prefixed)
    }

    private var linkedinURL: URL? {
        guard let l = contact.linkedin, !l.isEmpty else { return nil }
        if l.hasPrefix("http") { return URL(string: l) }
        if l.contains("linkedin.com") { return URL(string: "https://\(l)") }
        return URL(string: "https://www.linkedin.com/in/\(l)")
    }

    private func notesCard(_ notes: String) -> some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 8) {
                Label("Notes", systemImage: "note.text")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(notes)
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }

    private var deleteButton: some View {
        Button(role: .destructive) { showDeleteConfirm = true } label: {
            Label("Delete contact", systemImage: "trash")
                .font(.subheadline.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .foregroundStyle(Theme.destructive)
                .background(Theme.destructive.opacity(0.08))
                .clipShape(.rect(cornerRadius: 14))
        }
    }

    // MARK: - Stage picker

    @ViewBuilder
    private var stageCard: some View {
        if !data.stages.isEmpty {
            CardSurface {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label("Pipeline stage", systemImage: "arrow.triangle.2.circlepath")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        let tier = Engagement.tier(for: contact)
                        Text(tier.rawValue)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(tier.color)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(tier.color.opacity(0.12), in: RoundedRectangle(cornerRadius: 5))
                        Text(tier.label)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Menu {
                        Button { Task { await data.moveContact(contact, to: nil) } } label: {
                            Label("No stage", systemImage: contact.stageId == nil ? "checkmark" : "")
                        }
                        ForEach(data.stages) { stage in
                            Button { Task { await data.moveContact(contact, to: stage.id) } } label: {
                                Label(stage.name, systemImage: stage.id == contact.stageId ? "checkmark" : "")
                            }
                        }
                    } label: {
                        HStack(spacing: 8) {
                            if let stageId = contact.stageId,
                               let stage = data.stages.first(where: { $0.id == stageId }) {
                                Circle()
                                    .fill(Color(hex: String(stage.color.dropFirst())))
                                    .frame(width: 10, height: 10)
                                Text(stage.name)
                            } else {
                                Image(systemName: "plus.circle")
                                    .font(.caption.weight(.semibold))
                                Text("Assign to stage")
                            }
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption2)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        .font(.subheadline)
                        .foregroundStyle(contact.stageId != nil ? Theme.ink : Theme.inkSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
        }
    }

    // MARK: - Activity timeline

    @ViewBuilder
    private var activitiesCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Activity", systemImage: "clock.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                    Button { showAddActivity = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(Theme.primary)
                    }
                    .buttonStyle(.plain)
                }

                if isLoadingActivities {
                    ProgressView().controlSize(.small)
                } else if activities.isEmpty {
                    Text("No activity recorded yet.")
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                } else {
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(activities.prefix(20)) { activity in
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: activity.icon)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Color(hex: activity.tint))
                                    .frame(width: 32, height: 32)
                                    .background(Color(hex: activity.tint).opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(activity.title)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(Theme.ink)
                                    if let desc = activity.description, !desc.isEmpty {
                                        Text(desc)
                                            .font(.caption)
                                            .foregroundStyle(Theme.inkSecondary)
                                            .lineLimit(2)
                                    }
                                    if let date = activity.createdDate {
                                        Text(date.formatted(date: .abbreviated, time: .shortened))
                                            .font(.caption2)
                                            .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showAddActivity) {
            NavigationStack {
                Form {
                    Section {
                        TextField("What happened?", text: $newActivityTitle)
                        Picker("Type", selection: $newActivityType) {
                            Text("Note").tag("note")
                            Text("Call").tag("call")
                            Text("Email").tag("email")
                            Text("Meeting").tag("meeting")
                            Text("Follow-up").tag("follow_up")
                            Text("Other").tag("other")
                        }
                    }
                    Section {
                        Button("Log activity") {
                            let title = newActivityTitle.trimmingCharacters(in: .whitespaces)
                            guard !title.isEmpty else { return }
                            Task {
                                await data.addActivity(contactId: contact.id, type: newActivityType, title: title)
                                newActivityTitle = ""
                                showAddActivity = false
                                await loadActivities()
                            }
                        }
                        .fontWeight(.semibold)
                        .disabled(newActivityTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                .navigationTitle("New Activity")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showAddActivity = false }
                    }
                }
            }
        }
    }

    private func loadActivities() async {
        isLoadingActivities = true
        defer { isLoadingActivities = false }
        activities = await data.activities(forContact: contact.id)
    }

    private var tagsCard: some View {
        let applied = data.tags(for: contact.id)
        return CardSurface {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Tags", systemImage: "tag")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                    Button {
                        showTagPicker = true
                    } label: {
                        Text(applied.isEmpty ? "Add" : "Edit")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.primary)
                    }
                    .buttonStyle(.plain)
                }
                if applied.isEmpty {
                    Text("No tags yet")
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)
                } else {
                    TagChipFlow(tags: applied)
                }
            }
        }
    }

    private var hasContactInfo: Bool {
        [contact.email, contact.phone, contact.mobilePhone, contact.company,
         contact.title, contact.location, contact.industry, contact.website, contact.linkedin]
            .contains { $0?.isEmpty == false }
    }

    private func digits(_ s: String) -> String { s.filter { $0.isNumber || $0 == "+" } }

    private func open(_ string: String) {
        if let url = URL(string: string) { openURL(url) }
    }
}

/// Wrapping display of applied tag chips.
struct TagChipFlow: View {
    let tags: [Tag]

    private let columns = [GridItem(.adaptive(minimum: 70), spacing: 6)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 6) {
            ForEach(tags) { tag in
                let color = Color(hex: tag.hexValue)
                HStack(spacing: 5) {
                    Circle().fill(color).frame(width: 6, height: 6)
                    Text(tag.name)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(color)
                        .lineLimit(1)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(color.opacity(0.12))
                .clipShape(Capsule())
            }
        }
    }
}

/// Sheet to assign/unassign tags for a contact, with inline tag creation.
struct ContactTagPicker: View {
    let contactId: String
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var newName = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 8) {
                        TextField("New tag", text: $newName)
                            .textFieldStyle(.plain)
                            .font(.system(size: 15))
                            .submitLabel(.done)
                            .onSubmit(createAndAssign)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Theme.surfaceMuted)
                            .clipShape(.rect(cornerRadius: 12))
                        Button(action: createAndAssign) {
                            Image(systemName: "plus")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 44, height: 44)
                                .background(canCreate ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.surfaceMuted))
                                .clipShape(.rect(cornerRadius: 12))
                        }
                        .buttonStyle(PressableButtonStyle())
                        .disabled(!canCreate)
                    }

                    if data.tags.isEmpty {
                        Text("No tags yet — create one above.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.inkSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 24)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(data.tags) { tag in
                                tagRow(tag)
                                if tag.id != data.tags.last?.id {
                                    Divider().background(Theme.border).padding(.leading, 38)
                                }
                            }
                        }
                        .background(Theme.surface)
                        .clipShape(.rect(cornerRadius: Theme.cardRadius))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.cardRadius)
                                .stroke(Theme.border, lineWidth: 1)
                        )
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Tags")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }

    private var canCreate: Bool {
        !newName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func createAndAssign() {
        guard canCreate else { return }
        let name = newName
        let color = TagDefaults.color(forIndex: data.tags.count)
        let cid = contactId
        Task {
            if let tag = await data.addTag(name: name, color: color) {
                if !data.tags(for: cid).contains(where: { $0.id == tag.id }) {
                    await data.toggleTag(tag, on: cid)
                }
            }
        }
        newName = ""
    }

    private func tagRow(_ tag: Tag) -> some View {
        let isOn = data.tags(for: contactId).contains { $0.id == tag.id }
        return Button {
            Task { await data.toggleTag(tag, on: contactId) }
        } label: {
            HStack(spacing: 12) {
                Circle().fill(Color(hex: tag.hexValue)).frame(width: 14, height: 14)
                Text(tag.name)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.ink)
                Spacer()
                if isOn {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.primary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
