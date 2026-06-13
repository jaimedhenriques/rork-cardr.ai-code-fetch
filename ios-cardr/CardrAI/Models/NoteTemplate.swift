import Foundation

/// A meeting-notes template that tailors the AI summary/insights to a context.
/// Mirrors the web `NOTE_TEMPLATES` — the prompt guides live server-side in the
/// `meeting-notes` edge function, so the app only needs the id for selection.
struct NoteTemplate: Identifiable, Hashable {
    let id: String
    let label: String
    let emoji: String
    let summary: String

    static let all: [NoteTemplate] = [
        NoteTemplate(id: "general", label: "General Meeting", emoji: "📋",
                     summary: "Standard notes with summary, actions & follow-ups"),
        NoteTemplate(id: "customer-discovery", label: "Customer Discovery", emoji: "🔍",
                     summary: "Pain points, needs, quotes & competitive intel"),
        NoteTemplate(id: "one-on-one", label: "1-on-1", emoji: "👥",
                     summary: "Goals, blockers, feedback & career growth"),
        NoteTemplate(id: "standup", label: "Standup / Sprint", emoji: "🏃",
                     summary: "Yesterday, today, blockers & sprint status"),
        NoteTemplate(id: "pitch", label: "Sales Pitch / Demo", emoji: "🎯",
                     summary: "Reactions, objections, buying signals & close plan"),
        NoteTemplate(id: "brainstorm", label: "Brainstorm", emoji: "💡",
                     summary: "Ideas, themes, voted priorities & next experiments"),
        NoteTemplate(id: "board-meeting", label: "Board Meeting", emoji: "🏛️",
                     summary: "Decisions, votes, strategic priorities & risk register"),
        NoteTemplate(id: "phone-call", label: "Phone Call", emoji: "📞",
                     summary: "Call summary, commitments, follow-up & tone"),
    ]

    static var `default`: NoteTemplate { all[0] }
}
