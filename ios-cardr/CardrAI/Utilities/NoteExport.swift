import Foundation
import UIKit

/// Builds shareable representations of a meeting note — clean markdown text and
/// a polished multi-page PDF — mirroring the web copy / export-PDF flows.
enum NoteExport {
    /// A clean, well-formatted plain-text / markdown rendering of the note.
    static func markdown(_ note: MeetingNote) -> String {
        var lines: [String] = ["# \(note.title.isEmpty ? "Meeting Notes" : note.title)"]
        if !note.fullDateLabel.isEmpty {
            var meta = note.fullDateLabel
            if let dur = note.durationLabel { meta += " · \(dur)" }
            lines.append(meta)
        }
        lines.append("")

        if let summary = note.summary, !summary.isEmpty {
            lines.append("## Summary")
            lines.append(summary)
            lines.append("")
        }
        if let topics = note.keyTopics, !topics.isEmpty {
            lines.append("## Key Topics")
            lines.append(topics.map { "- \($0)" }.joined(separator: "\n"))
            lines.append("")
        }
        if let actions = note.actionItems, !actions.isEmpty {
            lines.append("## Action Items")
            lines.append(actions.map { a in
                var s = "- [\(a.isDone ? "x" : " ")] \(a.task)"
                if let owner = a.owner, !owner.isEmpty { s += " (\(owner))" }
                if let deadline = a.deadline, !deadline.isEmpty { s += " — by \(deadline)" }
                return s
            }.joined(separator: "\n"))
            lines.append("")
        }
        if let followUps = note.followUps, !followUps.isEmpty {
            lines.append("## Follow-Ups")
            lines.append(followUps.map { f in
                var s = "- \(f.description)"
                if let with = f.with, !with.isEmpty { s += " — with \(with)" }
                return s
            }.joined(separator: "\n"))
            lines.append("")
        }
        if let decisions = note.decisions, !decisions.isEmpty {
            lines.append("## Decisions")
            lines.append(decisions.map { "- \($0)" }.joined(separator: "\n"))
            lines.append("")
        }
        if let insights = note.insights, !insights.isEmpty {
            lines.append("## Insights")
            lines.append(insights.map { "- \($0)" }.joined(separator: "\n"))
            lines.append("")
        }
        if let people = note.mentionedPeople, !people.isEmpty {
            lines.append("## People Mentioned")
            lines.append(people.map { p in
                var s = "- \(p.name)"
                if let role = p.role, !role.isEmpty { s += " — \(role)" }
                return s
            }.joined(separator: "\n"))
            lines.append("")
        }
        if let questions = note.openQuestions, !questions.isEmpty {
            lines.append("## Open Questions")
            lines.append(questions.map { "- \($0)" }.joined(separator: "\n"))
            lines.append("")
        }
        if let polished = note.enhancedNotes, !polished.isEmpty {
            lines.append("## Polished Notes")
            lines.append(polished)
            lines.append("")
        }
        if let manual = note.manualNotes, !manual.isEmpty {
            lines.append("## Notes")
            lines.append(manual)
            lines.append("")
        }
        return lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Writes the markdown to a temporary `.txt` file and returns its URL.
    static func textFile(_ note: MeetingNote) -> URL? {
        let safe = note.title.isEmpty ? "meeting-notes" : note.title
            .replacingOccurrences(of: "[^A-Za-z0-9]+", with: "-", options: .regularExpression)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safe).txt")
        do {
            try markdown(note).data(using: .utf8)?.write(to: url)
            return url
        } catch { return nil }
    }

