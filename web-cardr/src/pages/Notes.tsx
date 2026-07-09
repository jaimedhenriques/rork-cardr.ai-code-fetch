import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Search, Mic, MessageSquare, ChevronRight, CheckCircle2, Loader2, Sparkles, Calendar, FolderOpen, Settings2, Play, Clock, BarChart3, Phone, Plus, Radio, SlidersHorizontal, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useRecording } from "@/context/RecordingContext";
import NotesChatSheet from "@/components/NotesChatSheet";
import NoteCreateSheet from "@/components/NoteCreateSheet";
import NotesDrawer from "@/components/NotesDrawer";
import NoteFilters, { NoteFilterState, defaultNoteFilters } from "@/components/NoteFilters";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import NotesExportMenu from "@/components/NotesExportMenu";
import SwipeToDelete from "@/components/SwipeToDelete";
import { format, isToday, isYesterday, isThisWeek, parseISO, isFuture, addHours, differenceInMinutes } from "date-fns";
import SegmentedControl from "@/components/ui/segmented-control";
import AnimatedList from "@/components/ui/animated-list";

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
  category: string | null;
  folder_id: string | null;
  created_at: string;
}

const GUEST_NOTES_KEY = "cardscanpro_guest_notes";

const loadGuestNotes = (): MeetingNote[] => {
  try {
    const raw: any[] = JSON.parse(localStorage.getItem(GUEST_NOTES_KEY) || "[]");
    return raw.map((n) => ({ category: null, folder_id: null, ...n }));
  } catch { return []; }
};

