import { useState, useEffect } from "react";
import { X, Link2, Mail, FileText, Check, Copy, Loader2, Users, FileSpreadsheet, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface MeetingNote {
  id: string;
  title: string;
  summary: string | null;
  key_topics: string[];
  action_items: { task: string; owner?: string; deadline?: string; done?: boolean }[];
  follow_ups: { description: string; with?: string }[];
  decisions: string[];
  insights?: string[];
  mentioned_people?: { name: string; role?: string }[];
  open_questions?: string[];
  manual_notes: string | null;
  created_at: string;
  duration_seconds: number;
  transcript: string | null;
}

interface NoteShareSheetProps {
  note: MeetingNote;
  open: boolean;
  onClose: () => void;
}

const NoteShareSheet = ({ note, open, onClose }: NoteShareSheetProps) => {
  const { user } = useAuth();
  const { contacts } = useApp();
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [participantEmails, setParticipantEmails] = useState<string[]>([]);

  // Fetch participant emails when opened
  useEffect(() => {
    if (!open || !user) return;
    const fetchParticipantEmails = async () => {
      const { data } = await supabase
        .from("meeting_participants")
        .select("contact_id, name")
        .eq("meeting_note_id", note.id)
        .eq("user_id", user.id);
      if (!data?.length) return;
      const contactIds = data.filter(p => p.contact_id).map(p => p.contact_id!);
      if (contactIds.length === 0) return;
      // Get emails from contacts in context
      const emails = contacts
        .filter(c => contactIds.includes(c.id) && c.email)
        .map(c => c.email);
      setParticipantEmails(emails);
    };
    fetchParticipantEmails();
  }, [open, note.id, user, contacts]);

  const generateShareLink = async () => {
    setSharing(true);
    try {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from("meeting_notes")
        .update({ share_token: token } as any)
        .eq("id", note.id);
      if (error) throw error;
      const url = `${window.location.origin}/shared/${token}`;
      setShareUrl(url);
      toast.success("Share link generated!");
    } catch {
      toast.error("Could not generate link");
    }
    setSharing(false);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied!");
  };

  const buildMarkdown = () => {
    const lines: string[] = [`# ${note.title || "Meeting Notes"}\n`];
    lines.push(`Date: ${format(parseISO(note.created_at), "MMM d, yyyy · h:mm a")}\n`);
    if (note.summary) lines.push(`## Summary\n${note.summary}\n`);
    if (note.key_topics?.length) lines.push(`## Key Topics\n${note.key_topics.map(t => `- ${t}`).join("\n")}\n`);
    if (note.action_items?.length) lines.push(`## Action Items\n${note.action_items.map(a => `- [${a.done ? "x" : " "}] ${a.task}${a.owner ? ` (${a.owner})` : ""}${a.deadline ? ` — by ${a.deadline}` : ""}`).join("\n")}\n`);
    if (note.follow_ups?.length) lines.push(`## Follow-Ups\n${note.follow_ups.map(f => `- ${f.description}${f.with ? ` with ${f.with}` : ""}`).join("\n")}\n`);
    if (note.decisions?.length) lines.push(`## Decisions\n${note.decisions.map(d => `- ✓ ${d}`).join("\n")}\n`);
    if (note.insights?.length) lines.push(`## Insights\n${note.insights.map(i => `- ${i}`).join("\n")}\n`);
    if (note.open_questions?.length) lines.push(`## Open Questions\n${note.open_questions.map(q => `- ${q}`).join("\n")}\n`);
    if (note.manual_notes) lines.push(`## Notes\n${note.manual_notes}\n`);
    return lines.join("\n");
  };

  const copyFormatted = async () => {
    const text = buildMarkdown();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
      toast.success("Copied as formatted text!");
    } catch {
      toast.error("Could not copy");
    }
  };

  const shareViaEmail = () => {
    const text = buildMarkdown();
    const subject = encodeURIComponent(note.title || "Meeting Notes");
    const body = encodeURIComponent(text);
    const to = participantEmails.length > 0 ? participantEmails.join(",") : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    toast.success("Opening email client...");
  };

  const downloadPDF = () => {
    const dateStr = format(parseISO(note.created_at), "MMM d, yyyy · h:mm a");
    const durStr = note.duration_seconds > 0 ? ` · ${Math.floor(note.duration_seconds / 60)} min` : "";
    const section = (title: string, content: string) =>
      content ? `<div class="section"><h2>${title}</h2>${content}</div>` : "";
    const bullets = (items: string[]) => items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>` : "";
    const actionHtml = note.action_items?.length
      ? `<ul>${note.action_items.map(a =>
          `<li class="${a.done ? 'done' : ''}"><span class="checkbox">${a.done ? "☑" : "☐"}</span> ${a.task}${a.owner ? ` <em>(${a.owner})</em>` : ""}${a.deadline ? ` — by ${a.deadline}` : ""}</li>`
        ).join("")}</ul>` : "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title || "Meeting Notes"}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#1a1a2e;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #3b82f6;padding-bottom:8px}h2{font-size:16px;color:#3b82f6;margin-top:24px}ul{padding-left:20px}li{margin-bottom:4px}li.done{text-decoration:line-through;color:#9ca3af}.meta{color:#6b7280;font-size:13px}.checkbox{margin-right:4px}.section{margin-bottom:16px}</style></head><body>
<h1>${note.title || "Meeting Notes"}</h1><p class="meta">${dateStr}${durStr}</p>
${section("Summary", note.summary ? `<p>${note.summary}</p>` : "")}
${note.key_topics?.length ? section("Key Topics", bullets(note.key_topics)) : ""}
${section("Action Items", actionHtml)}
${section("Follow-Ups", note.follow_ups?.length ? bullets(note.follow_ups.map(f => `${f.description}${f.with ? ` — ${f.with}` : ""}`)) : "")}
${section("Decisions", bullets(note.decisions || []))}
${section("Insights", bullets(note.insights || []))}
${section("Open Questions", bullets(note.open_questions || []))}
${note.manual_notes ? section("Notes", `<p>${note.manual_notes.replace(/\n/g, "<br>")}</p>`) : ""}
<p class="meta" style="margin-top:32px;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px">Generated by Cardr · ${dateStr}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
    toast.success("PDF export opened");
  };

  const downloadExcel = () => {
    const rows: string[][] = [["Section", "Content", "Owner", "Deadline"]];
    rows.push(["Title", note.title || "Meeting Notes", "", ""]);
    rows.push(["Date", format(parseISO(note.created_at), "MMM d, yyyy h:mm a"), "", ""]);
    if (note.summary) rows.push(["Summary", note.summary, "", ""]);
    note.key_topics?.forEach(t => rows.push(["Key Topic", t, "", ""]));
    note.action_items?.forEach(a => rows.push(["Action Item", a.task, a.owner || "", a.deadline || ""]));
    note.follow_ups?.forEach(f => rows.push(["Follow-Up", f.description, f.with || "", ""]));
    note.decisions?.forEach(d => rows.push(["Decision", d, "", ""]));
    if (note.manual_notes) rows.push(["Notes", note.manual_notes, "", ""]);
    const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(note.title || "meeting-notes").replace(/[^a-z0-9]/gi, "-")}-${format(parseISO(note.created_at), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel export downloaded");
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-t-3xl border border-border/60 p-5 pb-8 max-h-[85vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-display font-bold text-foreground">Share & Export</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Quick actions row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={shareViaEmail}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-warning-light flex items-center justify-center">
                <Mail size={16} className="text-warning" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground">Email</p>
                {participantEmails.length > 0 && (
                  <p className="text-[10px] text-primary font-medium">{participantEmails.length} participant{participantEmails.length > 1 ? "s" : ""}</p>
                )}
              </div>
            </button>

            <button
              onClick={copyFormatted}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                {copiedText ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-primary" />}
              </div>
              <p className="text-xs font-semibold text-foreground">{copiedText ? "Copied!" : "Copy Text"}</p>
            </button>

            <button
              onClick={shareUrl ? copyLink : generateShareLink}
              disabled={sharing}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                {sharing ? (
                  <Loader2 size={16} className="text-accent animate-spin" />
                ) : shareUrl ? (
                  copied ? <Check size={16} className="text-accent" /> : <ExternalLink size={16} className="text-accent" />
                ) : (
                  <Link2 size={16} className="text-accent" />
                )}
              </div>
              <p className="text-xs font-semibold text-foreground">
                {shareUrl ? (copied ? "Copied!" : "Copy Link") : "Share Link"}
              </p>
            </button>
          </div>

          {/* Share link URL display */}
          {shareUrl && (
            <div className="card-elevated p-3 mb-4 flex items-center gap-2">
              <input value={shareUrl} readOnly className="flex-1 bg-transparent text-xs text-foreground truncate outline-none" />
              <button onClick={copyLink} className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} className="text-primary" />}
              </button>
            </div>
          )}

          {/* Participant email pills */}
          {participantEmails.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users size={11} /> Meeting participants
              </p>
              <div className="flex flex-wrap gap-1.5">
                {participantEmails.map((email, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium truncate max-w-[200px]">
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Export options */}
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Export</p>
          <div className="space-y-2">
            {[
              { fn: downloadPDF, icon: FileText, label: "Export as PDF", desc: "Print-ready document", color: "text-primary", bg: "bg-primary-light" },
              { fn: downloadExcel, icon: FileSpreadsheet, label: "Export as Excel", desc: "CSV spreadsheet format", color: "text-accent", bg: "bg-primary-light" },
            ].map(({ fn, icon: Icon, label, desc, color, bg }) => (
              <button key={label} onClick={fn} className="w-full card-interactive p-3.5 flex items-center gap-3 text-left">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={16} className={color} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NoteShareSheet;
