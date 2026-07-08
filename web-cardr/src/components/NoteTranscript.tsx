import { useMemo, useState } from "react";
import { Search, X, Pencil, Check, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";

interface TranscriptContact {
  id: string;
  name: string;
  company?: string | null;
}

interface NoteTranscriptProps {
  transcript: string;
  /** Persisted speaker label → real name map */
  speakerNames: Record<string, string>;
  onRenameSpeaker: (label: string, name: string) => void;
  /** Persist an edited transcript (inline segment fixes) */
  onTranscriptChange: (transcript: string) => Promise<void> | void;
  /** When set, timestamps become tappable and jump into the audio */
  onSeek?: (seconds: number) => void;
  noteId: string;
  userId?: string | null;
  contacts: TranscriptContact[];
}

interface Segment {
  lineIdx: number;
  time: number | null;
  timeLabel: string | null;
  speaker: string | null;
  text: string;
}

// Matches "[00:14] Speaker 1: text", "Speaker 2: text", "[01:02] text"
const LINE_RE = /^\s*(?:\[(\d{1,3}):(\d{2})\]\s*)?(?:(Speaker\s+\S+)\s*:\s*)?(.*)$/;

const SPEAKER_COLORS = [
  { text: "text-primary", bg: "bg-primary/10", dot: "bg-primary" },
  { text: "text-accent", bg: "bg-accent/10", dot: "bg-accent" },
  { text: "text-[hsl(280,80%,65%)]", bg: "bg-[hsl(280,80%,65%)]/10", dot: "bg-[hsl(280,80%,65%)]" },
  { text: "text-[hsl(340,70%,60%)]", bg: "bg-[hsl(340,70%,60%)]/10", dot: "bg-[hsl(340,70%,60%)]" },
  { text: "text-[hsl(160,60%,50%)]", bg: "bg-[hsl(160,60%,50%)]/10", dot: "bg-[hsl(160,60%,50%)]" },
  { text: "text-[hsl(30,80%,55%)]", bg: "bg-[hsl(30,80%,55%)]/10", dot: "bg-[hsl(30,80%,55%)]" },
];

/** Highlight search matches inside a text run. */
const markMatches = (text: string, query: string) => {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let pos = 0;
  let idx = lower.indexOf(q, pos);
  let key = 0;
  while (idx !== -1) {
    if (idx > pos) parts.push(text.slice(pos, idx));
    parts.push(
      <mark key={key++} className="bg-warning/40 text-foreground rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    pos = idx + q.length;
    idx = lower.indexOf(q, pos);
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return parts;
};

/**
 * Otter/Granola-grade transcript view: speaker-coloured conversation turns,
 * tappable timestamps that seek the audio, in-transcript search, persisted
 * speaker renaming (with contact matching), and inline text correction.
 */
const NoteTranscript = ({
  transcript,
  speakerNames,
  onRenameSpeaker,
  onTranscriptChange,
  onSeek,
  noteId,
  userId,
  contacts,
}: NoteTranscriptProps) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const lines = useMemo(() => transcript.split("\n"), [transcript]);

  const segments = useMemo<Segment[]>(() => {
    return lines
      .map((line, lineIdx): Segment | null => {
        if (!line.trim()) return null;
        const m = line.match(LINE_RE);
        if (!m) return { lineIdx, time: null, timeLabel: null, speaker: null, text: line.trim() };
        const [, mm, ss, speaker, text] = m;
        const time = mm !== undefined ? parseInt(mm, 10) * 60 + parseInt(ss, 10) : null;
        return {
          lineIdx,
          time,
          timeLabel: time !== null ? `${mm}:${ss}` : null,
          speaker: speaker ?? null,
          text: (text ?? "").trim(),
        };
      })
      .filter((s): s is Segment => s !== null && s.text.length > 0);
  }, [lines]);

  // Stable colour per speaker, in order of first appearance
  const speakerOrder = useMemo(() => {
    const order: string[] = [];
    for (const s of segments) {
      if (s.speaker && !order.includes(s.speaker)) order.push(s.speaker);
    }
    return order;
  }, [segments]);

  const colorFor = (speaker: string) =>
    SPEAKER_COLORS[Math.max(0, speakerOrder.indexOf(speaker)) % SPEAKER_COLORS.length];

  const visibleSegments = useMemo(() => {
    if (!query.trim()) return segments;
    const q = query.trim().toLowerCase();
    return segments.filter(
      (s) =>
        s.text.toLowerCase().includes(q) ||
        (s.speaker && (speakerNames[s.speaker] || s.speaker).toLowerCase().includes(q))
    );
  }, [segments, query, speakerNames]);

  const filteredContacts = editingSpeaker && speakerDraft.trim()
    ? contacts.filter((c) => c.name.toLowerCase().includes(speakerDraft.trim().toLowerCase())).slice(0, 5)
    : [];

  const commitRename = (label: string, name: string) => {
    onRenameSpeaker(label, name);
    setEditingSpeaker(null);
    setSpeakerDraft("");
  };

  const linkSpeakerContact = (label: string, contact: TranscriptContact) => {
    commitRename(label, contact.name);
    if (userId) {
      supabase.from("meeting_participants").upsert(
        {
          meeting_note_id: noteId,
          user_id: userId,
          name: contact.name,
          contact_id: contact.id,
          speaker_label: label,
        },
        { onConflict: "meeting_note_id,speaker_label" }
      ).then(() => {});
    }
    toast.success(`${label} → ${contact.name}`);
  };

  const saveSegmentEdit = async (seg: Segment) => {
    const newText = editDraft.trim();
    setEditingIdx(null);
    if (!newText || newText === seg.text) return;
    const updated = [...lines];
    const prefix =
      (seg.timeLabel ? `[${seg.timeLabel}] ` : "") + (seg.speaker ? `${seg.speaker}: ` : "");
    updated[seg.lineIdx] = `${prefix}${newText}`;
    await onTranscriptChange(updated.join("\n"));
    toast.success(t("noteDetail.updated"));
  };

  return (
    <div className="mt-2 space-y-3">
      {/* Speaker legend / renaming */}
      {speakerOrder.length > 0 && (
        <div className="card-elevated p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            {t("noteDetail.speakers")}
          </p>
          <div className="space-y-2">
            {speakerOrder.map((spk) => {
              const c = colorFor(spk);
              const displayName = speakerNames[spk] || spk;
              const initial = (speakerNames[spk] || spk).replace(/^Speaker\s+/, "").charAt(0).toUpperCase();
              if (editingSpeaker === spk) {
                return (
                  <div key={spk} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center shrink-0`}>
                        <span className={`text-[10px] font-bold ${c.text}`}>{initial}</span>
                      </div>
                      <input
                        autoFocus
                        value={speakerDraft}
                        onChange={(e) => setSpeakerDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && speakerDraft.trim()) commitRename(spk, speakerDraft.trim());
                          if (e.key === "Escape") { setEditingSpeaker(null); setSpeakerDraft(""); }
                        }}
                        placeholder={t("noteDetail.typeName")}
                        className="flex-1 text-sm bg-secondary/50 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
                      />
                      {speakerDraft.trim() && (
                        <button onClick={() => commitRename(spk, speakerDraft.trim())} className="text-primary">
                          <Check size={14} />
                        </button>
                      )}
                      <button onClick={() => { setEditingSpeaker(null); setSpeakerDraft(""); }} className="text-muted-foreground">
                        <X size={14} />
                      </button>
                    </div>
                    {filteredContacts.length > 0 && (
                      <div className="ml-8 space-y-0.5">
                        {filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            onClick={() => linkSpeakerContact(spk, contact)}
                            className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary/80 text-left"
                          >
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                              {contact.name.charAt(0)}
                            </div>
                            <span className="text-xs text-foreground">{contact.name}</span>
                            {contact.company && <span className="text-[10px] text-muted-foreground">· {contact.company}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={spk}
                  onClick={() => { setEditingSpeaker(spk); setSpeakerDraft(speakerNames[spk] || ""); }}
                  className="flex items-center gap-2 w-full text-left group"
                >
                  <div className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-[10px] font-bold ${c.text}`}>{initial}</span>
                  </div>
                  <span className={`text-sm font-medium ${speakerNames[spk] ? "text-foreground" : "text-muted-foreground"}`}>
                    {displayName}
                  </span>
                  <Pencil size={10} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors ml-auto" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("noteDetail.searchTranscript")}
          className="w-full h-9 pl-8 pr-8 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <X size={13} />
          </button>
        )}
      </div>
      {query.trim() && (
        <p className="text-[10px] text-muted-foreground px-1 -mt-1">
          {visibleSegments.length > 0
            ? `${visibleSegments.length} ${t("noteDetail.matches")}`
            : t("noteDetail.noMatches")}
        </p>
      )}

      {/* Conversation turns */}
      <div className="card-elevated p-4 space-y-3">
        {visibleSegments.map((seg) => {
          const c = seg.speaker ? colorFor(seg.speaker) : SPEAKER_COLORS[0];
          const displayName = seg.speaker ? speakerNames[seg.speaker] || seg.speaker : null;
          const isEditing = editingIdx === seg.lineIdx;
          return (
            <div key={seg.lineIdx} className="group/turn">
              <div className="flex items-center gap-2 mb-0.5">
                {seg.speaker && (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
                    <span className={`text-[11px] font-bold ${c.text}`}>{displayName}</span>
                  </>
                )}
                {seg.timeLabel && (
                  onSeek && seg.time !== null ? (
                    <button
                      onClick={() => onSeek(seg.time!)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary bg-secondary/60 hover:bg-primary/10 rounded-full px-1.5 py-0.5 transition-colors tabular-nums"
                    >
                      <Play size={7} className="fill-current" />
                      {seg.timeLabel}
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">{seg.timeLabel}</span>
                  )
                )}
                {!isEditing && (
                  <button
                    onClick={() => { setEditingIdx(seg.lineIdx); setEditDraft(seg.text); }}
                    className="ml-auto opacity-0 group-hover/turn:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                  >
                    <Pencil size={10} />
                  </button>
                )}
              </div>
              {isEditing ? (
                <div>
                  <textarea
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={Math.min(6, Math.max(2, Math.ceil(editDraft.length / 60)))}
                    className="w-full bg-secondary/50 rounded-lg text-xs text-foreground p-2.5 resize-none outline-none focus:ring-1 focus:ring-primary/30 leading-relaxed"
                  />
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button onClick={() => setEditingIdx(null)} className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-md hover:bg-secondary">
                      <X size={11} />
                    </button>
                    <button onClick={() => saveSegmentEdit(seg)} className="text-[11px] font-semibold text-primary-foreground bg-primary px-2.5 py-1 rounded-md hover:opacity-90">
                      <Check size={11} />
                    </button>
                  </div>
                </div>
              ) : (
                <p className={`text-xs text-foreground/75 leading-relaxed ${seg.speaker ? "pl-3.5" : ""}`}>
                  {markMatches(seg.text, query.trim())}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NoteTranscript;