const Notes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { recording, isRecording } = useRecording();
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "calendar" | "action-items">("all");
  const [chatOpen, setChatOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<NoteFilterState>(defaultNoteFilters);
  const [noteTagMap, setNoteTagMap] = useState<Record<string, string[]>>({});
  const [tagsList, setTagsList] = useState<{ id: string; name: string; color: string }[]>([]);
  const [foldersList, setFoldersList] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    if (!user) {
      setNotes(loadGuestNotes());
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("meeting_notes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) {
      setNotes(data.map((d: any) => ({
        id: d.id,
        title: d.title,
        transcript: d.transcript,
        duration_seconds: d.duration_seconds ?? 0,
        summary: d.summary,
        key_topics: (d.key_topics as any[]) || [],
        action_items: (d.action_items as any[]) || [],
        follow_ups: (d.follow_ups as any[]) || [],
        decisions: (d.decisions as any[]) || [],
        insights: (d.insights as any[]) || [],
        mentioned_people: (d.mentioned_people as any[]) || [],
        open_questions: (d.open_questions as any[]) || [],
        manual_notes: d.manual_notes,
        category: d.category || null,
        folder_id: d.folder_id || null,
        created_at: d.created_at,
      })));
      // Load tag links + tags + folders in parallel
      const noteIds = data.map((d: any) => d.id);
      const [linksRes, tagsRes, foldersRes] = await Promise.all([
        noteIds.length
          ? supabase.from("note_tags").select("note_id, tag_id").in("note_id", noteIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("tags").select("*").eq("user_id", user.id),
        supabase.from("folders").select("*").eq("user_id", user.id),
      ]);
      const map: Record<string, string[]> = {};
      (linksRes.data || []).forEach((l: any) => {
        if (!map[l.note_id]) map[l.note_id] = [];
        map[l.note_id].push(l.tag_id);
      });
      setNoteTagMap(map);
      setTagsList((tagsRes.data || []).map((t: any) => ({ id: t.id, name: t.name, color: t.color })));
      setFoldersList((foldersRes.data || []).map((f: any) => ({ id: f.id, name: f.name, emoji: f.emoji })));
    }
    if (error) console.error(error);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Fetch upcoming calendar events
  useEffect(() => {
    if (!user) return;
    const now = new Date().toISOString();
    const next24h = addHours(new Date(), 24).toISOString();
    supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time, location, meeting_url")
      .eq("user_id", user.id)
      .gte("start_time", now)
      .lte("start_time", next24h)
      .order("start_time", { ascending: true })
      .limit(5)
      .then(({ data }) => {
        if (data) setUpcomingEvents(data);
      });
  }, [user]);

  const startRecordingFromEvent = (event: any) => {
    navigate("/notes/record", { state: { prefillTitle: event.title, calendarEventId: event.id } });
  };

  const handleDeleteNote = async (noteId: string) => {
    if (user) {
      await supabase.from("meeting_notes").delete().eq("id", noteId).eq("user_id", user.id);
    } else {
      const guestNotes = loadGuestNotes().filter(n => n.id !== noteId);
      localStorage.setItem(GUEST_NOTES_KEY, JSON.stringify(guestNotes));
    }
    setNotes(prev => prev.filter(n => n.id !== noteId));
    toast.success(t("notes.noteDeleted"));
  };

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => n.category && set.add(n.category));
    return Array.from(set).sort();
  }, [notes]);

  const { filteredNotes, searchMatches } = useMemo(() => {
    let list = notes;
    const matches: Record<string, { field: string; snippet: string }[]> = {};

    // Search across ALL extracted fields (Granola/Otter-class recall)
    if (search) {
      const q = search.toLowerCase();
      const mkSnippet = (text: string) => {
        const idx = text.toLowerCase().indexOf(q);
        if (idx < 0) return text.slice(0, 80);
        const start = Math.max(0, idx - 20);
        const end = Math.min(text.length, idx + q.length + 40);
        return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
      };
      list = list.filter((n) => {
        const hits: { field: string; snippet: string }[] = [];
        const test = (field: string, text?: string | null) => {
          if (text && text.toLowerCase().includes(q)) hits.push({ field, snippet: mkSnippet(text) });
        };
        test("Title", n.title);
        test("Summary", n.summary);
        test("Notes", n.manual_notes);
        test("Category", n.category);
        (n.key_topics || []).forEach((t) => test("Topic", t));
        (n.action_items || []).forEach((a) => test("Action", a.task));
        (n.follow_ups || []).forEach((f) => test("Follow-up", f.description));
        (n.decisions || []).forEach((d) => test("Decision", d));
        (n.insights || []).forEach((i) => test("Insight", i));
        (n.open_questions || []).forEach((o) => test("Question", o));
        (n.mentioned_people || []).forEach((p) => test("Person", `${p.name}${p.role ? ` (${p.role})` : ""}`));
        if (n.transcript && n.transcript.toLowerCase().includes(q)) hits.push({ field: "Transcript", snippet: mkSnippet(n.transcript) });
        if (hits.length) {
          matches[n.id] = hits.slice(0, 3);
          return true;
        }
        return false;
      });
    }
    // Tag filter (AND)
    if (filters.tagIds.length > 0) {
      list = list.filter(n => {
        const tids = noteTagMap[n.id] || [];
        return filters.tagIds.every(t => tids.includes(t));
      });
    }
    // Category filter (OR)
    if (filters.categories.length > 0) {
      list = list.filter(n => n.category && filters.categories.includes(n.category));
    }
    // Folder filter (OR)
    if (filters.folderIds.length > 0) {
      list = list.filter(n => n.folder_id && filters.folderIds.includes(n.folder_id));
    }
    // Has actions
    if (filters.hasActions) {
      list = list.filter(n => (n.action_items || []).some(a => !a.done));
    }
    // Sort
    const sorted = [...list];
    switch (filters.sortBy) {
      case "oldest": sorted.sort((a, b) => +parseISO(a.created_at) - +parseISO(b.created_at)); break;
      case "longest": sorted.sort((a, b) => b.duration_seconds - a.duration_seconds); break;
      case "shortest": sorted.sort((a, b) => a.duration_seconds - b.duration_seconds); break;
      default: sorted.sort((a, b) => +parseISO(b.created_at) - +parseISO(a.created_at));
    }
    return { filteredNotes: sorted, searchMatches: matches };
  }, [notes, search, filters, noteTagMap]);

  const activeFilterCount = filters.tagIds.length + filters.categories.length + filters.folderIds.length + (filters.hasActions ? 1 : 0) + (filters.sortBy !== "newest" ? 1 : 0);

  const allActionItems = notes.flatMap((n) =>
    (n.action_items || []).map((a) => ({ ...a, noteTitle: n.title, noteId: n.id, noteDate: n.created_at }))
  );

  const pendingActions = allActionItems.filter(a => !a.done);

  // Group notes by date
  const groups: { label: string; notes: MeetingNote[] }[] = [];
  const todayNotes = filteredNotes.filter((n) => isToday(parseISO(n.created_at)));
  const yesterdayNotes = filteredNotes.filter((n) => isYesterday(parseISO(n.created_at)));
  const weekNotes = filteredNotes.filter((n) => isThisWeek(parseISO(n.created_at)) && !isToday(parseISO(n.created_at)) && !isYesterday(parseISO(n.created_at)));
  const olderNotes = filteredNotes.filter((n) => !isThisWeek(parseISO(n.created_at)));

  if (todayNotes.length) groups.push({ label: "Today", notes: todayNotes });
  if (yesterdayNotes.length) groups.push({ label: "Yesterday", notes: yesterdayNotes });
  if (weekNotes.length) groups.push({ label: "This Week", notes: weekNotes });
  if (olderNotes.length) {
    const months: Record<string, MeetingNote[]> = {};
    olderNotes.forEach((n) => {
      const key = format(parseISO(n.created_at), "MMMM yyyy");
      if (!months[key]) months[key] = [];
      months[key].push(n);
    });
    Object.entries(months).forEach(([label, notes]) => groups.push({ label, notes }));
  }

  const formatDur = (s: number) => {
    if (!s) return "";
    const m = Math.floor(s / 60);
    return m > 0 ? `${m} min` : `${s}s`;
  };

  return (
    <div className="min-h-screen pb-40 px-5 pt-12">
      <PageHeader
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/analytics")}
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <BarChart3 size={15} className="text-muted-foreground" />
            </button>
            <NotesExportMenu notes={notes} folders={foldersList} tags={tagsList} noteTagMap={noteTagMap} />
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <Settings2 size={15} className="text-muted-foreground" />
            </button>
          </div>
        }
      />

      {/* Apple-style display header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <h1 className="text-title-1 text-foreground">{t("notes.myNotes")}</h1>
        {pendingActions.length > 0 && (
          <p className="text-footnote mt-1">
            <span className="tabular-nums font-semibold text-primary">{pendingActions.length}</span> {t("notes.pendingActions")}
          </p>
        )}
      </motion.div>

      {/* LIVE Recording Banner */}
      {isRecording && (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => navigate("/notes/record")}
          className="w-full mb-4 card-elevated border-destructive/40 ring-1 ring-destructive/20 p-3.5 flex items-center gap-3 text-left hover:shadow-md transition-shadow"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
              <Mic size={15} className="text-destructive" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 rounded px-1.5 py-0.5">{t("notes.live")}</span>
              <p className="text-sm font-semibold text-foreground truncate">{recording.noteTitle || t("notes.recordingInProgress")}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {recording.contactName ? `with ${recording.contactName} · ` : ""}{t("notes.tapToReturn")}
            </p>
          </div>
          <ChevronRight size={14} className="text-destructive/60 shrink-0" />
        </motion.button>
      )}

      {/* Coming Up section — only on Conversations tab */}
      {activeTab === "all" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.01 }} className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("notes.comingUp")}</p>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const start = parseISO(event.start_time);
                const minsUntil = differenceInMinutes(start, new Date());
                const isImminent = minsUntil <= 15 && minsUntil >= -5;
                return (
                  <div key={event.id} className={`card-elevated p-3.5 flex items-center gap-3 ${isImminent ? "border-primary/30 ring-1 ring-primary/10" : ""}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isImminent ? "bg-primary/15" : "bg-secondary"}`}>
                      <Calendar size={15} className={isImminent ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={10} className="text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground tabular-nums">{format(start, "h:mm a")}</span>
                        {isImminent && (
                          <span className="text-[11px] font-semibold text-primary ml-1 tabular-nums">
                            {minsUntil <= 0 ? t("notes.now") : `in ${minsUntil}m`}
                          </span>
                        )}
                        {event.location && <span className="text-[11px] text-muted-foreground truncate">· {event.location}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => startRecordingFromEvent(event)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors shrink-0 ${
                        isImminent
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "bg-secondary text-primary hover:bg-secondary/80"
                      }`}
                    >
                      <Play size={10} className={isImminent ? "fill-current" : ""} />
                      {t("notes.record")}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-elevated p-4 flex items-center gap-3">
              <Calendar size={16} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("notes.noUpcoming")}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Apple segmented control */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="mb-4">
        <SegmentedControl
          value={activeTab}
          onChange={(v) => setActiveTab(v)}
          options={[
            { value: "all", label: t("notes.conversations") },
            { value: "calendar", label: t("calendar.title") },
            { value: "action-items", label: t("notes.actionItems"), badge: pendingActions.length > 0 ? pendingActions.length : undefined },
          ]}
        />
      </motion.div>

      {/* Search + Filters */}
      {activeTab === "all" && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("notes.searchNotes")}
                className="w-full h-10 rounded-xl bg-card border border-border pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className={`relative h-10 px-3 rounded-xl border flex items-center gap-1.5 text-sm font-medium transition-colors ${
                activeFilterCount > 0 ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-secondary"
              }`}
            >
              <SlidersHorizontal size={14} />
              {activeFilterCount > 0 && <span className="text-xs font-bold">{activeFilterCount}</span>}
            </button>
          </motion.div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {filters.folderIds.map(fid => {
                const f = foldersList.find(x => x.id === fid);
                if (!f) return null;
                return (
                  <button key={`f-${fid}`} onClick={() => setFilters(p => ({ ...p, folderIds: p.folderIds.filter(x => x !== fid) }))} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                    {f.emoji} {f.name} <X size={9} />
                  </button>
                );
              })}
              {filters.categories.map(c => (
                <button key={`c-${c}`} onClick={() => setFilters(p => ({ ...p, categories: p.categories.filter(x => x !== c) }))} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-secondary text-foreground">
                  {c} <X size={9} />
                </button>
              ))}
              {filters.tagIds.map(tid => {
                const tg = tagsList.find(x => x.id === tid);
                if (!tg) return null;
                return (
                  <button key={`t-${tid}`} onClick={() => setFilters(p => ({ ...p, tagIds: p.tagIds.filter(x => x !== tid) }))} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${tg.color}22`, color: tg.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tg.color }} /> {tg.name} <X size={9} />
                  </button>
                );
              })}
              {filters.hasActions && (
                <button onClick={() => setFilters(p => ({ ...p, hasActions: false }))} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-secondary text-foreground">
                  Has actions <X size={9} />
                </button>
              )}
              <button onClick={() => setFilters(defaultNoteFilters)} className="text-[11px] text-muted-foreground hover:text-destructive ml-1">Clear</button>
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="text-primary animate-spin" />
        </div>
      ) : activeTab === "action-items" ? (
        /* ── Action Items Tab ── */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {allActionItems.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t("notes.noActionItems")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t("notes.recordToExtract")}</p>
            </div>
          ) : (
            allActionItems.map((item, i) => (
              <div key={i} className="card-elevated p-3.5 flex items-start gap-3">
                <div className={`w-5 h-5 rounded-md border-2 mt-0.5 shrink-0 ${item.done ? "bg-primary border-primary" : "border-primary/40"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.task}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {item.owner && <span className="text-[11px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">{item.owner}</span>}
                    {item.deadline && <span className="text-[11px] text-muted-foreground tabular-nums">by {item.deadline}</span>}
                    <span className="text-[11px] text-muted-foreground/50">from {item.noteTitle || "Meeting"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </motion.div>
      ) : activeTab === "calendar" ? (
        /* ── Calendar Tab — My Agenda ── */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-lg font-display font-bold text-foreground mb-1">{t("notes.myAgenda")}</h2>
          <p className="text-xs text-muted-foreground mb-4">{t("notes.today")}</p>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const start = parseISO(event.start_time);
                const end = event.end_time ? parseISO(event.end_time) : null;
                const minsUntil = differenceInMinutes(start, new Date());
                const isImminent = minsUntil <= 15 && minsUntil >= -60;
                return (
                  <div key={event.id} className={`card-elevated p-4 ${isImminent ? "border-primary/30 ring-1 ring-primary/10" : ""}`}>
                    <p className="text-sm font-semibold text-foreground">{event.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(start, "h:mm a")}{end ? ` - ${format(end, "h:mm a")}` : ""}
                    </p>
                    {event.location && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">{event.location}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {event.meeting_url && (
                        <a href={event.meeting_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary font-semibold bg-primary/10 rounded-full px-2.5 py-1">
                          Join Meeting
                        </a>
                      )}
                      <button
                        onClick={() => startRecordingFromEvent(event)}
                        className="flex items-center gap-1 text-[11px] text-primary font-semibold bg-primary/10 rounded-full px-2.5 py-1"
                      >
                        <Mic size={10} /> {t("notes.record")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <Calendar size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t("notes.noUpcomingMeetings")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t("notes.agendaHint")}</p>
            </div>
          )}
        </motion.div>
      ) : (
        /* ── Conversations Tab ── */
        <>
          {filteredNotes.length === 0 ? (
            <div className="text-center py-16">
              <FileText size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t("notes.noNotesYet")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t("notes.recordOrCreate")}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="section-label mb-2">{group.label}</p>
                  <AnimatedList
                    items={group.notes}
                    getKey={(n) => n.id}
                    className="space-y-2"
                    renderItem={(note) => (
                      <SwipeToDelete onDelete={() => handleDeleteNote(note.id)}>
                        <button
                          onClick={() => navigate(`/notes/${note.id}`)}
                          className="w-full card-interactive p-4 text-left"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              {note.transcript ? (
                                <Mic size={15} className="text-primary" />
                              ) : (
                                <FileText size={15} className="text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {!note.summary && (note.manual_notes || note.transcript) && (
                                  <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">Draft</span>
                                )}
                                <p className="text-headline text-foreground truncate">{note.title || t("notes.untitledMeeting")}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground tabular-nums">
                                <span>{format(parseISO(note.created_at), "h:mm a")}</span>
                                {note.duration_seconds > 0 && (
                                  <span>· {formatDur(note.duration_seconds)}</span>
                                )}
                                {(note.action_items?.length || 0) > 0 && (
                                  <span className="text-primary font-medium">· {note.action_items.length} actions</span>
                                )}
                                {(note.mentioned_people?.length || 0) > 0 && (
                                  <span>· {note.mentioned_people.length} attendee{note.mentioned_people.length !== 1 ? "s" : ""}</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                {note.folder_id && (() => {
                                  const f = foldersList.find(x => x.id === note.folder_id);
                                  return f ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary">{f.emoji} {f.name}</span> : null;
                                })()}
                                {note.category && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-secondary text-foreground">{note.category}</span>
                                )}
                                {(noteTagMap[note.id] || []).slice(0, 3).map(tid => {
                                  const tg = tagsList.find(x => x.id === tid);
                                  if (!tg) return null;
                                  return <span key={tid} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium" style={{ backgroundColor: `${tg.color}22`, color: tg.color }}><span className="w-1 h-1 rounded-full" style={{ backgroundColor: tg.color }} />{tg.name}</span>;
                                })}
                              </div>
                              {note.summary && !searchMatches[note.id] && (
                                <p className="text-[13px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{note.summary}</p>
                              )}
                              {searchMatches[note.id]?.length > 0 && (
                                <div className="mt-1.5 space-y-1">
                                  {searchMatches[note.id].map((m, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0 mt-0.5">{m.field}</span>
                                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{m.snippet}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <ChevronRight size={14} className="text-muted-foreground/40 shrink-0 mt-2" />
                          </div>
                        </button>
                      </SwipeToDelete>
                    )}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bottom Bar — simplified single New Note button */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-40">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/phone")}
            className="w-12 h-12 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <Phone size={18} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 h-12 rounded-full bg-card border border-border shadow-lg flex items-center gap-2.5 px-4 hover:bg-secondary transition-colors"
          >
            <MessageSquare size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("notes.askAnything")}</span>
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="h-12 px-5 rounded-full bg-primary shadow-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus size={18} className="text-primary-foreground" />
            <span className="text-sm font-semibold text-primary-foreground">{t("notes.newNote")}</span>
          </button>
        </div>
      </div>

      {/* Notes AI Chat */}
      <NotesChatSheet notes={notes} open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Create Note Sheet */}
      <NoteCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchNotes} />

      {/* Notes Settings Drawer */}
      <NotesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Filters Modal */}
      <AnimatePresence>
        {filtersOpen && (
          <NoteFilters
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            filters={filters}
            onApply={setFilters}
            availableCategories={availableCategories}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Notes;
