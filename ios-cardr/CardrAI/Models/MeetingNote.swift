import Foundation

/// A meeting note / recording summary, mirroring the `meeting_notes` table.
nonisolated struct MeetingNote: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var summary: String?
    var transcript: String?
    var manualNotes: String?
    var category: String?
    var durationSeconds: Int?
    var keyTopics: [String]?
    var actionItems: [String]?
    var followUps: [String]?
    var decisions: [String]?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, summary, transcript, category
        case manualNotes = "manual_notes"
        case durationSeconds = "duration_seconds"
        case keyTopics = "key_topics"
        case actionItems = "action_items"
        case followUps = "follow_ups"
        case decisions
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var durationLabel: String? {
        guard let seconds = durationSeconds, seconds > 0 else { return nil }
        let minutes = seconds / 60
        return minutes > 0 ? "\(minutes) min" : "\(seconds)s"
    }

    private static let isoParser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoParserNoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// The note's creation timestamp parsed into a `Date`.
    var createdDate: Date? {
        guard let createdAt, !createdAt.isEmpty else { return nil }
        return MeetingNote.isoParser.date(from: createdAt)
            ?? MeetingNote.isoParserNoFraction.date(from: createdAt)
    }

    /// A short time-of-day label (e.g. "3:45 PM").
    var timeLabel: String {
        guard let date = createdDate else { return "" }
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f.string(from: date)
    }

    /// True when the note was recorded (has a transcript).
    var isRecorded: Bool {
        (transcript?.isEmpty == false)
    }

    /// Number of open action items.
    var openActionCount: Int {
        actionItems?.count ?? 0
    }
}

/// One open action item flattened from a note, for the Action Items tab.
nonisolated struct NoteActionItem: Identifiable, Hashable {
    let id = UUID()
    let task: String
    let noteId: String
    let noteTitle: String
    let date: Date?
}

/// A labelled search snippet showing where a query matched within a note.
nonisolated struct NoteSearchMatch: Identifiable, Hashable {
    let id = UUID()
    let field: String
    let snippet: String
}

/// Sort options for the notes list, mirroring the web filters.
nonisolated enum NoteSortOption: String, CaseIterable, Identifiable {
    case newest, oldest, longest, shortest
    var id: String { rawValue }
    var label: String {
        switch self {
        case .newest: return "Newest"
        case .oldest: return "Oldest"
        case .longest: return "Longest"
        case .shortest: return "Shortest"
        }
    }
}

/// Active note filters, mirroring the web `NoteFilterState`.
nonisolated struct NoteFilterState: Equatable {
    var sortBy: NoteSortOption = .newest
    var categories: Set<String> = []
    var hasActions = false

    var activeCount: Int {
        categories.count + (hasActions ? 1 : 0) + (sortBy != .newest ? 1 : 0)
    }
}
