import SwiftUI
import UIKit

/// Native phone dialer mirroring the web `PhoneDialer` page: Recents (call notes),
/// Contacts (with phone numbers, grouped A–Z), and a Keypad. Placing a call starts
/// a "Phone call with …" recording note, keeping CRM activity in sync.
struct PhoneDialerView: View {
    @Environment(DataStore.self) private var data

    enum Tab: String, CaseIterable, Identifiable {
        case recents, contacts, keypad
        var id: String { rawValue }
        var label: String {
            switch self {
            case .recents: "Recents"
            case .contacts: "Contacts"
            case .keypad: "Keypad"
            }
        }
        var icon: String {
            switch self {
            case .recents: "clock"
            case .contacts: "person.2"
            case .keypad: "circle.grid.3x3"
            }
        }
    }

    @State private var tab: Tab = .recents
    @State private var search = ""
    @State private var dialNumber = ""
    @State private var composer: CallComposer?

    private struct CallComposer: Identifiable {
        let id = UUID()
        let title: String
    }

    var body: some View {
        VStack(spacing: 0) {
            tabBar
            Divider().background(Theme.border)
            content
        }
        .background(Theme.background)
        .navigationTitle("Phone")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $composer) { c in
            NoteComposerView(prefillTitle: c.title, autoStart: true)
        }
    }

    // MARK: - Tabs

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases) { t in
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation(.snappy(duration: 0.22)) { tab = t }
                } label: {
                    VStack(spacing: 4) {
                        HStack(spacing: 6) {
                            Image(systemName: t.icon)
                                .font(.system(size: 14, weight: .semibold))
                            Text(t.label)
                                .font(.system(size: 13, weight: .semibold))
                        }
                        Rectangle()
                            .fill(tab == t ? Theme.primary : .clear)
                            .frame(height: 2)
                    }
                    .foregroundStyle(tab == t ? Theme.ink : Theme.inkSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Theme.background)
    }

    @ViewBuilder
    private var content: some View {
        switch tab {
        case .recents: recentsTab
        case .contacts: contactsTab
        case .keypad: keypadTab
        }
    }

    // MARK: - Recents

    private var callNotes: [MeetingNote] {
        data.notes.filter { $0.title.range(of: "phone call", options: .caseInsensitive) != nil }
    }

    private var recentsTab: some View {
        ScrollView {
            if callNotes.isEmpty {
                emptyState(
                    icon: "clock",
                    title: "No recent calls",
                    subtitle: "Calls made through Cardr will appear here"
                )
            } else {
                VStack(spacing: 2) {
                    ForEach(callNotes) { note in
                        recentRow(note)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.top, 8)
            }
        }
    }

    private func contactName(from title: String) -> String? {
        guard let r = title.range(of: "phone call with ", options: .caseInsensitive) else { return nil }
        let name = String(title[r.upperBound...]).trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? nil : name
    }

    private func recentRow(_ note: MeetingNote) -> some View {
        let name = contactName(from: note.title)
        let matched = name.flatMap { n in
            data.contacts.first { $0.name.caseInsensitiveCompare(n) == .orderedSame }
        }
        return NavigationLink(value: note) {
            HStack(spacing: 12) {
                avatarCircle(for: name ?? "?", initials: initials(name ?? "?"))
                VStack(alignment: .leading, spacing: 2) {
                    Text(name ?? "Unknown")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        Image(systemName: "phone")
                            .font(.system(size: 11))
                        Text(matched?.phone ?? "Outgoing call")
                            .font(.system(size: 12))
                    }
                    .foregroundStyle(Theme.inkSecondary)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(note.createdDate.map(relativeLabel) ?? "")
                        .font(.system(size: 11))
                        .monospacedDigit()
                        .foregroundStyle(Theme.inkSecondary)
                    if let d = note.durationLabel {
                        Text(d)
                            .font(.system(size: 11))
                            .monospacedDigit()
                            .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                    }
                }
                if let phone = matched?.phone, !phone.isEmpty {
                    Button {
                        startCall(name: name, phone: phone)
                    } label: {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.primary)
                            .frame(width: 34, height: 34)
                            .background(Theme.primary.opacity(0.12))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary.opacity(0.4))
                }
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 6)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Contacts

    private var phoneContacts: [Contact] {
        let withPhone = data.contacts.filter { ($0.phone ?? "").isEmpty == false }
        let filtered = search.isEmpty ? withPhone : withPhone.filter {
            $0.name.localizedCaseInsensitiveContains(search)
                || ($0.phone ?? "").contains(search)
                || ($0.company ?? "").localizedCaseInsensitiveContains(search)
        }
        return filtered.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private var groupedContacts: [(String, [Contact])] {
        var groups: [String: [Contact]] = [:]
        for c in phoneContacts {
            let first = c.name.first.map { String($0).uppercased() } ?? "#"
            let key = first.range(of: "[A-Z]", options: .regularExpression) != nil ? first : "#"
            groups[key, default: []].append(c)
        }
        return groups.sorted { a, b in
            if a.key == "#" { return false }
            if b.key == "#" { return true }
            return a.key < b.key
        }
    }

    private var contactsTab: some View {
        ScrollView {
            VStack(spacing: 8) {
                searchField
                if phoneContacts.isEmpty {
                    emptyState(
                        icon: "person.2",
                        title: search.isEmpty ? "No contacts with phone numbers" : "No contacts found",
                        subtitle: nil
                    )
                    .padding(.top, 40)
                } else {
                    ForEach(groupedContacts, id: \.0) { letter, contacts in
                        VStack(alignment: .leading, spacing: 0) {
                            Text(letter)
                                .font(.system(size: 11, weight: .bold))
                                .tracking(1.2)
                                .foregroundStyle(Theme.inkSecondary)
                                .padding(.vertical, 6)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .overlay(alignment: .bottom) { Divider().background(Theme.border) }
                            ForEach(contacts) { contact in
                                contactRow(contact)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
        }
    }

    private func contactRow(_ contact: Contact) -> some View {
        HStack(spacing: 12) {
            avatarCircle(for: contact.name, initials: contact.initials)
            VStack(alignment: .leading, spacing: 2) {
                Text(contact.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Text(contact.phone ?? "")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: 0)
            Button {
                startCall(name: contact.name, phone: contact.phone ?? "")
            } label: {
                Image(systemName: "phone.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.primary)
                    .frame(width: 40, height: 40)
                    .background(Theme.surfaceMuted)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 8)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkSecondary)
            TextField("Search contacts", text: $search)
                .font(.system(size: 14))
                .autocorrectionDisabled()
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: 12))
    }

    // MARK: - Keypad

    private let keys: [(String, String)] = [
        ("1", ""), ("2", "ABC"), ("3", "DEF"),
        ("4", "GHI"), ("5", "JKL"), ("6", "MNO"),
        ("7", "PQRS"), ("8", "TUV"), ("9", "WXYZ"),
        ("*", ""), ("0", "+"), ("#", "")
    ]

    private var keypadTab: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 12)
            Text(dialNumber.isEmpty ? " " : dialNumber)
                .font(.system(size: 34, weight: .light))
                .tracking(2)
                .foregroundStyle(dialNumber.isEmpty ? Theme.inkSecondary.opacity(0.3) : Theme.ink)
                .frame(height: 56)
                .animation(.none, value: dialNumber)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 3), spacing: 14) {
                ForEach(keys, id: \.0) { digit, letters in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        dialNumber += digit
                    } label: {
                        VStack(spacing: 2) {
                            Text(digit)
                                .font(.system(size: 26, weight: .medium))
                                .foregroundStyle(Theme.ink)
                            if !letters.isEmpty {
                                Text(letters)
                                    .font(.system(size: 9, weight: .semibold))
                                    .tracking(1.5)
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                        }
                        .frame(width: 72, height: 72)
                        .background(Theme.surfaceMuted)
                        .clipShape(Circle())
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }
            .frame(maxWidth: 280)
            .padding(.top, 12)

            HStack {
                Spacer().frame(width: 64)
                Button {
                    guard dialNumber.count >= 3 else { return }
                    startCall(name: nil, phone: dialNumber)
                } label: {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(.white)
                        .frame(width: 64, height: 64)
                        .background(dialNumber.count >= 3 ? Theme.success : Theme.success.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(dialNumber.count < 3)

                Button {
                    if !dialNumber.isEmpty { dialNumber.removeLast() }
                } label: {
                    Image(systemName: "delete.left")
                        .font(.system(size: 22))
                        .foregroundStyle(Theme.inkSecondary)
                        .frame(width: 64, height: 64)
                }
                .buttonStyle(.plain)
                .opacity(dialNumber.isEmpty ? 0 : 1)
            }
            .frame(maxWidth: 280)
            .padding(.top, 18)

            Spacer(minLength: 24)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Helpers

    private func startCall(name: String?, phone: String) {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        let title = name.map { "Phone call with \($0)" } ?? "Phone call"
        composer = CallComposer(title: title)
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let str = parts.compactMap { $0.first }.map(String.init).joined()
        return str.isEmpty ? "?" : str.uppercased()
    }

    private func avatarCircle(for name: String, initials: String) -> some View {
        Circle()
            .fill(avatarColor(name))
            .frame(width: 40, height: 40)
            .overlay {
                Text(initials)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
            }
    }

    private func avatarColor(_ name: String) -> Color {
        var hash = 0
        for scalar in name.unicodeScalars { hash = Int(scalar.value) &+ ((hash << 5) &- hash) }
        let hue = Double(abs(hash) % 360) / 360.0
        return Color(hue: hue, saturation: 0.55, brightness: 0.7)
    }

    private func relativeLabel(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f.localizedString(for: date, relativeTo: Date())
    }

    private func emptyState(icon: String, title: String, subtitle: String?) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 30))
                .foregroundStyle(Theme.inkSecondary.opacity(0.3))
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.inkSecondary)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.inkSecondary.opacity(0.6))
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 64)
        .padding(.horizontal, 24)
    }
}
