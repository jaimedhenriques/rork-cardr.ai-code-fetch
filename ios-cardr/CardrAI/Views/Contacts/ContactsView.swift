import SwiftUI
import UIKit

/// Filter options for the contacts list, mirroring the web `ContactFilters`.
struct ContactFilter: Equatable {
    enum Enrichment: String, CaseIterable, Identifiable {
        case all = "All"
        case enriched = "Enriched"
        case notEnriched = "Not enriched"
        var id: String { rawValue }
    }

    var enrichment: Enrichment = .all
    var hasEmail = false
    var hasPhone = false
    var missingInfo = false
    var source: String?
    var eventId: String?

    var activeCount: Int {
        var n = 0
        if enrichment != .all { n += 1 }
        if hasEmail { n += 1 }
        if hasPhone { n += 1 }
        if missingInfo { n += 1 }
        if source != nil { n += 1 }
        if eventId != nil { n += 1 }
        return n
    }

    var isActive: Bool { activeCount > 0 }
}

struct ContactsView: View {
    @Environment(DataStore.self) private var data
    @State private var search = ""
    @State private var showAddContact = false
    @State private var showImport = false
    @State private var selectedTagId: String?

    @State private var filter = ContactFilter()
    @State private var showFilters = false
    @State private var showDuplicates = false

    @State private var selectionMode = false
    @State private var selectedIDs: Set<String> = []
    @State private var showBulkTagPicker = false
    @State private var shareItems: [Any] = []
    @State private var showShare = false
    @State private var showBulkDeleteConfirm = false

