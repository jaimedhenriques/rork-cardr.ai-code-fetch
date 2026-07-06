import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, Reorder } from "framer-motion";
import { ArrowLeft, Copy, Check, Lightbulb, MessageSquare, CheckCircle2, ArrowRight, Trash2, Loader2, Share2, Users, Sparkles, RefreshCw, Pencil, Save, X, Plus, GripVertical, Brain, HelpCircle, UserCircle, Calendar, Link2, FileDown, BarChart3, Smile, Meh, Frown, Zap, MessageCircleQuestion, AlertTriangle, Quote, Shield, DollarSign, Trophy, Construction, ThumbsUp, Eye, Target, Lightbulb as LightbulbIcon, Flame, Vote, Landmark, ShieldAlert, Building2, Wallet, Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { NOTE_TEMPLATES } from "@/lib/note-templates";
import { useCustomTemplates, buildCustomTemplatePayload } from "@/hooks/useCustomTemplates";
import TemplateEditorDialog from "@/components/TemplateEditorDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import NoteShareSheet from "@/components/NoteShareSheet";
import NoteParticipants from "@/components/NoteParticipants";
import NoteContactLinker from "@/components/NoteContactLinker";
import NoteEventLinker from "@/components/NoteEventLinker";
import PageHeader from "@/components/PageHeader";
import NoteChat from "@/components/NoteChat";
import NoteTagPicker from "@/components/NoteTagPicker";
import NoteCategoryPicker from "@/components/NoteCategoryPicker";
import NoteFolderPicker from "@/components/NoteFolderPicker";
import { fireWebhook } from "@/lib/webhooks";
import { autoSyncNote } from "@/lib/crm-sync";
import CrmPushButton from "@/components/CrmPushButton";
import { useLanguage } from "@/context/LanguageContext";

interface MeetingAnalytics {
  talkTimeRatio?: Record<string, number>;
  questionsAsked?: number;
  sentimentScore?: number;
  sentimentLabel?: string;
  engagementLevel?: string;
  topSpeaker?: string;
  keyMetrics?: { label: string; value: string; icon: string }[];
  templateFields?: Record<string, any>;
}

interface MeetingNote {
  id: string;
  title: string;
  transcript: string | null;
  duration_seconds: number;
  summary: string | null;
  key_topics: string[];
  action_items: { task: string; owner?: string; deadline?: string; done?: boolean; priority?: string }[];
  follow_ups: { description: string; with?: string; urgency?: string }[];
  decisions: string[];
  insights: string[];
  mentioned_people: { name: string; role?: string; context?: string }[];
  open_questions: string[];
  manual_notes: string | null;
  enhanced_notes: string | null;
  calendar_event_id: string | null;
  category: string | null;
  folder_id: string | null;
  created_at: string;
  analytics: MeetingAnalytics | null;
}

const GUEST_NOTES_KEY = "cardscanpro_guest_notes";

/** Lightweight Markdown rendering for AI-polished notes (headings, bullets, bold). */
const renderMarkdownLite = (text: string) => {
  const bold = (s: string) =>
    s.split(/\*\*(.+?)\*\*/g).map((part, j) =>
      j % 2 === 1 ? <strong key={j} className="font-semibold text-foreground">{part}</strong> : part
    );
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;
    if (/^#{1,3}\s/.test(trimmed)) {
      return (
        <p key={i} className="text-[13px] font-bold text-foreground mt-2 mb-0.5">
          {bold(trimmed.replace(/^#{1,3}\s/, ""))}
        </p>
      );
    }
    if (/^[-*]\s/.test(trimmed)) {
      return (
        <div key={i} className="flex items-start gap-2 ml-1">
          <span className="w-1 h-1 rounded-full bg-primary mt-[7px] shrink-0" />
          <p className="text-sm text-foreground/80 leading-relaxed">{bold(trimmed.replace(/^[-*]\s/, ""))}</p>
        </div>
      );
    }
    return (
      <p key={i} className="text-sm text-foreground/80 leading-relaxed">
        {bold(trimmed)}
      </p>
    );
  });
};

const NoteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { contacts } = useApp();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [note, setNote] = useState<MeetingNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("general");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const { templates: customTemplates, myTemplates, teamTemplates } = useCustomTemplates();
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState("");
  const [speakerSearchQuery, setSpeakerSearchQuery] = useState("");

  // Section editing states
  const [contactLinkerOpen, setContactLinkerOpen] = useState(false);
  const [eventLinkerOpen, setEventLinkerOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editTopics, setEditTopics] = useState<string[]>([]);
  const [editActions, setEditActions] = useState<{ task: string; owner?: string; deadline?: string; done?: boolean }[]>([]);
  const [editFollowUps, setEditFollowUps] = useState<{ description: string; with?: string }[]>([]);
  const [editDecisions, setEditDecisions] = useState<string[]>([]);

  const loadNote = useCallback(async () => {
    if (!id) return;
    if (!user) {
      const notes: MeetingNote[] = JSON.parse(localStorage.getItem(GUEST_NOTES_KEY) || "[]");
      setNote(notes.find((n) => n.id === id) || null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("meeting_notes").select("*").eq("id", id).eq("user_id", user.id).single();
    if (data) {
      setNote({
        id: data.id,
        title: data.title,
        transcript: data.transcript,
        duration_seconds: data.duration_seconds ?? 0,
        summary: data.summary,
        key_topics: (data.key_topics as any[]) || [],
        action_items: (data.action_items as any[]) || [],
        follow_ups: (data.follow_ups as any[]) || [],
        decisions: (data.decisions as any[]) || [],
        insights: ((data as any).insights as any[]) || [],
        mentioned_people: ((data as any).mentioned_people as any[]) || [],
        open_questions: ((data as any).open_questions as any[]) || [],
        manual_notes: data.manual_notes,
        enhanced_notes: (data as any).enhanced_notes ?? null,
        calendar_event_id: data.calendar_event_id || null,
        category: (data as any).category || null,
        folder_id: (data as any).folder_id || null,
        created_at: data.created_at,
        analytics: ((data as any).analytics as MeetingAnalytics) || null,
      });
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => { loadNote(); }, [loadNote]);

  // Auto-enhance: trigger AI summary when note has content but no summary
  const autoEnhanceTriggered = useRef(false);
  useEffect(() => {
    if (!note || autoEnhanceTriggered.current) return;
    const hasContent = note.manual_notes || note.transcript;
    const hasSummary = note.summary || (note.key_topics?.length > 0) || (note.action_items?.length > 0);
    if (hasContent && !hasSummary) {
      autoEnhanceTriggered.current = true;
      // Small delay to let the page render first
      const timer = setTimeout(() => { handleSummarize(); }, 800);
      return () => clearTimeout(timer);
    }
  }, [note]);

  const persistNote = async (updates: any) => {
    if (!id) return;
    if (user) {
      await supabase.from("meeting_notes").update(updates).eq("id", id).eq("user_id", user.id);
      fireWebhook("note.updated", { id, updates });
      if (note) {
        autoSyncNote({
          noteId: id!,
          title: (updates as any).title ?? note.title,
          summary: (updates as any).summary ?? note.summary,
          transcript: note.transcript,
          manual_notes: (updates as any).manual_notes ?? note.manual_notes,
          action_items: (updates as any).action_items ?? note.action_items,
          decisions: (updates as any).decisions ?? note.decisions,
          follow_ups: (updates as any).follow_ups ?? note.follow_ups,
          category: (updates as any).category ?? note.category,
          duration_seconds: note.duration_seconds,
          created_at: note.created_at,
        });
      }
    } else {
      const notes = JSON.parse(localStorage.getItem(GUEST_NOTES_KEY) || "[]");
      const idx = notes.findIndex((n: any) => n.id === id);
      if (idx >= 0) {
        notes[idx] = { ...notes[idx], ...updates };
        localStorage.setItem(GUEST_NOTES_KEY, JSON.stringify(notes));
      }
    }
    setNote((prev) => prev ? { ...prev, ...updates } : prev);
  };

  const handleSummarize = async () => {
    if (!note || !id) return;
    const text = note.transcript || note.manual_notes;
    if (!text || text.length < 20) {
      toast.error(t("noteDetail.tooShort"));
      return;
    }
    setSummarizing(true);
    try {
      const activeCustomTemplate = customTemplates.find((c) => `custom-${c.id}` === selectedTemplateId);
      const { data, error } = await supabase.functions.invoke("meeting-notes", {
        body: {
          transcript: `Title: ${note.title}\n\n${text}`,
          manualNotes: note.transcript && note.manual_notes ? note.manual_notes : undefined,
          durationSeconds: note.duration_seconds,
          templateId: selectedTemplateId !== "general" ? selectedTemplateId : undefined,
          ...(activeCustomTemplate ? { customTemplate: buildCustomTemplatePayload(activeCustomTemplate) } : {}),
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.notes) throw new Error("No summary returned");
      const updates: any = {};
      if (data.notes.summary) updates.summary = data.notes.summary;
      if (data.notes.keyTopics?.length) updates.key_topics = data.notes.keyTopics;
      if (data.notes.actionItems?.length) updates.action_items = data.notes.actionItems;
      if (data.notes.followUps?.length) updates.follow_ups = data.notes.followUps;
      if (data.notes.decisions?.length) updates.decisions = data.notes.decisions;
      if (data.notes.insights?.length) updates.insights = data.notes.insights;
      if (data.notes.mentionedPeople?.length) updates.mentioned_people = data.notes.mentionedPeople;
      if (data.notes.openQuestions?.length) updates.open_questions = data.notes.openQuestions;
      if (data.notes.analytics) updates.analytics = data.notes.analytics;
      if (typeof data.notes.enhancedNotes === "string" && data.notes.enhancedNotes.trim()) updates.enhanced_notes = data.notes.enhancedNotes;
      // Capture template-specific fields
      const templateFieldKeys = [
        "painPoints", "objections", "buyerQuotes", "competitorMentions", "budgetSignals", "decisionProcess",
        "wins", "blockers", "feedback", "careerGoals", "morale",
        "completedWork", "plannedWork", "sprintRisks",
        "audienceReactions", "questionsAsked", "buyingSignals", "featureInterest", "competitorComparisons", "closePlan",
        "ideasGenerated", "themes", "topIdeas", "concerns", "experimentsToRun",
        "motionsAndVotes", "strategicPriorities", "riskItems", "committeeUpdates", "budgetItems", "governanceActions",
        "callPurpose", "commitments", "requestsMade", "toneAssessment", "relationshipSignals", "callbackNeeded",
      ];
      const templateFields: Record<string, any> = {};
      for (const key of templateFieldKeys) {
        if (data.notes[key]) templateFields[key] = data.notes[key];
      }
      // Custom templates return their sections pre-collected by the server
      if (data.notes.templateFields && typeof data.notes.templateFields === "object") {
        Object.assign(templateFields, data.notes.templateFields);
      }
      if (Object.keys(templateFields).length > 0) {
        updates.analytics = { ...(updates.analytics || {}), templateFields };
      }
      await persistNote(updates);
      toast.success(t("noteDetail.aiGenerated"));

      // Auto-suggest contact linking if AI detected people with matching contacts
      if (data.notes.mentionedPeople?.length && contacts.length > 0) {
        const mentionedNames = (data.notes.mentionedPeople as { name: string }[]).map(p => p.name.toLowerCase());
        const hasMatches = mentionedNames.some(name =>
          contacts.some(c => {
            const cName = c.name.toLowerCase();
            return cName.includes(name) || name.includes(cName) ||
              name.split(" ").some((w: string) => w.length > 2 && cName.includes(w));
          })
        );
        if (hasMatches) {
          setTimeout(() => {
            setContactLinkerOpen(true);
            toast.info(`${data.notes.mentionedPeople.length} people detected — link them to your contacts`, { duration: 4000 });
          }, 600);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to summarize");
    } finally {
      setSummarizing(false);
    }
  };

  const toggleActionItem = async (index: number) => {
    if (!note || !id) return;
    const updated = [...note.action_items];
    updated[index] = { ...updated[index], done: !updated[index].done };
    await persistNote({ action_items: updated });
  };

  const startEditing = () => {
    if (!note) return;
    setEditTitle(note.title || "");
    setEditBody(note.manual_notes || note.transcript || "");
    setEditing(true);
  };

  const cancelEditing = () => { setEditing(false); };

  const saveEdit = async () => {
    if (!note || !id) return;
    setSavingEdit(true);
    await persistNote({
      title: editTitle.trim() || "Untitled Note",
      manual_notes: editBody.trim() || null,
    });
    setEditing(false);
    setSavingEdit(false);
    toast.success(t("noteDetail.noteUpdated"));
  };

  const saveAndReanalyze = async () => {
    await saveEdit();
    setTimeout(() => handleSummarize(), 300);
  };

  // Section edit helpers
  const startSectionEdit = (section: string) => {
    if (!note) return;
    setEditingSection(section);
    if (section === "summary") setEditSummary(note.summary || "");
    if (section === "topics") setEditTopics([...note.key_topics]);
    if (section === "actions") setEditActions(note.action_items.map(a => ({ ...a })));
    if (section === "followups") setEditFollowUps(note.follow_ups.map(f => ({ ...f })));
    if (section === "decisions") setEditDecisions([...note.decisions]);
  };

  const saveSectionEdit = async () => {
    if (!editingSection) return;
    let updates: any = {};
    if (editingSection === "summary") updates.summary = editSummary.trim() || null;
    if (editingSection === "topics") updates.key_topics = editTopics.filter(t => t.trim());
    if (editingSection === "actions") updates.action_items = editActions.filter(a => a.task.trim());
    if (editingSection === "followups") updates.follow_ups = editFollowUps.filter(f => f.description.trim());
    if (editingSection === "decisions") updates.decisions = editDecisions.filter(d => d.trim());
    await persistNote(updates);
    setEditingSection(null);
    toast.success(t("noteDetail.updated"));
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!user) {
      const notes: MeetingNote[] = JSON.parse(localStorage.getItem(GUEST_NOTES_KEY) || "[]");
      localStorage.setItem(GUEST_NOTES_KEY, JSON.stringify(notes.filter((n) => n.id !== id)));
    } else {
      await supabase.from("meeting_notes").delete().eq("id", id).eq("user_id", user.id);
      fireWebhook("note.deleted", { id });
    }
    toast.success(t("noteDetail.noteDeleted"));
    navigate("/notes");
  };

  const copyNotes = async () => {
    if (!note) return;
    const lines: string[] = [`# ${note.title || "Meeting Notes"}\n`];
    if (note.summary) lines.push(`## Summary\n${note.summary}\n`);
    if (note.key_topics?.length) lines.push(`## Key Topics\n${note.key_topics.map((t) => `- ${t}`).join("\n")}\n`);
    if (note.action_items?.length) lines.push(`## Action Items\n${note.action_items.map((a) => `- [${a.done ? "x" : " "}] ${a.task}${a.owner ? ` (${a.owner})` : ""}${a.deadline ? ` — by ${a.deadline}` : ""}`).join("\n")}\n`);
    if (note.follow_ups?.length) lines.push(`## Follow-Ups\n${note.follow_ups.map((f) => `- ${f.description}${f.with ? ` with ${f.with}` : ""}`).join("\n")}\n`);
    if (note.decisions?.length) lines.push(`## Decisions\n${note.decisions.map((d) => `- ${d}`).join("\n")}\n`);
    if (note.enhanced_notes) lines.push(`## Polished Notes\n${note.enhanced_notes}\n`);
    if (note.manual_notes) lines.push(`## Notes\n${note.manual_notes}\n`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("noteDetail.notesCopied"));
    } catch { toast.error(t("noteDetail.couldNotCopy")); }
  };

  const exportPdf = () => {
    if (!note) return;
    const dateStr = format(parseISO(note.created_at), "MMM d, yyyy · h:mm a");
    const durStr = note.duration_seconds > 0 ? ` · ${Math.floor(note.duration_seconds / 60)} min` : "";

    const section = (title: string, content: string) =>
      content ? `<div class="section"><h2>${title}</h2>${content}</div>` : "";

    const bullets = (items: string[]) => items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>` : "";

    const actionHtml = note.action_items?.length
      ? `<ul>${note.action_items.map(a =>
          `<li class="${a.done ? 'done' : ''}"><span class="checkbox">${a.done ? "☑" : "☐"}</span> ${a.task}${a.owner ? ` <span class="meta">(${a.owner})</span>` : ""}${a.deadline ? ` <span class="meta">— by ${a.deadline}</span>` : ""}${a.priority ? ` <span class="priority priority-${a.priority}">${a.priority}</span>` : ""}</li>`
        ).join("")}</ul>` : "";

    const followUpHtml = note.follow_ups?.length
      ? `<ul>${note.follow_ups.map(f =>
          `<li>${f.description}${f.with ? ` <span class="meta">with ${f.with}</span>` : ""}${f.urgency ? ` <span class="priority priority-${f.urgency}">${f.urgency}</span>` : ""}</li>`
        ).join("")}</ul>` : "";

    const peopleHtml = note.mentioned_people?.length
      ? `<ul>${note.mentioned_people.map(p =>
          `<li><strong>${p.name}</strong>${p.role ? ` — ${p.role}` : ""}${p.context ? `<br/><span class="meta">${p.context}</span>` : ""}</li>`
        ).join("")}</ul>` : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title || "Meeting Notes"}</title>
<style>
  @page { margin: 1in 0.75in; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a2e; line-height: 1.6; max-width: 100%; margin: 0; padding: 0; font-size: 11pt; }
  .header { border-bottom: 3px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22pt; margin: 0 0 6px 0; color: #0d1117; }
  .header .meta { font-size: 10pt; color: #6b7280; }
  .section { margin-bottom: 20px; page-break-inside: avoid; }
  .section h2 { font-size: 13pt; color: #3b82f6; margin: 0 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
  .section p { margin: 0; }
  ul { margin: 4px 0; padding-left: 20px; }
  li { margin-bottom: 4px; }
  li.done { text-decoration: line-through; color: #9ca3af; }
  .meta { color: #6b7280; font-size: 9pt; }
  .checkbox { font-size: 12pt; margin-right: 4px; }
  .priority { font-size: 8pt; padding: 1px 6px; border-radius: 8px; font-weight: 600; text-transform: uppercase; }
  .priority-high { background: #fef2f2; color: #dc2626; }
  .priority-medium { background: #fffbeb; color: #d97706; }
  .priority-low { background: #f0fdf4; color: #16a34a; }
  .topics { display: flex; flex-wrap: wrap; gap: 6px; }
  .topic-tag { background: #eff6ff; color: #2563eb; padding: 2px 10px; border-radius: 12px; font-size: 9pt; font-weight: 500; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #9ca3af; text-align: center; }
</style></head><body>
<div class="header">
  <h1>${note.title || "Meeting Notes"}</h1>
  <div class="meta">${dateStr}${durStr}</div>
</div>
${section("Summary", note.summary ? `<p>${note.summary}</p>` : "")}
${note.key_topics?.length ? `<div class="section"><h2>Key Topics</h2><div class="topics">${note.key_topics.map(t => `<span class="topic-tag">${t}</span>`).join("")}</div></div>` : ""}
${section("Action Items", actionHtml)}
${section("Follow-Ups", followUpHtml)}
${section("Decisions", bullets(note.decisions || []))}
${section("Insights", bullets(note.insights || []))}
${section("People Mentioned", peopleHtml)}
${section("Open Questions", bullets(note.open_questions || []))}
${note.manual_notes ? section("Notes", `<p>${note.manual_notes.replace(/\n/g, "<br/>")}</p>`) : ""}
<div class="footer">Generated by Cardr · ${dateStr}</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
    } else {
      // Fallback: download as HTML
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(note.title || "meeting-notes").replace(/[^a-zA-Z0-9]/g, "-")}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.info(t("noteDetail.savePdfHint"));
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">{t("noteDetail.notFound")}</p>
        <button onClick={() => navigate("/notes")} className="mt-3 text-sm text-primary font-semibold">{t("noteDetail.goBack")}</button>
      </div>
    );
  }

  const formatDur = (s: number) => {
    if (!s) return "";
    const m = Math.floor(s / 60);
    return m > 0 ? `${m} min` : `${s}s`;
  };

  const hasContent = note.manual_notes || note.transcript;
  const hasSummary = note.summary || note.key_topics?.length > 0 || note.action_items?.length > 0;

  const SectionEditButtons = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
        <X size={12} /> Cancel
      </button>
      <button onClick={onSave} className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary px-3 py-2 rounded-lg hover:opacity-90 transition-opacity ml-auto">
        <Save size={12} /> Save
      </button>
    </div>
  );

  const EditButton = ({ section }: { section: string }) => (
    <button onClick={() => startSectionEdit(section)} className="flex items-center gap-1 text-[11px] font-semibold text-primary ml-auto shrink-0">
      <Pencil size={10} /> Edit
    </button>
  );

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader back="/notes" rightContent={
        <div className="flex gap-2">
          <button onClick={() => setParticipantsOpen(true)} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center">
            <Users size={14} className="text-muted-foreground" />
          </button>
          {note && (
            <CrmPushButton note={{
              noteId: note.id,
              title: note.title,
              summary: note.summary,
              transcript: note.transcript,
              manual_notes: note.manual_notes,
              action_items: note.action_items,
              decisions: note.decisions,
              follow_ups: note.follow_ups,
              category: note.category,
              duration_seconds: note.duration_seconds,
              created_at: note.created_at,
            }} />
          )}
          <button onClick={() => setShareOpen(true)} className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Share2 size={14} className="text-primary-foreground" />
          </button>
          <button onClick={handleDelete} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center">
            <Trash2 size={14} className="text-destructive" />
          </button>
        </div>
      } />

      {/* Title + Meta */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {editing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="text-xl font-display font-bold text-foreground bg-transparent border-b border-primary/40 outline-none w-full mb-1 pb-1"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-display font-bold text-foreground">{note.title || t("noteDetail.untitled")}</h1>
            <button onClick={startEditing} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
              <Pencil size={14} className="text-muted-foreground" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <span>{format(parseISO(note.created_at), "MMM d, yyyy · h:mm a")}</span>
          {note.duration_seconds > 0 && <span>· {formatDur(note.duration_seconds)}</span>}
        </div>

        {/* Folder · Category · Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <NoteFolderPicker noteId={note.id} initialFolderId={note.folder_id} onChange={(fid) => setNote(n => n ? { ...n, folder_id: fid } : n)} />
          <NoteCategoryPicker noteId={note.id} initialCategory={note.category} onChange={(c) => setNote(n => n ? { ...n, category: c } : n)} />
        </div>
        <NoteTagPicker noteId={note.id} className="mb-4" />

        {/* Calendar Event Link */}
        <button
          onClick={() => setEventLinkerOpen(true)}
          className={`flex items-center gap-2 mb-5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
            note.calendar_event_id
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border/60"
          }`}
        >
          <Calendar size={12} />
          {note.calendar_event_id ? t("noteDetail.linkedEvent") : t("noteDetail.linkEvent")}
          <Link2 size={10} className="ml-auto" />
        </button>
      </motion.div>

      {/* Auto-enhancing indicator */}
      {summarizing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full mb-4 p-4 rounded-2xl card-elevated flex items-center gap-3">
          <Loader2 size={16} className="text-primary animate-spin" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t("noteDetail.enhancing")}</p>
            <p className="text-[11px] text-muted-foreground">{t("noteDetail.enhancingDesc")}</p>
          </div>
        </motion.div>
      )}

      {hasSummary && hasContent && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-3">
          {/* Template Selector */}
          <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 hover:bg-muted px-2.5 py-1.5 rounded-lg transition-colors">
                <span>{customTemplates.find(c => `custom-${c.id}` === selectedTemplateId)?.emoji || NOTE_TEMPLATES.find(t => t.id === selectedTemplateId)?.emoji || "📋"}</span>
                <span className="max-w-[100px] truncate">{customTemplates.find(c => `custom-${c.id}` === selectedTemplateId)?.name || NOTE_TEMPLATES.find(t => t.id === selectedTemplateId)?.label || "General"}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1.5" sideOffset={4}>
              <div className="space-y-0.5">
                {NOTE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTemplateId(t.id); setTemplatePickerOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                      selectedTemplateId === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    <span className="text-sm">{t.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                    </div>
                  </button>
                ))}
                {myTemplates.length > 0 && (
                  <p className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground border-t border-border/60 mt-1">{t("noteRecord.myTemplates")}</p>
                )}
                {myTemplates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedTemplateId(`custom-${c.id}`); setTemplatePickerOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                      selectedTemplateId === `custom-${c.id}` ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    <span className="text-sm">{c.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.description || c.fields.map((f) => f.label).join(" · ")}</p>
                    </div>
                    {c.isShared && <Users size={10} className="text-primary/70 shrink-0" />}
                  </button>
                ))}
                {teamTemplates.length > 0 && (
                  <p className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground border-t border-border/60 mt-1">{t("noteRecord.teamTemplates")}</p>
                )}
                {teamTemplates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedTemplateId(`custom-${c.id}`); setTemplatePickerOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                      selectedTemplateId === `custom-${c.id}` ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    <span className="text-sm">{c.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.description || c.fields.map((f) => f.label).join(" · ")}</p>
                    </div>
                    <Users size={10} className="text-muted-foreground shrink-0" />
                  </button>
                ))}
                {user && (
                  <button
                    onClick={() => { setTemplatePickerOpen(false); setTemplateEditorOpen(true); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left hover:bg-muted/80 transition-colors border-t border-border/60 mt-1"
                  >
                    <Plus size={12} className="text-primary" />
                    <p className="text-xs font-semibold text-primary">{t("noteRecord.newTemplate")}</p>
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <TemplateEditorDialog
            open={templateEditorOpen}
            onOpenChange={setTemplateEditorOpen}
            onSaved={(tpl) => setSelectedTemplateId(`custom-${tpl.id}`)}
          />

          <button onClick={handleSummarize} disabled={summarizing} className="flex items-center gap-1.5 text-xs font-semibold text-primary ml-auto">
            {summarizing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {t("noteDetail.reAnalyze")}
          </button>
        </motion.div>
      )}

      <div className="space-y-4">
        {/* Summary — Editable */}
        {(note.summary || editingSection === "summary") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.summary")}</h3>
              {editingSection !== "summary" && <EditButton section="summary" />}
            </div>
            {editingSection === "summary" ? (
              <>
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full min-h-[100px] bg-secondary/50 rounded-lg text-sm text-foreground p-3 resize-none outline-none focus:ring-1 focus:ring-primary/30 leading-relaxed"
                  autoFocus
                />
                <SectionEditButtons onSave={saveSectionEdit} onCancel={() => setEditingSection(null)} />
              </>
            ) : (
              <p className="text-sm text-foreground/80 leading-relaxed">{note.summary}</p>
            )}
          </motion.div>
        )}

        {/* Meeting Analytics Cards */}
        {note.analytics?.keyMetrics && note.analytics.keyMetrics.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.meetingAnalytics")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {note.analytics.keyMetrics.map((metric, i) => {
                const iconMap: Record<string, React.ReactNode> = {
                  "help-circle": <MessageCircleQuestion size={18} className="text-primary" />,
                  "smile": <Smile size={18} className="text-accent" />,
                  "meh": <Meh size={18} className="text-warning" />,
                  "frown": <Frown size={18} className="text-destructive" />,
                  "bar-chart": <BarChart3 size={18} className="text-primary" />,
                  "zap": <Zap size={18} className="text-warning" />,
                };
                const sentimentColors: Record<string, string> = {
                  "very positive": "from-accent/20 to-accent/5 border-accent/30",
                  "positive": "from-primary/20 to-primary/5 border-primary/30",
                  "mixed": "from-warning/20 to-warning/5 border-warning/30",
                  "neutral": "from-muted/20 to-muted/5 border-border",
                  "negative": "from-destructive/20 to-destructive/5 border-destructive/30",
                };
                const isSentiment = metric.label.toLowerCase().includes("sentiment");
                const sentimentVal = note.analytics?.sentimentLabel || "";
                const cardGradient = isSentiment && sentimentColors[sentimentVal]
                  ? sentimentColors[sentimentVal]
                  : "from-secondary to-secondary/50 border-border/60";

                return (
                  <div
                    key={i}
                    className={`rounded-2xl border bg-gradient-to-br ${cardGradient} p-3.5 flex items-center gap-3`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-background/60 flex items-center justify-center shrink-0">
                      {iconMap[metric.icon] || <BarChart3 size={18} className="text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-foreground leading-tight">{metric.value}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{metric.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Talk-time ratio bar */}
            {note.analytics.talkTimeRatio && Object.keys(note.analytics.talkTimeRatio).length > 1 && (
              <div className="mt-3 card-elevated p-3.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("noteDetail.talkTime")}</p>
                <div className="flex rounded-full overflow-hidden h-3">
                  {Object.entries(note.analytics.talkTimeRatio).map(([speaker, ratio], i) => {
                    const colors = [
                      "bg-primary", "bg-accent", "bg-warning", "bg-destructive/70", "bg-primary/60",
                    ];
                    return (
                      <div
                        key={speaker}
                        className={`${colors[i % colors.length]} transition-all`}
                        style={{ width: `${Math.round((ratio as number) * 100)}%` }}
                        title={`${speaker}: ${Math.round((ratio as number) * 100)}%`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {Object.entries(note.analytics.talkTimeRatio).map(([speaker, ratio], i) => {
                    const dotColors = ["bg-primary", "bg-accent", "bg-warning", "bg-destructive/70"];
                    return (
                      <div key={speaker} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${dotColors[i % dotColors.length]}`} />
                        <span className="text-[10px] text-muted-foreground">{speaker} · {Math.round((ratio as number) * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}


        {(note.key_topics?.length > 0 || editingSection === "topics") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.keyTopics")}</h3>
              {editingSection !== "topics" && <EditButton section="topics" />}
            </div>
            {editingSection === "topics" ? (
              <>
                <div className="space-y-2">
                  {editTopics.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={t}
                        onChange={(e) => { const u = [...editTopics]; u[i] = e.target.value; setEditTopics(u); }}
                        className="flex-1 bg-secondary/50 rounded-lg text-sm text-foreground px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <button onClick={() => setEditTopics(editTopics.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive"><X size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => setEditTopics([...editTopics, ""])} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Plus size={12} /> {t("noteDetail.addTopic")}
                  </button>
                </div>
                <SectionEditButtons onSave={saveSectionEdit} onCancel={() => setEditingSection(null)} />
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {note.key_topics.map((t, i) => (
                  <span key={i} className="text-xs font-medium bg-[hsl(var(--primary-light))] text-primary rounded-full px-3 py-1">{t}</span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Action Items — Editable */}
        {(note.action_items?.length > 0 || editingSection === "actions") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.actionItems")}</h3>
              {editingSection !== "actions" && (
                <>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {note.action_items.filter(a => a.done).length}/{note.action_items.length} {t("noteDetail.done")}
                  </span>
                  <EditButton section="actions" />
                </>
              )}
            </div>
            {editingSection === "actions" ? (
              <>
                <Reorder.Group axis="y" values={editActions} onReorder={setEditActions} className="space-y-3">
                  {editActions.map((item, i) => (
                    <Reorder.Item key={`action-${i}-${item.task.slice(0, 10)}`} value={item} className="bg-secondary/30 rounded-lg p-3 space-y-2 cursor-grab active:cursor-grabbing">
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-muted-foreground/40 shrink-0" />
                        <input
                          value={item.task}
                          onChange={(e) => { const u = [...editActions]; u[i] = { ...u[i], task: e.target.value }; setEditActions(u); }}
                          placeholder={t("noteDetail.taskDesc")}
                          className="flex-1 bg-secondary/50 rounded-lg text-sm text-foreground px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <button onClick={() => setEditActions(editActions.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive"><X size={14} /></button>
                      </div>
                      <div className="flex gap-2 pl-6">
                        <input
                          value={item.owner || ""}
                          onChange={(e) => { const u = [...editActions]; u[i] = { ...u[i], owner: e.target.value }; setEditActions(u); }}
                          placeholder={t("noteDetail.owner")}
                          className="flex-1 bg-secondary/50 rounded-lg text-xs text-foreground px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          value={item.deadline || ""}
                          onChange={(e) => { const u = [...editActions]; u[i] = { ...u[i], deadline: e.target.value }; setEditActions(u); }}
                          placeholder={t("noteDetail.deadline")}
                          className="flex-1 bg-secondary/50 rounded-lg text-xs text-foreground px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
                <button onClick={() => setEditActions([...editActions, { task: "", owner: "", deadline: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-primary mt-3">
                  <Plus size={12} /> {t("noteDetail.addAction")}
                </button>
                <SectionEditButtons onSave={saveSectionEdit} onCancel={() => setEditingSection(null)} />
              </>
            ) : (
              <div className="space-y-2.5">
                {note.action_items.map((item, i) => (
                  <button key={i} onClick={() => toggleActionItem(i)} className="w-full flex items-start gap-3 text-left">
                    <div className={`w-5 h-5 rounded-md border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                      item.done ? "bg-primary border-primary" : "border-primary/40"
                    }`}>
                      {item.done && <Check size={12} className="text-primary-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.task}</p>
                      {(item.owner || item.deadline) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.owner && <span className="font-medium">{item.owner}</span>}
                          {item.owner && item.deadline && " · "}
                          {item.deadline && <span>by {item.deadline}</span>}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Follow-Ups — Editable */}
        {(note.follow_ups?.length > 0 || editingSection === "followups") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.followUps")}</h3>
              {editingSection !== "followups" && <EditButton section="followups" />}
            </div>
            {editingSection === "followups" ? (
              <>
                <Reorder.Group axis="y" values={editFollowUps} onReorder={setEditFollowUps} className="space-y-2">
                  {editFollowUps.map((f, i) => (
                    <Reorder.Item key={`followup-${i}-${f.description.slice(0, 10)}`} value={f} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2 cursor-grab active:cursor-grabbing">
                      <GripVertical size={14} className="text-muted-foreground/40 shrink-0" />
                      <input
                        value={f.description}
                        onChange={(e) => { const u = [...editFollowUps]; u[i] = { ...u[i], description: e.target.value }; setEditFollowUps(u); }}
                        placeholder={t("noteDetail.followUpDesc")}
                        className="flex-1 bg-secondary/50 rounded-lg text-sm text-foreground px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <input
                        value={f.with || ""}
                        onChange={(e) => { const u = [...editFollowUps]; u[i] = { ...u[i], with: e.target.value }; setEditFollowUps(u); }}
                        placeholder={t("noteDetail.with")}
                        className="w-24 bg-secondary/50 rounded-lg text-sm text-foreground px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <button onClick={() => setEditFollowUps(editFollowUps.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive"><X size={14} /></button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
                <button onClick={() => setEditFollowUps([...editFollowUps, { description: "", with: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-primary mt-2">
                  <Plus size={12} /> {t("noteDetail.addFollowUp")}
                </button>
                <SectionEditButtons onSave={saveSectionEdit} onCancel={() => setEditingSection(null)} />
              </>
            ) : (
              <div className="space-y-2">
                {note.follow_ups.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <p className="text-sm text-foreground/80">{f.description}{f.with && <span className="text-primary font-medium"> — {f.with}</span>}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Decisions — Editable */}
        {(note.decisions?.length > 0 || editingSection === "decisions") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-accent" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.decisions")}</h3>
              {editingSection !== "decisions" && <EditButton section="decisions" />}
            </div>
            {editingSection === "decisions" ? (
              <>
                <div className="space-y-2">
                  {editDecisions.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={d}
                        onChange={(e) => { const u = [...editDecisions]; u[i] = e.target.value; setEditDecisions(u); }}
                        className="flex-1 bg-secondary/50 rounded-lg text-sm text-foreground px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <button onClick={() => setEditDecisions(editDecisions.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive"><X size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => setEditDecisions([...editDecisions, ""])} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Plus size={12} /> {t("noteDetail.addDecision")}
                  </button>
                </div>
                <SectionEditButtons onSave={saveSectionEdit} onCancel={() => setEditingSection(null)} />
              </>
            ) : (
              <ul className="space-y-1.5">
                {note.decisions.map((d, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                    <span className="text-accent mt-0.5">✓</span> {d}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {/* Insights */}
        {note.insights?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.insights")}</h3>
            </div>
            <div className="space-y-2">
              {note.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary text-xs mt-0.5">💡</span>
                  <p className="text-sm text-foreground/80 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Mentioned People / Link Contacts — always show */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card-elevated p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCircle size={14} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.people")}</h3>
            <button onClick={() => setContactLinkerOpen(true)} className="flex items-center gap-1 text-[11px] font-semibold text-primary ml-auto">
              <Link2 size={10} /> {t("noteDetail.linkContacts")}
            </button>
          </div>
          {note.mentioned_people?.length > 0 ? (
            <div className="space-y-2.5">
              {note.mentioned_people.map((person: any, i) => {
                const isLinked = !!(person as any).contactId;
                const handleUnlink = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const updatedPeople = (note.mentioned_people || []).map((p: any) =>
                    p.name === person.name
                      ? { name: p.name, role: p.role, context: p.context }
                      : p
                  );
                  await persistNote({ mentioned_people: updatedPeople as any });
                  toast.success(`${t("noteDetail.unlinked")} ${person.name}`);
                };
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 ${isLinked ? "cursor-pointer" : ""}`}
                    onClick={() => isLinked && navigate(`/contact/${(person as any).contactId}`)}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isLinked ? "bg-accent/15" : "bg-primary/10"}`}>
                      <span className={`text-[10px] font-bold ${isLinked ? "text-accent" : "text-primary"}`}>{person.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {person.name}
                        {person.role && <span className="text-muted-foreground font-normal"> — {person.role}</span>}
                      </p>
                      {isLinked && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-accent font-medium flex items-center gap-1">
                            <Check size={10} /> {t("noteDetail.linkedTo")} {(person as any).linkedContactName || "contact"}
                          </p>
                          <button
                            onClick={handleUnlink}
                            className="text-[10px] text-destructive/70 hover:text-destructive font-medium flex items-center gap-0.5 transition-colors"
                          >
                            <X size={9} /> {t("noteDetail.unlink")}
                          </button>
                        </div>
                      )}
                      {person.context && <p className="text-xs text-muted-foreground mt-0.5">{person.context}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("noteDetail.noPeople")}</p>
          )}
        </motion.div>

        {/* Open Questions */}
        {note.open_questions?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle size={14} className="text-accent" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.openQuestions")}</h3>
            </div>
            <div className="space-y-1.5">
              {note.open_questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-accent text-xs mt-0.5">?</span>
                  <p className="text-sm text-foreground/80">{q}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Template-Specific Sections */}
        {note.analytics?.templateFields && Object.keys(note.analytics.templateFields).length > 0 && (() => {
          const tf = note.analytics!.templateFields as Record<string, any>;

          const sectionConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
            painPoints:           { icon: <Flame size={14} />,           label: "Pain Points",           color: "text-destructive", bg: "bg-destructive/10" },
            objections:           { icon: <AlertTriangle size={14} />,   label: "Objections",            color: "text-warning",     bg: "bg-warning/10" },
            buyerQuotes:          { icon: <Quote size={14} />,           label: "Buyer Quotes",          color: "text-primary",     bg: "bg-primary/10" },
            competitorMentions:   { icon: <Shield size={14} />,          label: "Competitor Mentions",   color: "text-accent",      bg: "bg-accent/10" },
            budgetSignals:        { icon: <DollarSign size={14} />,      label: "Budget Signals",        color: "text-accent",      bg: "bg-accent/10" },
            wins:                 { icon: <Trophy size={14} />,          label: "Wins",                  color: "text-accent",      bg: "bg-accent/10" },
            blockers:             { icon: <Construction size={14} />,    label: "Blockers",              color: "text-destructive", bg: "bg-destructive/10" },
            feedback:             { icon: <ThumbsUp size={14} />,        label: "Feedback",              color: "text-primary",     bg: "bg-primary/10" },
            careerGoals:          { icon: <Target size={14} />,          label: "Career Goals",          color: "text-primary",     bg: "bg-primary/10" },
            buyingSignals:        { icon: <Zap size={14} />,             label: "Buying Signals",        color: "text-accent",      bg: "bg-accent/10" },
            audienceReactions:    { icon: <Eye size={14} />,             label: "Audience Reactions",    color: "text-primary",     bg: "bg-primary/10" },
            featureInterest:      { icon: <Sparkles size={14} />,        label: "Feature Interest",      color: "text-primary",     bg: "bg-primary/10" },
            competitorComparisons:{ icon: <Shield size={14} />,          label: "Competitor Comparisons", color: "text-warning",    bg: "bg-warning/10" },
            ideasGenerated:       { icon: <LightbulbIcon size={14} />,   label: "Ideas Generated",       color: "text-primary",     bg: "bg-primary/10" },
            topIdeas:             { icon: <Trophy size={14} />,          label: "Top Ideas",             color: "text-accent",      bg: "bg-accent/10" },
            concerns:             { icon: <AlertTriangle size={14} />,   label: "Concerns",              color: "text-warning",     bg: "bg-warning/10" },
            experimentsToRun:     { icon: <Zap size={14} />,             label: "Experiments to Run",    color: "text-primary",     bg: "bg-primary/10" },
            sprintRisks:          { icon: <AlertTriangle size={14} />,   label: "Sprint Risks",          color: "text-destructive", bg: "bg-destructive/10" },
            themes:               { icon: <MessageSquare size={14} />,   label: "Themes",                color: "text-primary",     bg: "bg-primary/10" },
            strategicPriorities:  { icon: <Landmark size={14} />,        label: "Strategic Priorities",   color: "text-primary",     bg: "bg-primary/10" },
            riskItems:            { icon: <ShieldAlert size={14} />,     label: "Risk Items",             color: "text-destructive", bg: "bg-destructive/10" },
            committeeUpdates:     { icon: <Building2 size={14} />,       label: "Committee Updates",      color: "text-muted-foreground", bg: "bg-muted/30" },
            budgetItems:          { icon: <Wallet size={14} />,          label: "Budget Items",           color: "text-accent",      bg: "bg-accent/10" },
            governanceActions:    { icon: <Gavel size={14} />,           label: "Governance Actions",     color: "text-warning",     bg: "bg-warning/10" },
            commitments:          { icon: <CheckCircle2 size={14} />,    label: "Commitments",            color: "text-accent",      bg: "bg-accent/10" },
            requestsMade:         { icon: <ArrowRight size={14} />,      label: "Requests Made",          color: "text-primary",     bg: "bg-primary/10" },
            relationshipSignals:  { icon: <Users size={14} />,           label: "Relationship Signals",   color: "text-primary",     bg: "bg-primary/10" },
          };

          // Human label for a camelCase field key (custom template sections)
          const prettifyKey = (k: string) =>
            k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
          const stringLabels: Record<string, string> = {
            decisionProcess: "Decision Process",
            morale: "Morale",
            closePlan: "Close Plan",
            callPurpose: "Call Purpose",
            toneAssessment: "Tone",
            callbackNeeded: "Callback Needed",
          };

          return (
            <>
              {Object.entries(tf).map(([key, value]) => {
                if (!value) return null;
                const config = sectionConfig[key];

                // String-type fields (built-in or custom template text sections)
                if (typeof value === "string") {
                  const label = stringLabels[key] ?? prettifyKey(key);
                  return (
                    <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target size={14} className="text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{value}</p>
                    </motion.div>
                  );
                }

                // Array of strings (custom template sections get a generic style)
                if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
                  const cfg = config ?? { icon: <Sparkles size={14} />, label: prettifyKey(key), color: "text-primary", bg: "bg-primary/10" };
                  return (
                    <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={cfg.color}>{cfg.icon}</span>
                        <h3 className="text-sm font-semibold text-foreground">{cfg.label}</h3>
                        <span className={`text-[10px] font-bold ${cfg.color} ${cfg.bg} px-2 py-0.5 rounded-full ml-auto`}>{value.length}</span>
                      </div>
                      <div className="space-y-2">
                        {(value as string[]).map((item, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${cfg.bg.replace("/10", "")} mt-2 shrink-0`} />
                            <p className="text-sm text-foreground/80 leading-relaxed">{item}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                }

                // motionsAndVotes — special structured cards
                if (key === "motionsAndVotes" && Array.isArray(value) && value.length > 0) {
                  return (
                    <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Vote size={14} className="text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.motionsVotes")}</h3>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">{value.length}</span>
                      </div>
                      <div className="space-y-2.5">
                        {(value as any[]).map((v, i) => (
                          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30">
                            <div className={`mt-0.5 shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              v.outcome === "passed" ? "text-emerald-400 bg-emerald-400/10" :
                              v.outcome === "failed" ? "text-destructive bg-destructive/10" :
                              "text-muted-foreground bg-muted/50"
                            }`}>
                              {v.outcome?.toUpperCase() || "—"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground/90 leading-relaxed">{v.motion}</p>
                              {v.voteCount && <p className="text-[10px] text-muted-foreground mt-0.5">{v.voteCount}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                }

                // Array of objects (completedWork, plannedWork)
                if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
                  const label = key === "completedWork" ? t("noteDetail.completedWork") : key === "plannedWork" ? t("noteDetail.plannedWork") : config?.label || key;
                  const iconEl = key === "completedWork" ? <CheckCircle2 size={14} className="text-accent" /> :
                                 key === "plannedWork" ? <ArrowRight size={14} className="text-primary" /> :
                                 config ? <span className={config.color}>{config.icon}</span> : <Sparkles size={14} className="text-primary" />;
                  return (
                    <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4">
                      <div className="flex items-center gap-2 mb-3">
                        {iconEl}
                        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                      </div>
                      <div className="space-y-3">
                        {(value as any[]).map((entry, i) => (
                          <div key={i}>
                            {entry.person && <p className="text-xs font-semibold text-primary mb-1">{entry.person}</p>}
                            {entry.items && Array.isArray(entry.items) && (
                              <div className="space-y-1 pl-3 border-l-2 border-border">
                                {entry.items.map((item: string, j: number) => (
                                  <p key={j} className="text-sm text-foreground/80">{item}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                }

                return null;
              })}
            </>
          );
        })()}

        {/* AI-polished notes — the user's rough jottings expanded via the transcript */}
        {!editing && note.enhanced_notes && (
          <div className="card-elevated p-4 border border-primary/15">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={12} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.polishedNotes")}</h3>
            </div>
            <div className="space-y-0.5">{renderMarkdownLite(note.enhanced_notes)}</div>
          </div>
        )}

        {editing ? (
          <div className="card-elevated p-4 border border-primary/20">
            <h3 className="text-sm font-semibold text-foreground mb-2">{t("noteDetail.editNotes")}</h3>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full min-h-[160px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none leading-relaxed"
              placeholder={t("noteDetail.writeNotes")}
            />
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
              <button onClick={cancelEditing} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
                <X size={12} /> Cancel
              </button>
              <button onClick={saveEdit} disabled={savingEdit} className="flex items-center gap-1.5 text-xs font-semibold text-primary px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors">
                {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
              </button>
              {editBody.trim().length >= 20 && (
                <button onClick={saveAndReanalyze} disabled={savingEdit} className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary px-3 py-2 rounded-lg hover:opacity-90 transition-opacity ml-auto">
                  <Sparkles size={12} /> {t("noteDetail.saveReanalyze")}
                </button>
              )}
            </div>
          </div>
        ) : note.manual_notes ? (
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">{t("noteDetail.yourNotes")}</h3>
              <button onClick={startEditing} className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Pencil size={10} /> {t("noteDetail.edit")}
              </button>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{note.manual_notes}</p>
          </div>
        ) : !note.transcript && !editing ? (
          <button onClick={startEditing} className="w-full card-elevated p-4 text-left hover:border-primary/30 transition-colors">
            <p className="text-sm text-muted-foreground">{t("noteDetail.noNotes")}</p>
          </button>
        ) : null}

        {/* Transcript toggle */}
        {note.transcript && (
          <div>
            <button onClick={() => setShowTranscript(!showTranscript)} className="text-xs font-semibold text-primary">
              {showTranscript ? t("noteDetail.hideTranscript") : t("noteDetail.showTranscript")}
            </button>
            {showTranscript && (() => {
              // Extract unique speakers from transcript
              const speakerSet = new Set<string>();
              note.transcript!.split("\n").forEach(line => {
                const m = line.match(/^(Speaker [A-Z]):/);
                if (m) speakerSet.add(m[1]);
              });
              const speakers = Array.from(speakerSet);

              const speakerColors = [
                "text-primary", "text-accent", "text-[hsl(280,80%,65%)]",
                "text-[hsl(340,70%,60%)]", "text-[hsl(160,60%,50%)]", "text-[hsl(30,80%,55%)]"
              ];
              const speakerBgColors = [
                "bg-primary/10", "bg-accent/10", "bg-[hsl(280,80%,65%)]/10",
                "bg-[hsl(340,70%,60%)]/10", "bg-[hsl(160,60%,50%)]/10", "bg-[hsl(30,80%,55%)]/10"
              ];

              const filteredSpeakerContacts = speakerSearchQuery
                ? contacts.filter(c => c.name.toLowerCase().includes(speakerSearchQuery.toLowerCase())).slice(0, 5)
                : [];

              return (
                <div className="mt-2 space-y-3">
                  {/* Speaker Legend / Assignment */}
                  {speakers.length > 0 && (
                    <div className="card-elevated p-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("noteDetail.speakers")}</p>
                      <div className="space-y-2">
                        {speakers.map((spk, idx) => {
                          const colorIdx = spk.charCodeAt(spk.length - 1) - 65;
                          const color = speakerColors[colorIdx % speakerColors.length];
                          const bg = speakerBgColors[colorIdx % speakerBgColors.length];
                          const displayName = speakerNames[spk] || spk;
                          const isEditing = editingSpeaker === spk;

                          return (
                            <div key={spk}>
                              {isEditing ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center shrink-0`}>
                                      <span className={`text-[10px] font-bold ${color}`}>{spk.slice(-1)}</span>
                                    </div>
                                    <input
                                      autoFocus
                                      value={speakerDraft}
                                      onChange={(e) => { setSpeakerDraft(e.target.value); setSpeakerSearchQuery(e.target.value); }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && speakerDraft.trim()) {
                                          setSpeakerNames(prev => ({ ...prev, [spk]: speakerDraft.trim() }));
                                          setEditingSpeaker(null);
                                          setSpeakerSearchQuery("");
                                        }
                                        if (e.key === "Escape") { setEditingSpeaker(null); setSpeakerSearchQuery(""); }
                                      }}
                                      placeholder={t("noteDetail.typeName")}
                                      className="flex-1 text-sm bg-secondary/50 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
                                    />
                                    <button
                                      onClick={() => { setEditingSpeaker(null); setSpeakerSearchQuery(""); }}
                                      className="text-muted-foreground"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                  {filteredSpeakerContacts.length > 0 && (
                                    <div className="ml-8 space-y-0.5">
                                      {filteredSpeakerContacts.map(c => (
                                        <button
                                          key={c.id}
                                          onClick={() => {
                                            setSpeakerNames(prev => ({ ...prev, [spk]: c.name }));
                                            setEditingSpeaker(null);
                                            setSpeakerSearchQuery("");
                                            // Also link as participant
                                            if (user) {
                                              supabase.from("meeting_participants").upsert({
                                                meeting_note_id: id!,
                                                user_id: user.id,
                                                name: c.name,
                                                contact_id: c.id,
                                                speaker_label: spk,
                                              }, { onConflict: "meeting_note_id,speaker_label" }).then(() => {});
                                            }
                                            toast.success(`${spk} → ${c.name}`);
                                          }}
                                          className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary/80 text-left"
                                        >
                                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">{c.name.charAt(0)}</div>
                                          <span className="text-xs text-foreground">{c.name}</span>
                                          {c.company && <span className="text-[10px] text-muted-foreground">· {c.company}</span>}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingSpeaker(spk); setSpeakerDraft(speakerNames[spk] || ""); setSpeakerSearchQuery(""); }}
                                  className="flex items-center gap-2 w-full text-left group"
                                >
                                  <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center shrink-0`}>
                                    <span className={`text-[10px] font-bold ${color}`}>{spk.slice(-1)}</span>
                                  </div>
                                  <span className={`text-sm font-medium ${speakerNames[spk] ? "text-foreground" : "text-muted-foreground"}`}>
                                    {displayName}
                                  </span>
                                  <Pencil size={10} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors ml-auto" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transcript lines */}
                  <div className="card-elevated p-4 space-y-2">
                    {note.transcript!.split("\n").map((line, i) => {
                      const speakerMatch = line.match(/^(Speaker [A-Z]):\s*(.*)/);
                      if (speakerMatch) {
                        const speakerLabel = speakerMatch[1];
                        const speakerText = speakerMatch[2];
                        const colorIdx = speakerLabel.charCodeAt(speakerLabel.length - 1) - 65;
                        const color = speakerColors[colorIdx % speakerColors.length];
                        const displayName = speakerNames[speakerLabel] || speakerLabel;
                        return (
                          <p key={i} className="text-xs leading-relaxed">
                            <span className={`font-bold ${color}`}>{displayName}:</span>{" "}
                            <span className="text-foreground/70">{speakerText}</span>
                          </p>
                        );
                      }
                      if (!line.trim()) return null;
                      return <p key={i} className="text-xs text-foreground/60 leading-relaxed">{line}</p>;
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {note && <NoteShareSheet note={note} open={shareOpen} onClose={() => setShareOpen(false)} />}
      {id && <NoteParticipants noteId={id} open={participantsOpen} onClose={() => setParticipantsOpen(false)} />}
      {id && (
        <NoteContactLinker
          noteId={id}
          mentionedPeople={note.mentioned_people || []}
          open={contactLinkerOpen}
          onClose={() => setContactLinkerOpen(false)}
          onLinked={async (personName, contactId, contactName) => {
            // Update mentioned_people JSON with linked contact info
            const updatedPeople = (note.mentioned_people || []).map((p) =>
              p.name === personName
                ? { ...p, contactId, linkedContactName: contactName }
                : p
            );
            // If person wasn't in mentioned_people (linked via top search), add them
            if (!updatedPeople.some((p) => p.name === personName)) {
              updatedPeople.push({ name: contactName, role: undefined, context: undefined, contactId, linkedContactName: contactName } as any);
            }
            await persistNote({ mentioned_people: updatedPeople as any });
          }}
          onUnlinked={async (personName) => {
            const updatedPeople = (note.mentioned_people || []).map((p: any) =>
              p.name === personName
                ? { name: p.name, role: p.role, context: p.context }
                : p
            );
            await persistNote({ mentioned_people: updatedPeople as any });
          }}
        />
      )}
      {id && (
        <NoteEventLinker
          noteId={id}
          currentEventId={note.calendar_event_id}
          open={eventLinkerOpen}
          onClose={() => setEventLinkerOpen(false)}
          onLinked={(eventId) => persistNote({ calendar_event_id: eventId })}
        />
      )}
      {/* Per-note AI Chat */}
      {note && (note.transcript || note.manual_notes || note.summary) && (
        <NoteChat note={note} />
      )}
    </div>
  );
};

export default NoteDetail;
