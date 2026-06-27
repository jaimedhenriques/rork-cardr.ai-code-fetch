import SwiftUI
import UIKit

// MARK: - Create sequence

/// Native sequence composer mirroring the web `CreateSequenceSheet`: AI generation
/// from a goal/channel/tone, plus fully editable steps (channel, delay, subject, body).
struct CreateSequenceSheet: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var sequenceDescription = ""
    @State private var goal = ""
    @State private var channel = "mixed"
    @State private var tone = "friendly"
    @State private var audience = ""
    @State private var numSteps = 3
    @State private var steps: [SequenceStep] = []
    @State private var generating = false
    @State private var saving = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    aiCard
                    detailsCard
                    stepsSection
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .background(Theme.background)
            .navigationTitle("New Sequence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || steps.isEmpty || saving)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private var aiCard: some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                Label("Generate with AI", systemImage: "sparkles")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.primary)
                labeledField("Goal", text: $goal, placeholder: "e.g. Book a discovery call")
                pickerRow("Channel", selection: $channel, options: [
                    ("mixed", "Mixed (LinkedIn + Email)"), ("email", "Email only"), ("linkedin", "LinkedIn only"),
                ])
                pickerRow("Tone", selection: $tone, options: [
                    ("professional", "Professional"), ("friendly", "Friendly"), ("casual", "Casual"), ("enthusiastic", "Enthusiastic"),
                ])
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Steps").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkSecondary)
                        Picker("Steps", selection: $numSteps) {
                            ForEach(2...6, id: \.self) { Text("\($0) steps").tag($0) }
                        }
                        .pickerStyle(.menu)
                        .tint(Theme.ink)
                    }
                    labeledField("Audience (optional)", text: $audience, placeholder: "SaaS founders, EU")
                }
                Button { Task { await generate() } } label: {
                    HStack {
                        if generating { ProgressView().tint(.white) }
                        else { Image(systemName: "sparkles") }
                        Text(generating ? "Generating…" : "Generate sequence")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(Theme.primary)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(generating)
            }
        }
    }

    private var detailsCard: some View {
        CardSurface(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                labeledField("Sequence name", text: $name, placeholder: "e.g. Cold outreach v1")
                VStack(alignment: .leading, spacing: 4) {
                    Text("Description").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkSecondary)
                    TextField("What is this sequence for?", text: $sequenceDescription, axis: .vertical)
                        .lineLimit(2...4)
                        .textFieldStyle(.plain)
                        .padding(10)
                        .background(Theme.surfaceMuted)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
    }

    private var stepsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Steps").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                Spacer()
                Button { addStep() } label: {
                    Label("Add step", systemImage: "plus")
                        .font(.system(size: 13, weight: .semibold))
                }
            }
            if steps.isEmpty {
                Text("Generate with AI or add steps manually.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                ForEach(Array(steps.enumerated()), id: \.element.localID) { index, _ in
                    stepCard(index)
                }
            }
        }
    }

    private func stepCard(_ index: Int) -> some View {
        CardSurface(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Step \(index + 1)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.primary)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Theme.primary.opacity(0.12)).clipShape(Capsule())
                    Spacer()
                    Button(role: .destructive) { removeStep(index) } label: {
                        Image(systemName: "trash").font(.system(size: 13))
                    }
                }
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Channel").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkSecondary)
                        Picker("Channel", selection: Binding(
                            get: { steps[index].channel },
                            set: { steps[index].channel = $0 }
                        )) {
                            Text("Email").tag("email")
                            Text("LinkedIn invite").tag("linkedin_connection")
                            Text("LinkedIn message").tag("linkedin_message")
                        }
                        .pickerStyle(.menu)
                        .tint(Theme.ink)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Delay (days)").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkSecondary)
                        Stepper("\(steps[index].delayDays)d", value: Binding(
                            get: { steps[index].delayDays },
                            set: { steps[index].delayDays = max(0, $0) }
                        ), in: 0...60)
                        .font(.system(size: 13))
                    }
                }
                if steps[index].channel == "email" {
                    TextField("Subject", text: Binding(
                        get: { steps[index].subjectTemplate ?? "" },
                        set: { steps[index].subjectTemplate = $0 }
                    ))
                    .textFieldStyle(.plain)
                    .padding(10)
                    .background(Theme.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("Body — use {{name}}, {{company}}, {{title}}")
                        .font(.system(size: 10)).foregroundStyle(Theme.inkSecondary)
                    TextField("Message body", text: Binding(
                        get: { steps[index].bodyTemplate },
                        set: { steps[index].bodyTemplate = $0 }
                    ), axis: .vertical)
                    .lineLimit(4...8)
                    .textFieldStyle(.plain)
                    .padding(10)
                    .background(Theme.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
    }

    // MARK: helpers

    private func labeledField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkSecondary)
            TextField(placeholder, text: text)
                .textFieldStyle(.plain)
                .padding(10)
                .background(Theme.surfaceMuted)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private func pickerRow(_ label: String, selection: Binding<String>, options: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkSecondary)
            Picker(label, selection: selection) {
                ForEach(options, id: \.0) { Text($0.1).tag($0.0) }
            }
            .pickerStyle(.menu)
            .tint(Theme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func addStep() {
        steps.append(SequenceStep(
            id: nil,
            stepOrder: steps.count + 1,
            channel: "email",
            delayDays: steps.isEmpty ? 0 : 3,
            subjectTemplate: "Following up, {{name}}",
            bodyTemplate: "Hi {{name}},\n\n"
        ))
    }

    private func removeStep(_ index: Int) {
        steps.remove(at: index)
        for i in steps.indices { steps[i].stepOrder = i + 1 }
    }

    private func generate() async {
        generating = true
        let resolvedGoal = goal.isEmpty ? "Build relationship and book a discovery call" : goal
        if let result = await data.generateSequence(goal: resolvedGoal, channel: channel, tone: tone, steps: numSteps, audience: audience) {
            name = result.name
            sequenceDescription = result.description
            steps = result.steps
        }
        generating = false
    }

    private func save() async {
        saving = true
        let id = await data.createSequence(
            name: name, description: sequenceDescription, channel: channel, tone: tone, goal: goal,
            steps: steps
        )
        saving = false
        if id != nil { dismiss() }
    }
}

// MARK: - Enroll contacts

/// Native contact picker for enrolling people into a sequence.
struct EnrollContactsView: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    let sequenceId: String
    @State private var search = ""
    @State private var selected: Set<String> = []
    @State private var enrolling = false

    private var filtered: [Contact] {
        guard !search.trimmingCharacters(in: .whitespaces).isEmpty else { return data.contacts }
        let q = search.lowercased()
        return data.contacts.filter {
            $0.name.lowercased().contains(q) || ($0.company?.lowercased().contains(q) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                List(filtered) { contact in
                    Button { toggle(contact.id) } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle().fill(Theme.primary.opacity(0.12)).frame(width: 34, height: 34)
                                Text(String(contact.name.first ?? "?").uppercased())
                                    .font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.primary)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(contact.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                                Text(contact.company ?? contact.email ?? "")
                                    .font(.system(size: 12)).foregroundStyle(Theme.inkSecondary).lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: selected.contains(contact.id) ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 20))
                                .foregroundStyle(selected.contains(contact.id) ? Theme.primary : Theme.inkSecondary.opacity(0.4))
                        }
                    }
                    .listRowBackground(Theme.surface)
                }
                .listStyle(.plain)
                .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search contacts")
            }
            .background(Theme.background)
            .navigationTitle("Enroll Contacts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(enrolling ? "Enrolling…" : "Enroll\(selected.isEmpty ? "" : " (\(selected.count))")") {
                        Task { await enroll() }
                    }
                    .disabled(selected.isEmpty || enrolling)
                    .fontWeight(.semibold)
                }
            }
        }
    }

    private func toggle(_ id: String) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    private func enroll() async {
        enrolling = true
        let count = await data.enrollContacts(sequenceId: sequenceId, contactIds: Array(selected))
        enrolling = false
        if count > 0 { dismiss() }
    }
}

