import Foundation

/// A single action item, mirroring the web `action_items` shape. Decodes from
/// either a plain string (legacy notes) or a `{task, owner, deadline, done,
/// priority}` object.
nonisolated struct NoteAction: Codable, Identifiable, Hashable {
    var id = UUID()
    var task: String
    var owner: String?
    var deadline: String?
    var done: Bool?
    var priority: String?

    enum CodingKeys: String, CodingKey { case task, owner, deadline, done, priority }

    init(task: String, owner: String? = nil, deadline: String? = nil, done: Bool? = nil, priority: String? = nil) {
        self.task = task
        self.owner = owner
        self.deadline = deadline
        self.done = done
        self.priority = priority
    }

    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(), let str = try? single.decode(String.self) {
            self.task = str
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.task = (try? c.decodeIfPresent(String.self, forKey: .task)) ?? ""
        self.owner = try? c.decodeIfPresent(String.self, forKey: .owner)
        self.deadline = try? c.decodeIfPresent(String.self, forKey: .deadline)
        self.done = try? c.decodeIfPresent(Bool.self, forKey: .done)
        self.priority = try? c.decodeIfPresent(String.self, forKey: .priority)
    }

    var isDone: Bool { done ?? false }
}

/// A follow-up item, mirroring the web `follow_ups` shape. Decodes from a plain
/// string or a `{description, with, urgency}` object.
nonisolated struct NoteFollowUp: Codable, Identifiable, Hashable {
    var id = UUID()
    var description: String
    var with: String?
    var urgency: String?

    enum CodingKeys: String, CodingKey { case description, with, urgency }

    init(description: String, with: String? = nil, urgency: String? = nil) {
        self.description = description
        self.with = with
        self.urgency = urgency
    }

    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(), let str = try? single.decode(String.self) {
            self.description = str
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.description = (try? c.decodeIfPresent(String.self, forKey: .description)) ?? ""
        self.with = try? c.decodeIfPresent(String.self, forKey: .with)
        self.urgency = try? c.decodeIfPresent(String.self, forKey: .urgency)
    }
}

/// A person mentioned in the meeting, mirroring `mentioned_people`.
nonisolated struct MentionedPerson: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var role: String?
    var context: String?

    enum CodingKeys: String, CodingKey { case name, role, context }

    init(name: String, role: String? = nil, context: String? = nil) {
        self.name = name
        self.role = role
        self.context = context
    }

    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(), let str = try? single.decode(String.self) {
            self.name = str
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
        self.role = try? c.decodeIfPresent(String.self, forKey: .role)
        self.context = try? c.decodeIfPresent(String.self, forKey: .context)
    }
}

/// A meeting note / recording summary, mirroring the `meeting_notes` table.
nonisolated struct MeetingNote: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var summary: String?
    var transcript: String?
    var manualNotes: String?
    var category: String?
    var folderId: String?
    var calendarEventId: String?
    var durationSeconds: Int?
    var keyTopics: [String]?
    var actionItems: [NoteAction]?
    var followUps: [NoteFollowUp]?
    var decisions: [String]?
    var insights: [String]?
    var mentionedPeople: [MentionedPerson]?
    var openQuestions: [String]?
    var analytics: MeetingAnalytics?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, summary, transcript, category, decisions, insights, analytics
        case manualNotes = "manual_notes"
        case folderId = "folder_id"
        case calendarEventId = "calendar_event_id"
        case durationSeconds = "duration_seconds"
        case keyTopics = "key_topics"
        case actionItems = "action_items"
        case followUps = "follow_ups"
        case mentionedPeople = "mentioned_people"
        case openQuestions = "open_questions"
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

    /// A full date + time label (e.g. "Jun 25, 2026 · 3:45 PM").
    var fullDateLabel: String {
        guard let date = createdDate else { return "" }
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy · h:mm a"
        return f.string(from: date)
    }

    /// True when the note was recorded (has a transcript).
    var isRecorded: Bool { transcript?.isEmpty == false }

    /// Number of open (not-done) action items.
    var openActionCount: Int {
        (actionItems ?? []).filter { !$0.isDone }.count
    }

    /// Whether the AI has produced any structured output yet.
    var hasInsights: Bool {
        (summary?.isEmpty == false)
            || (keyTopics?.isEmpty == false)
            || (actionItems?.isEmpty == false)
    }

    /// Whether the note has any raw content to analyze.
    var hasContent: Bool {
        (manualNotes?.isEmpty == false) || (transcript?.isEmpty == false)
    }
}

/// One open action item flattened from a note, for the Action Items tab.
nonisolated struct NoteActionItem: Identifiable, Hashable {
    let id = UUID()
    let action: NoteAction
    let noteId: String
    let noteTitle: String
    let date: Date?

    var task: String { action.task }
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