    /// Writes the markdown to a temporary `.md` file (Obsidian/Notion-ready)
    /// and returns its URL — mirrors the web Markdown export.
    static func markdownFile(_ note: MeetingNote) -> URL? {
        let safe = note.title.isEmpty ? "meeting-notes" : note.title
            .replacingOccurrences(of: "[^A-Za-z0-9]+", with: "-", options: .regularExpression)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safe).md")
        do {
            try markdown(note).data(using: .utf8)?.write(to: url)
            return url
        } catch { return nil }
    }

    /// Renders a clean, paginated PDF of the note and returns its temporary URL.
    static func pdf(_ note: MeetingNote) -> URL? {
        let pageWidth: CGFloat = 612, pageHeight: CGFloat = 792
        let margin: CGFloat = 54
        let contentWidth = pageWidth - margin * 2
        let bounds = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)

        let renderer = UIGraphicsPDFRenderer(bounds: bounds)
        let safe = note.title.isEmpty ? "meeting-notes" : note.title
            .replacingOccurrences(of: "[^A-Za-z0-9]+", with: "-", options: .regularExpression)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safe).pdf")

        let accent = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1)
        let ink = UIColor(white: 0.1, alpha: 1)
        let secondary = UIColor(white: 0.45, alpha: 1)

        do {
            try renderer.writePDF(to: url) { ctx in
                ctx.beginPage()
                var y: CGFloat = margin

                func newPageIfNeeded(_ needed: CGFloat) {
                    if y + needed > pageHeight - margin {
                        ctx.beginPage()
                        y = margin
                    }
                }

                func draw(_ text: String, font: UIFont, color: UIColor, spacingAfter: CGFloat) {
                    let style = NSMutableParagraphStyle()
                    style.lineBreakMode = .byWordWrapping
                    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: style]
                    let rect = (text as NSString).boundingRect(
                        with: CGSize(width: contentWidth, height: .greatestFiniteMagnitude),
                        options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attrs, context: nil)
                    newPageIfNeeded(rect.height)
                    (text as NSString).draw(with: CGRect(x: margin, y: y, width: contentWidth, height: rect.height),
                                            options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attrs, context: nil)
                    y += rect.height + spacingAfter
                }

                func heading(_ title: String) {
                    newPageIfNeeded(34)
                    y += 8
                    draw(title.uppercased(), font: .systemFont(ofSize: 12, weight: .bold), color: accent, spacingAfter: 6)
                }

                func bullets(_ items: [String]) {
                    for item in items { draw("•  \(item)", font: .systemFont(ofSize: 11), color: ink, spacingAfter: 4) }
                }

                draw(note.title.isEmpty ? "Meeting Notes" : note.title,
                     font: .systemFont(ofSize: 22, weight: .bold), color: ink, spacingAfter: 4)
                var meta = note.fullDateLabel
                if let dur = note.durationLabel { meta += " · \(dur)" }
                draw(meta, font: .systemFont(ofSize: 10), color: secondary, spacingAfter: 12)

                if let summary = note.summary, !summary.isEmpty {
                    heading("Summary"); draw(summary, font: .systemFont(ofSize: 11), color: ink, spacingAfter: 6)
                }
                if let topics = note.keyTopics, !topics.isEmpty {
                    heading("Key Topics"); bullets(topics)
                }
                if let actions = note.actionItems, !actions.isEmpty {
                    heading("Action Items")
                    for a in actions {
                        var s = "\(a.isDone ? "☑" : "☐")  \(a.task)"
                        if let owner = a.owner, !owner.isEmpty { s += "  (\(owner))" }
                        if let deadline = a.deadline, !deadline.isEmpty { s += "  — by \(deadline)" }
                        draw(s, font: .systemFont(ofSize: 11), color: ink, spacingAfter: 4)
                    }
                }
                if let followUps = note.followUps, !followUps.isEmpty {
                    heading("Follow-Ups")
                    bullets(followUps.map { f in
                        var s = f.description
                        if let with = f.with, !with.isEmpty { s += " — with \(with)" }
                        return s
                    })
                }
                if let decisions = note.decisions, !decisions.isEmpty { heading("Decisions"); bullets(decisions) }
                if let insights = note.insights, !insights.isEmpty { heading("Insights"); bullets(insights) }
                if let people = note.mentionedPeople, !people.isEmpty {
                    heading("People Mentioned")
                    bullets(people.map { p in p.role.map { "\(p.name) — \($0)" } ?? p.name })
                }
                if let questions = note.openQuestions, !questions.isEmpty { heading("Open Questions"); bullets(questions) }
                if let polished = note.enhancedNotes, !polished.isEmpty {
                    heading("Polished Notes")
                    for rawLine in polished.split(separator: "\n", omittingEmptySubsequences: false) {
                        let line = rawLine.trimmingCharacters(in: .whitespaces)
                            .replacingOccurrences(of: "**", with: "")
                        if line.isEmpty { y += 4; continue }
                        if line.hasPrefix("#") {
                            let text = line.replacingOccurrences(of: "^#{1,4}\\s*", with: "", options: .regularExpression)
                            draw(text, font: .systemFont(ofSize: 11, weight: .semibold), color: ink, spacingAfter: 4)
                        } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
                            draw("•  \(String(line.dropFirst(2)))", font: .systemFont(ofSize: 11), color: ink, spacingAfter: 4)
                        } else {
                            draw(line, font: .systemFont(ofSize: 11), color: ink, spacingAfter: 4)
                        }
                    }
                }
                if let manual = note.manualNotes, !manual.isEmpty {
                    heading("Notes"); draw(manual, font: .systemFont(ofSize: 11), color: ink, spacingAfter: 6)
                }

                y += 16
                draw("Generated by Cardr", font: .systemFont(ofSize: 9), color: secondary, spacingAfter: 0)
            }
            return url
        } catch { return nil }
    }
}
