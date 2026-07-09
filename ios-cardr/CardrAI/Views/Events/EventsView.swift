import SwiftUI
import UIKit

/// Navigation routes reachable from the Events screen.
enum EventsRoute: Hashable {
    case calendar
}

/// Native events hub mirroring the web `Events` page — list upcoming/past
/// events, create new ones, tag contacts, and generate a recap summary.
struct EventsView: View {
    @Environment(DataStore.self) private var data
    @State private var showCreate = false
    @State private var tab: EventTab = .upcoming

    enum EventTab: String, CaseIterable {
        case upcoming = "Upcoming"
        case past = "Past"
    }

    private var upcoming: [Event] { data.events.filter(\.isUpcoming) }
    private var past: [Event] { data.events.filter { !$0.isUpcoming } }
    private var shown: [Event] { tab == .upcoming ? upcoming : past }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                segmented
                if data.isLoadingEvents && data.events.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.vertical, 40)
                } else if shown.isEmpty {
                    emptyState
                } else {
                    VStack(spacing: 10) {
                        ForEach(shown) { event in
                            NavigationLink(value: event) {
                                EventCard(event: event, count: data.contactCount(forEvent: event.id))
                            }
                            .buttonStyle(PressableButtonStyle())
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Events")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 2) {
                    NavigationLink(value: EventsRoute.calendar) {
                        Image(systemName: "calendar")
                    }
                    Button { showCreate = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .navigationDestination(for: Event.self) { EventDetailView(event: $0) }
        .navigationDestination(for: EventsRoute.self) { route in
            switch route {
            case .calendar: CalendarView()
            }
        }
        .sheet(isPresented: $showCreate) {
            CreateEventSheet()
        }
        .task { if data.events.isEmpty { await data.loadEvents() } }
    }

    private var segmented: some View {
        HStack(spacing: 0) {
            ForEach(EventTab.allCases, id: \.self) { item in
                let isActive = tab == item
                Button {
                    withAnimation(.snappy(duration: 0.2)) { tab = item }
                } label: {
                    Text(item.rawValue)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(isActive ? .white : Theme.inkSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(
                            ZStack {
                                if isActive {
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(Theme.brandGradient)
                                }
                            }
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.surfaceMuted)
        .clipShape(.rect(cornerRadius: 13))
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(Theme.inkSecondary.opacity(0.5))
            Text(tab == .upcoming ? "No upcoming events" : "No past events")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text("Create an event to keep track of the people you meet at conferences and meetups.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
            Button { showCreate = true } label: {
                Label("New event", systemImage: "plus")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(Theme.brandGradient)
                    .clipShape(Capsule())
            }
            .buttonStyle(PressableButtonStyle())
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

/// A tappable event summary card.
private struct EventCard: View {
    let event: Event
    let count: Int

    var body: some View {
        CardSurface(padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Text(event.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 8)
                    if let type = event.eventType, !type.isEmpty {
                        Text(type.capitalized)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Theme.primary.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
                HStack(spacing: 12) {
                    Label(event.formattedDate, systemImage: "calendar")
                        .font(.system(size: 11))
                        .monospacedDigit()
                        .foregroundStyle(Theme.inkSecondary)
                    if let location = event.location, !location.isEmpty {
                        Label(location, systemImage: "mappin.and.ellipse")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.inkSecondary)
                            .lineLimit(1)
                    }
                }
                if count > 0 {
                    Label("\(count) contact\(count == 1 ? "" : "s")", systemImage: "person.2.fill")
                        .font(.system(size: 11, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(Theme.primary)
                }
            }
        }
    }
}

/// Bottom sheet to create a new event.
private struct CreateEventSheet: View {
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var draft = EventDraft()
    @State private var saving = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    field("Event name") {
                        TextField("CES 2026", text: $draft.title)
                            .textInputAutocapitalization(.words)
                    }
                    field("Website (optional)") {
                        TextField("https://ces.tech", text: $draft.website)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.URL)
                            .autocorrectionDisabled()
                    }
                    field("Description") {
                        TextField("What's this event about?", text: $draft.description, axis: .vertical)
                            .lineLimit(2...4)
                    }
                    field("Location") {
                        TextField("Las Vegas, NV", text: $draft.location)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        labelText("Event type")
                        HStack(spacing: 8) {
                            ForEach(EventDefaults.types, id: \.self) { type in
                                let isActive = draft.eventType == type
                                Button {
                                    draft.eventType = type
                                } label: {
                                    Text(type.capitalized)
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(isActive ? .white : Theme.inkSecondary)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 7)
                                        .background(isActive ? AnyShapeStyle(Theme.primary) : AnyShapeStyle(Theme.surfaceMuted))
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    DatePicker("Start date", selection: $draft.startDate, displayedComponents: .date)
                        .font(.system(size: 14))
                        .tint(Theme.primary)

                    Toggle("Has end date", isOn: $draft.hasEndDate.animation(.snappy(duration: 0.2)))
                        .font(.system(size: 14))
                        .tint(Theme.primary)
                    if draft.hasEndDate {
                        DatePicker("End date", selection: $draft.endDate, in: draft.startDate..., displayedComponents: .date)
                            .font(.system(size: 14))
                            .tint(Theme.primary)
                    }

                    Button(action: create) {
                        Text(saving ? "Creating…" : "Create event")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(draft.isValid ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.surfaceMuted))
                            .clipShape(.rect(cornerRadius: 14))
                    }
                    .buttonStyle(PressableButtonStyle())
                    .disabled(!draft.isValid || saving)
                    .padding(.top, 4)
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("New Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func create() {
        guard draft.isValid else { return }
        saving = true
        let snapshot = draft
        Task {
            let created = await data.addEvent(snapshot)
            saving = false
            if created != nil {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
            }
        }
    }

    private func labelText(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Theme.inkSecondary)
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            labelText(label)
            content()
                .font(.system(size: 15))
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Theme.surface)
                .clipShape(.rect(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1)
                )
        }
    }
}