    private var filtered: [Contact] {
        var result = data.contacts

        if let selectedTagId {
            let ids = Set(data.contactTags.filter { $0.tagId == selectedTagId }.map(\.contactId))
            result = result.filter { ids.contains($0.id) }
        }

        switch filter.enrichment {
        case .enriched: result = result.filter { $0.enriched == true }
        case .notEnriched: result = result.filter { $0.enriched != true }
        case .all: break
        }
        if filter.hasEmail { result = result.filter { $0.email?.isEmpty == false } }
        if filter.hasPhone {
            result = result.filter { ($0.phone?.isEmpty == false) || ($0.mobilePhone?.isEmpty == false) }
        }
        if filter.missingInfo {
            result = result.filter {
                $0.email?.isEmpty != false && $0.phone?.isEmpty != false && $0.mobilePhone?.isEmpty != false
            }
        }
        if let source = filter.source {
            result = result.filter { $0.leadSource == source }
        }
        if let eventId = filter.eventId {
            let ids = Set(data.eventContacts.filter { $0.eventId == eventId }.map(\.contactId))
            result = result.filter { ids.contains($0.id) }
        }

        guard !search.isEmpty else { return result }
        return result.filter {
            $0.name.localizedStandardContains(search)
                || ($0.company?.localizedStandardContains(search) ?? false)
                || ($0.email?.localizedStandardContains(search) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if !data.tags.isEmpty && !selectionMode {
                    tagFilterBar
                }
                if !selectionMode && (data.bulkEnrichProgress != nil || (data.unenrichedCount > 0 && !data.contacts.isEmpty)) {
                    enrichAllBanner
                }
                listContent
            }
            .background(Theme.background)
            .navigationTitle(selectionMode ? "\(selectedIDs.count) selected" : "Contacts")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Contact.self) { ContactDetailView(contact: $0) }
            .searchable(text: $search, prompt: "Search name, company, email")
            .refreshable { await data.loadContacts() }
            .toolbar { toolbarContent }
            .sheet(isPresented: $showAddContact) { AddContactView() }
            .sheet(isPresented: $showImport) { ContactImportView() }
            .sheet(isPresented: $showFilters) {
                ContactFilterSheet(filter: $filter)
            }
            .sheet(isPresented: $showDuplicates) {
                DuplicatesView()
            }
            .sheet(isPresented: $showBulkTagPicker) {
                BulkTagPicker(contactIDs: selectedIDs) { exitSelection() }
            }
            .sheet(isPresented: $showShare) { ShareSheet(items: shareItems) }
            .confirmationDialog(
                "Delete \(selectedIDs.count) contact\(selectedIDs.count == 1 ? "" : "s")?",
                isPresented: $showBulkDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    let ids = selectedIDs
                    Task { await data.bulkDelete(ids) }
                    exitSelection()
                }
                Button("Cancel", role: .cancel) {}
            }
            .safeAreaInset(edge: .bottom) {
                if selectionMode && !selectedIDs.isEmpty {
                    bulkActionBar
                }
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if selectionMode {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { exitSelection() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button(allSelected ? "Deselect" : "All") { toggleSelectAll() }
                    .fontWeight(.semibold)
            }
        } else {
            ToolbarItem(placement: .topBarLeading) { DrawerMenuButton() }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showFilters = true } label: {
                    Image(systemName: filter.isActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                        .foregroundStyle(filter.isActive ? Theme.primary : Theme.ink)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { enterSelection() } label: { Label("Select", systemImage: "checkmark.circle") }
                    Button { showImport = true } label: {
                        Label("Import contacts", systemImage: "square.and.arrow.down")
                    }
                    Button { showDuplicates = true } label: {
                        Label("Find duplicates", systemImage: "person.2.slash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAddContact = true } label: { Image(systemName: "plus") }
            }
        }
    }

    // MARK: - List

    @ViewBuilder
    private var listContent: some View {
        if data.isLoadingContacts && data.contacts.isEmpty {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if filtered.isEmpty {
            emptyState
        } else {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(filtered) { contact in
                        if selectionMode {
                            Button { toggleSelect(contact.id) } label: {
                                HStack(spacing: 10) {
                                    checkmark(selectedIDs.contains(contact.id))
                                    ContactRow(contact: contact)
                                }
                            }
                            .buttonStyle(.plain)
                        } else {
                            NavigationLink(value: contact) { ContactRow(contact: contact) }
                                .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
    }

    private func checkmark(_ on: Bool) -> some View {
        Image(systemName: on ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 22))
            .foregroundStyle(on ? Theme.primary : Theme.inkSecondary.opacity(0.4))
    }

    // MARK: - Bulk action bar

    private var bulkActionBar: some View {
        HStack(spacing: 0) {
            bulkButton("Enrich", icon: "sparkles", tint: Theme.primary) {
                let ids = selectedIDs
                Task { await data.enrichContacts(ids) }
            }
            bulkButton("Tag", icon: "tag", tint: Theme.success) { showBulkTagPicker = true }
            bulkButton("Export", icon: "square.and.arrow.up", tint: Theme.accent) { exportSelected() }
            bulkButton("Delete", icon: "trash", tint: Theme.destructive) { showBulkDeleteConfirm = true }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Divider() }
    }

    private func bulkButton(_ label: String, icon: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 18, weight: .semibold))
                Text(label).font(.system(size: 10, weight: .medium))
            }
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Selection helpers

    private var allSelected: Bool {
        !filtered.isEmpty && filtered.allSatisfy { selectedIDs.contains($0.id) }
    }

    private func enterSelection() {
        withAnimation(.snappy) { selectionMode = true }
    }

    private func exitSelection() {
        withAnimation(.snappy) {
            selectionMode = false
            selectedIDs.removeAll()
        }
    }

    private func toggleSelect(_ id: String) {
        if selectedIDs.contains(id) { selectedIDs.remove(id) } else { selectedIDs.insert(id) }
    }

    private func toggleSelectAll() {
        selectedIDs = allSelected ? [] : Set(filtered.map(\.id))
    }

    private func exportSelected() {
        let contacts = data.contacts.filter { selectedIDs.contains($0.id) }
        guard !contacts.isEmpty else { return }
        let csv = csvString(contacts)
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("cardr-contacts-\(formatter.string(from: Date())).csv")
        do {
            try csv.data(using: .utf8)?.write(to: url)
            shareItems = [url]
        } catch {
            shareItems = [csv]
        }
        showShare = true
    }

    private func csvString(_ contacts: [Contact]) -> String {
        func esc(_ v: String?) -> String { "\"\((v ?? "").replacingOccurrences(of: "\"", with: "\"\""))\"" }
        let header = "Name,Title,Company,Email,Phone,LinkedIn,Website,Location"
        let rows = contacts.map { c in
            [esc(c.name), esc(c.title), esc(c.company), esc(c.email), esc(c.phone), esc(c.linkedin), esc(c.website), esc(c.location)]
                .joined(separator: ",")
        }
        return ([header] + rows).joined(separator: "\n")
    }

    // MARK: - Enrich-all banner

    private var enrichAllBanner: some View {
        Group {
            if let progress = data.bulkEnrichProgress {
                VStack(spacing: 8) {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small).tint(Theme.primary)
                        Text("Enriching \(progress.current) of \(progress.total)…")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                            .monospacedDigit()
                        Spacer()
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.surfaceMuted)
                            Capsule()
                                .fill(Theme.brandGradient)
                                .frame(width: max(6, geo.size.width * progressFraction(progress)))
                        }
                    }
                    .frame(height: 6)
                    .animation(.easeInOut(duration: 0.3), value: progress.current)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            } else {
                HStack(spacing: 12) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(data.unenrichedCount) need enriching")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                        Text("Fill in missing details with AI")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer()
                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        Task { await data.enrichAllUnenriched() }
                    } label: {
                        Text("Enrich All")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Theme.brandGradient)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(PressableButtonStyle())
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Theme.primary.opacity(0.06))
            }
        }
        .background(Theme.background)
    }

    private func progressFraction(_ progress: (current: Int, total: Int)) -> CGFloat {
        guard progress.total > 0 else { return 0 }
        return CGFloat(progress.current) / CGFloat(progress.total)
    }

    // MARK: - Tag quick filter

    private var tagFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(label: "All", color: Theme.ink, isSelected: selectedTagId == nil) {
                    selectedTagId = nil
                }
                ForEach(data.tags) { tag in
                    filterChip(label: tag.name, color: Color(hex: tag.hexValue), isSelected: selectedTagId == tag.id) {
                        selectedTagId = selectedTagId == tag.id ? nil : tag.id
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Theme.background)
    }

    private func filterChip(label: String, color: Color, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Circle().fill(color).frame(width: 7, height: 7)
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : color)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(isSelected ? color : color.opacity(0.12))
            .clipShape(Capsule())
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var isFiltering: Bool {
        !search.isEmpty || selectedTagId != nil || filter.isActive
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: isFiltering ? "magnifyingglass" : "person.2")
                .font(.largeTitle)
                .foregroundStyle(Theme.inkSecondary)
            Text(isFiltering ? "No matches" : "No contacts yet")
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text(isFiltering ? "Try a different search or filter." : "Add your first contact to get started.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
            if isFiltering {
                Button("Clear filters") {
                    selectedTagId = nil
                    filter = ContactFilter()
                    search = ""
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primary)
                .padding(.top, 2)
            } else {
                Button { showAddContact = true } label: {
                    Label("Add contact", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Theme.brandGradient)
                        .foregroundStyle(.white)
                        .clipShape(.capsule)
                }
                .padding(.top, 6)
                Button { showImport = true } label: {
                    Label("Import from CSV or vCard", systemImage: "square.and.arrow.down")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.primary)
                }
                .padding(.top, 2)
            }
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}