// MARK: - Review run

/// Native run review mirroring the web `ReviewRunSheet`: approve/trigger, edit each
/// message, send via mail or copy-for-LinkedIn, skip, and cancel.
struct ReviewRunSheet: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    let run: SequenceRun
    @State private var messages: [RunMessage] = []
    @State private var loading = true

    private var contact: Contact? { data.contacts.first { $0.id == run.contactId } }
    private var sequence: AutomationSequence? { data.sequences.first { $0.id == run.sequenceId } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    headerCard
                    if loading {
                        ProgressView().frame(maxWidth: .infinity).padding(.vertical, 40)
                    } else if messages.isEmpty {
                        Text("No messages for this run yet.")
                            .font(.system(size: 13)).foregroundStyle(Theme.inkSecondary)
                            .frame(maxWidth: .infinity).padding(.vertical, 30)
                    } else {
                        ForEach(Array(messages.enumerated()), id: \.element.id) { index, _ in
                            messageCard(index)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .background(Theme.background)
            .navigationTitle(contact?.name ?? "Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .task {
                messages = await data.loadRunMessages(runId: run.id)
                loading = false
            }
        }
    }

    private var headerCard: some View {
        CardSurface(padding: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(contact?.name ?? "Contact").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text([contact?.company, contact?.email].compactMap { $0 }.joined(separator: " · "))
                        .font(.system(size: 12)).foregroundStyle(Theme.inkSecondary).lineLimit(1)
                    statusBadge(run.status)
                }
                Spacer()
                VStack(spacing: 8) {
                    if run.status == "draft" {
                        Button {
                            Task { await data.triggerRun(run); dismiss() }
                        } label: {
                            Label("Approve", systemImage: "paperplane.fill")
                                .font(.system(size: 12, weight: .semibold))
                                .padding(.horizontal, 12).padding(.vertical, 8)
                                .background(Theme.primary).foregroundStyle(.white)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(PressableButtonStyle())
                    }
                    if run.status == "draft" || run.status == "running" {
                        Button {
                            Task { await data.cancelRun(run); dismiss() }
                        } label: {
                            Label("Cancel", systemImage: "xmark")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.destructive)
                        }
                    }
                }
            }
        }
    }

    private func messageCard(_ index: Int) -> some View {
        let message = messages[index]
        let canSend = message.status == "approved" || message.status == "pending"
        return CardSurface(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text("Step \(index + 1)")
                        .font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.inkSecondary)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Theme.surfaceMuted).clipShape(Capsule())
                    Label(AutomationChannel.label(message.channel), systemImage: AutomationChannel.icon(message.channel))
                        .font(.system(size: 10, weight: .semibold)).foregroundStyle(Theme.inkSecondary)
                    statusBadge(message.status)
                    Spacer()
                }
                if message.channel == "email" {
                    TextField("Subject", text: subjectBinding(index))
                        .font(.system(size: 14, weight: .medium))
                        .textFieldStyle(.plain)
                        .padding(10).background(Theme.surfaceMuted)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .disabled(message.status == "sent")
                }
                TextField("Body", text: bodyBinding(index), axis: .vertical)
                    .lineLimit(4...10)
                    .font(.system(size: 13))
                    .textFieldStyle(.plain)
                    .padding(10).background(Theme.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .disabled(message.status == "sent")

                if canSend {
                    HStack(spacing: 10) {
                        Button { Task { await send(index) } } label: {
                            Label(message.channel == "email" ? "Open in Mail" : "Copy & LinkedIn",
                                  systemImage: message.channel == "email" ? "envelope.fill" : "arrow.up.right.square")
                                .font(.system(size: 12, weight: .semibold))
                                .padding(.horizontal, 12).padding(.vertical, 8)
                                .background(Theme.primary).foregroundStyle(.white)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(PressableButtonStyle())
                        Button { copy(message) } label: {
                            Image(systemName: "doc.on.doc").font(.system(size: 13))
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Button("Skip") { Task { await skip(index) } }
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.inkSecondary)
                        Button("Save") { Task { await saveEdit(index) } }
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                    }
                } else if message.status == "sent", let sentAt = message.sentAt {
                    Text("Sent \(Self.shortDate(sentAt))")
                        .font(.system(size: 11)).foregroundStyle(Theme.inkSecondary)
                }
            }
        }
    }

    private func subjectBinding(_ index: Int) -> Binding<String> {
        Binding(get: { messages[index].subject ?? "" }, set: { messages[index].subject = $0 })
    }

    private func bodyBinding(_ index: Int) -> Binding<String> {
        Binding(get: { messages[index].body }, set: { messages[index].body = $0 })
    }

    private func saveEdit(_ index: Int) async {
        let message = messages[index]
        await data.updateMessage(id: message.id, body: message.body, subject: message.subject)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func send(_ index: Int) async {
        let message = messages[index]
        await saveEdit(index)
        if message.channel == "email" {
            let to = contact?.email ?? ""
            let subject = (message.subject ?? "").addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
            let body = message.body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
            if let url = URL(string: "mailto:\(to)?subject=\(subject)&body=\(body)") { openURL(url) }
        } else {
            UIPasteboard.general.string = message.body
            let link = contact?.linkedin
            let search = "https://www.linkedin.com/search/results/people/?keywords=\((contact?.name ?? "").addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
            if let url = URL(string: link?.isEmpty == false ? link! : search) { openURL(url) }
        }
        await data.markMessageSent(id: message.id)
        messages[index].status = "sent"
        messages[index].sentAt = ISO8601DateFormatter().string(from: Date())
    }

    private func copy(_ message: RunMessage) {
        UIPasteboard.general.string = message.subject?.isEmpty == false ? "\(message.subject!)\n\n\(message.body)" : message.body
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func skip(_ index: Int) async {
        await data.updateMessage(id: messages[index].id, status: "skipped")
        messages[index].status = "skipped"
    }

    private func statusBadge(_ status: String) -> some View {
        let tint: Color = {
            switch status {
            case "running", "sent": return Theme.success
            case "completed", "approved": return Theme.primary
            case "cancelled", "failed": return Theme.destructive
            case "skipped": return Theme.accent
            default: return Theme.inkSecondary
            }
        }()
        return Text(status.capitalized)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(tint.opacity(0.12)).clipShape(Capsule())
    }

    private static func shortDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Date()
        let out = DateFormatter()
        out.dateFormat = "MMM d, h:mm a"
        return out.string(from: date)
    }
}
