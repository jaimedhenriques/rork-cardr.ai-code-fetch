import { motion, AnimatePresence } from "framer-motion";
import { useApp, type Contact } from "@/context/AppContext";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus, Trash2, ChevronRight, UserCircle2, Mail, Phone, Calendar, Sparkles, Globe, Linkedin, MapPin, Building2, X, StickyNote, Wand2, Mic, FileText, Download, Zap, Loader2, SlidersHorizontal, Layers, ChevronDown, GitBranch, BarChart3, Settings2, Target, CheckSquare, Square, GripVertical, ScanLine } from "lucide-react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import LinkedInActions from "@/components/LinkedInActions";
import VoiceRecorder from "@/components/VoiceRecorder";
import SwipeToDelete from "@/components/SwipeToDelete";
import MeetingRecorder from "@/components/MeetingRecorder";
import AddContactModal from "@/components/AddContactModal";
import DuplicateDetector from "@/components/DuplicateDetector";
import ContactImportModal from "@/components/ContactImportModal";
import ContactFilters, { type FilterState, defaultFilters } from "@/components/ContactFilters";
import BulkActionsBar from "@/components/BulkActionsBar";
import PageHeader from "@/components/PageHeader";
import QuickEmailExportButton from "@/components/QuickEmailExportButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { getEngagementScore } from "@/lib/engagement";
import { isFeatureEnabled, notifyComingSoon } from "@/lib/featureFlags";
import { ComingSoonBadge } from "@/components/ComingSoonBadge";

type GroupBy = "none" | "company" | "event" | "tag" | "month" | "title_group" | "status";
type TabKey = "contacts" | "pipeline" | "activity";

const TITLE_GROUPS: Record<string, string[]> = {
  "C-Level": ["ceo", "cto", "cfo", "coo", "cmo", "cio", "chief"],
  "VP / Director": ["vp", "vice president", "director", "head of"],
  "Manager": ["manager", "lead", "supervisor", "team lead"],
  "Marketing": ["marketing", "growth", "brand", "content", "social media", "seo"],
  "Sales": ["sales", "account", "business development", "bdr", "sdr"],
  "Engineering": ["engineer", "developer", "architect", "devops", "sre", "software"],
  "Design": ["design", "ux", "ui", "creative", "art director"],
  "Other": [],
};

const getTitleGroup = (title: string): string => {
  const lower = (title || "").toLowerCase();
  for (const [group, keywords] of Object.entries(TITLE_GROUPS)) {
    if (group === "Other") continue;
    if (keywords.some((k) => lower.includes(k))) return group;
  }
  return "Other";
};

const GROUP_OPTIONS: { value: GroupBy; labelKey: string }[] = [
  { value: "none", labelKey: "contacts.noGrouping" },
  { value: "company", labelKey: "contacts.byCompany" },
  { value: "event", labelKey: "contacts.byEvent" },
  { value: "status", labelKey: "contacts.byStatus" },
  { value: "month", labelKey: "contacts.byMonth" },
  { value: "title_group", labelKey: "contacts.byRole" },
];

const TABS: { key: TabKey; labelKey: string; icon: any }[] = [
  { key: "contacts", labelKey: "contacts.title", icon: UserCircle2 },
  { key: "pipeline", labelKey: "contacts.pipeline", icon: GitBranch },
  { key: "activity", labelKey: "contacts.activity", icon: BarChart3 },
];

const Contacts = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { contacts, folders, addFolder, updateFolder, deleteContact, updateContact, loading: contactsLoading } = useApp();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(() => searchParams.get("folder"));
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [meetingContactId, setMeetingContactId] = useState<string | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [stages, setStages] = useState<{ id: string; name: string; color: string; sort_order: number }[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const stagePillRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [events, setEvents] = useState<{ id: string; title: string; status: string }[]>([]);
  const [eventContactMap, setEventContactMap] = useState<Record<string, Set<string>>>({});
  const [activeEventId, setActiveEventId] = useState<string | null>(() => searchParams.get("event"));

  // Read scan-session ids honoring the 24h max-age set by ScanBadge.
  const readSessionIds = (): string[] => {
    const MAX_AGE = 24 * 60 * 60 * 1000;
    try {
      const rawV2 = localStorage.getItem("cardscanpro_scan_session_v2");
      if (rawV2) {
        const parsed = JSON.parse(rawV2) as { ids?: string[]; lastUpdatedAt?: number };
        if (parsed.lastUpdatedAt && Date.now() - parsed.lastUpdatedAt > MAX_AGE) return [];
        return Array.isArray(parsed.ids) ? parsed.ids.filter((x): x is string => typeof x === "string") : [];
      }
      const rawLegacy = localStorage.getItem("cardscanpro_scan_session_ids");
      return rawLegacy ? (JSON.parse(rawLegacy) as string[]) : [];
    } catch { return []; }
  };

  const [sessionContactIds, setSessionContactIds] = useState<string[]>(() => readSessionIds());

  useEffect(() => {
    const refresh = () => setSessionContactIds(readSessionIds());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cardscanpro_scan_session_ids" || e.key === "cardscanpro_scan_session_v2") refresh();
    };
    const onFocus = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    // Re-check periodically so an open tab also drops expired sessions
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, []);

  const sessionContacts = useMemo(
    () => contacts.filter((c) => sessionContactIds.includes(c.id)),
    [contacts, sessionContactIds]
  );

  const activeTab = (searchParams.get("tab") as TabKey) || "contacts";
  const setActiveTab = (tab: TabKey) => {
    if (tab === "contacts") {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  // Load pipeline stages
  useEffect(() => {
    if (!user) return;
    supabase.from("pipeline_stages").select("id, name, color, sort_order").eq("user_id", user.id).order("sort_order").then(({ data }) => {
      if (data && data.length > 0) {
        setStages(data);
      } else if (data && data.length === 0) {
        // Create default stages
        const defaults = [
          { name: "New", color: "#6366f1", sort_order: 0 },
          { name: "Contacted", color: "#f59e0b", sort_order: 1 },
          { name: "Qualified", color: "#3b82f6", sort_order: 2 },
          { name: "Proposal", color: "#8b5cf6", sort_order: 3 },
          { name: "Negotiation", color: "#ec4899", sort_order: 4 },
          { name: "Won", color: "#10b981", sort_order: 5 },
          { name: "Lost", color: "#ef4444", sort_order: 6 },
        ];
        const inserts = defaults.map((s) => ({ ...s, user_id: user.id }));
        supabase.from("pipeline_stages").insert(inserts).select().then(({ data: created }) => {
          if (created) setStages(created);
        });
      }
    });
  }, [user]);

  // Load tags
  useEffect(() => {
    if (!user) return;
    supabase.from("tags").select("id, name, color").eq("user_id", user.id).then(({ data }) => {
      if (data) setTags(data);
    });
  }, [user]);

  // Load events + event-contact links for the event filter
  useEffect(() => {
    if (!user) return;
    supabase
      .from("events")
      .select("id, title, status, start_date")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false })
      .then(({ data }) => {
        if (data) setEvents(data.map((e: any) => ({ id: e.id, title: e.title, status: e.status })));
      });
    supabase
      .from("event_contacts")
      .select("event_id, contact_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, Set<string>> = {};
        for (const row of data as any[]) {
          if (!map[row.event_id]) map[row.event_id] = new Set();
          map[row.event_id].add(row.contact_id);
        }
        setEventContactMap(map);
      });
  }, [user, contacts.length]);

  const emojis = ["📌", "🎯", "🚀", "🌐", "🏢", "💼", "⚡", "🎪", "📊", "☕"];

  // Apply every filter EXCEPT the stage pill, so each pill can show
  // "how many contacts would I see if I picked this stage" given the
  // user's current search / folder / event / source / missing / enrichment
  // selections. This keeps the counts in sync with what the list will
  // actually render once the stage is chosen.
  const contactsBeforeStageFilter = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.title || "").toLowerCase().includes(q);
      const matchesFolder = !activeFolder || c.folderId === activeFolder;
      const matchesEvent =
        !activeEventId || (eventContactMap[activeEventId]?.has(c.id) ?? false);
      const matchesSource =
        filters.leadSource.length === 0 ||
        filters.leadSource.includes((c as any).leadSource || "manual");
      const matchesMissing =
        filters.missingInfo.length === 0 ||
        filters.missingInfo.every((m) => {
          if (m === "no_email") return !c.email;
          if (m === "no_phone") return !c.phone;
          if (m === "no_linkedin") return !c.linkedin;
          if (m === "no_company") return !c.company;
          return true;
        });
      const matchesEnrichment =
        filters.enrichmentStatus.length === 0 ||
        filters.enrichmentStatus.some((s) => {
          if (s === "enriched") return c.enriched;
          if (s === "not_enriched") return !c.enriched;
          return true;
        });
      return (
        matchesSearch &&
        matchesFolder &&
        matchesEvent &&
        matchesSource &&
        matchesMissing &&
        matchesEnrichment
      );
    });
  }, [contacts, search, activeFolder, activeEventId, eventContactMap, filters]);

  const filtered = contactsBeforeStageFilter
    .filter((c) => {
      const matchesStage =
        stageFilter === "all" ||
        (stageFilter === "unstaged" ? !c.stageId : c.stageId === stageFilter);
      return matchesStage;
    })
    .sort((a, b) => {
      if (filters.sortBy === "newest") return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime();
      if (filters.sortBy === "oldest") return new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime();
      if (filters.sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (filters.sortBy === "company") return (a.company || "").localeCompare(b.company || "");
      return 0;
    });

  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, Contact[]> = {};
    for (const c of filtered) {
      let key = t("contacts.other");
      switch (groupBy) {
        case "company": key = c.company || t("contacts.noCompany"); break;
        case "event": {
          const folder = folders.find((f) => f.id === c.folderId);
          key = folder ? `${folder.emoji} ${folder.name}` : t("contacts.noEvent");
          break;
        }
        case "status": {
          const stage = stages.find((s) => s.id === c.stageId);
          key = stage ? stage.name : t("contacts.unassigned");
          break;
        }
        case "month": {
          try { key = format(parseISO(c.scannedAt), "MMMM yyyy"); } catch { key = t("contacts.unknown"); }
          break;
        }
        case "title_group": key = getTitleGroup(c.title); break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [filtered, groupBy, folders, stages, t]);

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    // If an event is currently selected, link the new folder to it so
    // it joins that event's card holder automatically.
    const created = await addFolder({
      id: Date.now().toString(),
      name: newFolderName.trim(),
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      createdAt: new Date().toISOString(),
      eventId: activeEventId ?? undefined,
    });
    setNewFolderName("");
    setShowNewFolder(false);
    toast.success(t("misc.eventFolderCreated"));
    if (created && activeEventId && created.eventId !== activeEventId) {
      // addFolder may have returned an existing folder by name — make sure
      // it gets attached to the active event.
      await updateFolder(created.id, { eventId: activeEventId });
    }
  };

  // When an event is selected, only show folders linked to that event
  // (or unassigned ones) so the chip strip acts as the event's card holder.
  const visibleFolders = useMemo(() => {
    if (!activeEventId) return folders;
    return folders.filter((f) => !f.eventId || f.eventId === activeEventId);
  }, [folders, activeEventId]);

  const handleEnrich = async (contact: Contact) => {
    setEnriching(contact.id);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-contact", {
        body: { contact: { name: contact.name, company: contact.company, title: contact.title, email: contact.email } },
      });
      if (error) throw new Error(error.message);
      if (data?.enriched) {
        const updates: Partial<Contact> = { enriched: true, enrichedAt: new Date().toISOString() };
        if (data.enriched.linkedin) updates.linkedin = data.enriched.linkedin;
        if (data.enriched.website) updates.website = data.enriched.website;
        if (data.enriched.location) updates.location = data.enriched.location;
        if (data.enriched.industry) updates.industry = data.enriched.industry;
        if (data.enriched.companySize) updates.companySize = data.enriched.companySize;
        if (data.enriched.title && !contact.title) updates.title = data.enriched.title;
        if (data.enriched.email && !contact.email) updates.email = data.enriched.email;
        if (data.enriched.phone && !contact.phone) updates.phone = data.enriched.phone;
        if (data.enriched.avatar && !contact.avatar) updates.avatar = data.enriched.avatar;
        if (data.enriched.mobilePhone) updates.mobilePhone = data.enriched.mobilePhone;
        if (data.enriched.workPhone) updates.workPhone = data.enriched.workPhone;
        updateContact(contact.id, updates);
        setSelectedContact({ ...contact, ...updates });
        toast.success(`${contact.name} ${t("contacts.enrichedWith")}`);
      }
    } catch (err: any) {
      toast.error(err.message || t("contacts.failedEnrich"));
    } finally {
      setEnriching(null);
    }
  };

  const unenrichedCount = contacts.filter((c) => !c.enriched).length;

  const handleBulkEnrich = useCallback(async () => {
    const unenriched = contacts.filter((c) => !c.enriched);
    if (unenriched.length === 0) { toast.info(t("contacts.allEnriched")); return; }
    setBulkEnriching(true);
    setBulkProgress({ current: 0, total: unenriched.length });
    let enrichedCount = 0;
    let failed = 0;
    for (let i = 0; i < unenriched.length; i++) {
      const contact = unenriched[i];
      setBulkProgress({ current: i + 1, total: unenriched.length });
      try {
        const { data, error } = await supabase.functions.invoke("enrich-contact", {
          body: { contact: { name: contact.name, company: contact.company, title: contact.title, email: contact.email } },
        });
        if (error) throw new Error(error.message);
        if (data?.enriched) {
          const updates: Partial<Contact> = { enriched: true, enrichedAt: new Date().toISOString() };
          if (data.enriched.linkedin) updates.linkedin = data.enriched.linkedin;
          if (data.enriched.website) updates.website = data.enriched.website;
          if (data.enriched.location) updates.location = data.enriched.location;
          if (data.enriched.industry) updates.industry = data.enriched.industry;
          if (data.enriched.companySize) updates.companySize = data.enriched.companySize;
          if (data.enriched.title && !contact.title) updates.title = data.enriched.title;
          if (data.enriched.email && !contact.email) updates.email = data.enriched.email;
          if (data.enriched.phone && !contact.phone) updates.phone = data.enriched.phone;
          if (data.enriched.avatar && !contact.avatar) updates.avatar = data.enriched.avatar;
          if (data.enriched.mobilePhone) updates.mobilePhone = data.enriched.mobilePhone;
          if (data.enriched.workPhone) updates.workPhone = data.enriched.workPhone;
          updateContact(contact.id, updates);
          enrichedCount++;
        }
      } catch { failed++; }
      await new Promise((r) => setTimeout(r, 200));
    }
    setBulkEnriching(false);
    toast.success(`${t("contacts.enrichComplete")}: ${enrichedCount} enriched${failed > 0 ? `, ${failed} ${t("contacts.enrichFailed")}` : ""}`);
  }, [contacts, updateContact]);

  const handleVoiceNote = (contactId: string, transcript: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    const timestamp = new Date().toLocaleString();
    const newNote = `🎤 [${timestamp}]\n${transcript}`;
    const updated = contact.notes ? `${contact.notes}\n\n${newNote}` : newNote;
    updateContact(contactId, { notes: updated });
    setSelectedContact((prev) => prev ? { ...prev, notes: updated } : prev);
  };

  const handleMeetingTranscript = (transcript: string, summary: string) => {
    if (!meetingContactId) return;
    const contact = contacts.find((c) => c.id === meetingContactId);
    if (!contact) return;
    const timestamp = new Date().toLocaleString();
    const newNote = `📝 ${t("contacts.meetingLabel")} [${timestamp}]\n${summary}\n\n--- ${t("contacts.fullTranscript")} ---\n${transcript}`;
    const updated = contact.notes ? `${contact.notes}\n\n${newNote}` : newNote;
    updateContact(meetingContactId, { notes: updated });
    setSelectedContact((prev) => prev ? { ...prev, notes: updated } : prev);
    setMeetingContactId(null);
  };

  const toggleBulkSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => deleteContact(id));
    toast.success(`${selectedIds.size} ${t("contacts.contactsDeleted")}`);
    setSelectedIds(new Set());
    setBulkMode(false);
  };

  const handleBulkMoveStage = (stageId: string) => {
    selectedIds.forEach((id) => {
      updateContact(id, { stageId: stageId || undefined });
    });
    const stageName = stages.find((s) => s.id === stageId)?.name || "Unassigned";
    toast.success(`${selectedIds.size} ${t("contacts.movedTo")} ${stageName}`);
    setSelectedIds(new Set());
    setBulkMode(false);
  };

  const handleBulkTag = async (tagId: string) => {
    if (!user) return;
    const ids = Array.from(selectedIds);
    const inserts = ids.map((contactId) => ({ contact_id: contactId, tag_id: tagId }));
    await supabase.from("contact_tags").upsert(inserts, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    const tagName = tags.find((t) => t.id === tagId)?.name || "tag";
    toast.success(`${t("contacts.tagged")} ${ids.length} ${t("contacts.contactsWith")} "${tagName}"`);
    setSelectedIds(new Set());
    setBulkMode(false);
  };

  const cancelBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkExport = async () => {
    const selected = contacts.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;
    const headers = ["Name", "Email", "Phone", "Company", "Title", "LinkedIn", "Website", "Location", "Industry", "Notes"];
    const escCsv = (v: string) => {
      if (!v) return "";
      if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const rows = selected.map((c) => [
      c.name, c.email, c.phone, c.company, c.title,
      c.linkedin || "", (c as any).website || "", (c as any).location || "",
      (c as any).industry || "", c.notes || "",
    ].map(escCsv).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;

    const { shareFile } = await import("@/lib/native");
    const channel = await shareFile({
      filename,
      mimeType: "text/csv",
      data: csv,
      title: "Contacts export",
      text: `${selected.length} contact${selected.length === 1 ? "" : "s"} exported from Nexus`,
    });

    const verb = channel === "download" ? "Downloaded" : "Shared";
    toast.success(`${verb} ${selected.length} contact${selected.length === 1 ? "" : "s"} as CSV`);
    setSelectedIds(new Set());
    setBulkMode(false);
  };


  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  // Pipeline handlers
  const moveContact = async (contactId: string, stageId: string | null, opts?: { silent?: boolean }) => {
    const contact = contacts.find((c) => c.id === contactId);
    const previousStageId: string | null =
      ((contact as any)?.stageId || (contact as any)?.stage_id || null) ?? null;
    updateContact(contactId, { stageId: stageId || undefined } as any);
    if (user) {
      await supabase.from("contacts").update({ stage_id: stageId }).eq("id", contactId).eq("user_id", user.id);
      if (stageId) {
        const stage = stages.find((s) => s.id === stageId);
        if (stage && contact) {
          await supabase.from("contact_activities").insert({
            user_id: user.id, contact_id: contactId, type: "stage_change",
            title: `Moved to ${stage.name}`, description: `${contact.name} moved to ${stage.name} stage`,
          });
        }
      }
    }
    if (!opts?.silent) {
      const targetName = stageId
        ? stages.find((s) => s.id === stageId)?.name ?? ""
        : t("pipeline.unassigned");
      toast.success(`${contact?.name ?? t("misc.contactMoved")} → ${targetName}`, {
        action: previousStageId !== stageId ? {
          label: t("action.undo"),
          onClick: () => { moveContact(contactId, previousStageId, { silent: true }); },
        } : undefined,
      });
    }
  };

  const getContactsForStage = (stageId: string | null) => {
    if (stageId === null) return contacts.filter((c) => !(c as any).stageId && !(c as any).stage_id);
    return contacts.filter((c) => (c as any).stageId === stageId || (c as any).stage_id === stageId);
  };

  // Filter-aware count for the stage pill row only. Reflects the active
  // search and side filters so each pill shows the result the user would
  // actually get if they picked it. PipelineView keeps using the unfiltered
  // counter above because it represents the full pipeline, not a query.
  const countContactsForStageFiltered = (stageId: string | null) => {
    if (stageId === null) {
      return contactsBeforeStageFilter.filter(
        (c) => !(c as any).stageId && !(c as any).stage_id,
      ).length;
    }
    return contactsBeforeStageFilter.filter(
      (c) => (c as any).stageId === stageId || (c as any).stage_id === stageId,
    ).length;
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-secondary/50 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={14} />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Contacts Tab */}
      {activeTab === "contacts" && (
        <>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-display font-bold text-foreground">{t("contacts.title")}</h1>
              <div className="flex items-center gap-2">
                {bulkMode ? (
                  <>
                    <button onClick={selectAll} className="text-xs font-semibold text-primary">{t("contacts.selectAll")}</button>
                    <button onClick={cancelBulkMode} className="text-xs font-semibold text-muted-foreground">{t("action.cancel")}</button>
                  </>
                ) : (
                  <>
                    {contacts.length > 0 && (
                      <button
                        onClick={() => setBulkMode(true)}
                        className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <CheckSquare size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => setShowFilters(true)}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
                        JSON.stringify(filters) !== JSON.stringify(defaultFilters)
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-card border-border/60 text-muted-foreground"
                      }`}
                    >
                      <SlidersHorizontal size={14} />
                    </button>
                    <span className="badge-pill bg-primary-light text-primary">{contacts.length}</span>
                  </>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search size={15} className="text-muted-foreground/50" />
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("contacts.searchPlaceholder")} className="input-field h-12 !pl-11 pr-4" />
            </div>
            {/* Loading skeleton — shown while contacts are still being fetched
                so the stage row doesn't pop in / re-flow once data arrives. */}
            {contactsLoading && (
              <div
                className="mt-3 flex items-center gap-2"
                role="status"
                aria-live="polite"
                aria-label={t("contacts.loadingStages") || "Loading stage filters"}
              >
                <Target size={13} className="text-muted-foreground/40 shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-max">
                    {[64, 88, 72, 80, 68].map((w, i) => (
                      <div
                        key={i}
                        className="h-7 rounded-full bg-muted/60 animate-pulse"
                        style={{ width: `${w}px` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Empty hint — contacts loaded but the user has none yet, so
                every stage count would be 0. Skip the pills entirely and
                point the user toward adding their first contact. */}
            {!contactsLoading && stages.length > 0 && contacts.length === 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Target size={13} className="text-muted-foreground/70 shrink-0" />
                <span>
                  {t("contacts.stageFilterEmpty") ||
                    "No contacts yet — stage filters will appear once you add your first contact."}
                </span>
              </div>
            )}

            {!contactsLoading && stages.length > 0 && contacts.length > 0 && (() => {
              // Roving-tabindex keyboard nav for the stage filter pills.
              // Order matches visual order: All → Unstaged → custom stages.
              const stageOrder: string[] = ["all", "unstaged", ...stages.map((s) => s.id)];
              const activeIdx = Math.max(0, stageOrder.indexOf(stageFilter));
              const focusPill = (idx: number) => {
                const el = stagePillRefs.current[idx];
                if (el) {
                  el.focus();
                  // Keep the focused pill in view inside the horizontal scroller.
                  el.scrollIntoView({ block: "nearest", inline: "nearest" });
                }
              };
              const onPillKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
                const last = stageOrder.length - 1;
                let next = idx;
                switch (e.key) {
                  case "ArrowRight":
                  case "ArrowDown":
                    next = idx === last ? 0 : idx + 1;
                    break;
                  case "ArrowLeft":
                  case "ArrowUp":
                    next = idx === 0 ? last : idx - 1;
                    break;
                  case "Home":
                    next = 0;
                    break;
                  case "End":
                    next = last;
                    break;
                  case "Enter":
                  case " ":
                    e.preventDefault();
                    setStageFilter(stageOrder[idx]);
                    return;
                  default:
                    return;
                }
                e.preventDefault();
                setStageFilter(stageOrder[next]);
                focusPill(next);
              };
              const pillTabIndex = (idx: number) => (idx === activeIdx ? 0 : -1);
              // Shared focus-ring classes: a high-contrast 2px primary ring with
              // an offset against the surface, visible against both light and
              // dark themes. Applied to every pill so keyboard users get a
              // consistent, obvious focus indicator.
              const pillFocusRing =
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
              // Build a screen-reader-friendly label that includes the stage
              // name, contact count, and current selection state. Pluralisation
              // falls back to a sensible English default if no i18n string is
              // registered.
              const pillAriaLabel = (name: string, count: number, selected: boolean) => {
                const noun =
                  count === 1
                    ? t("contacts.contactSingular") || "contact"
                    : t("contacts.contactPlural") || "contacts";
                const state = selected
                  ? t("contacts.selected") || "selected"
                  : t("contacts.notSelected") || "not selected";
                return `${name}, ${count} ${noun}, ${state}`;
              };

              return (
              <div
                className="mt-3 flex items-center gap-2"
                role="tablist"
                aria-label={t("contacts.filterByStage") || "Filter by stage"}
              >
                <Target size={13} className="text-muted-foreground/70 shrink-0" />
                <div className="flex-1 overflow-x-auto scrollbar-hide">
                  <div className="flex items-center gap-1.5 min-w-max">
                    {/* All stages — primary "everything" pill, count matches the
                        active search/filter set so the number stays meaningful. */}
                    <button
                      ref={(el) => { stagePillRefs.current[0] = el; }}
                      role="tab"
                      aria-selected={stageFilter === "all"}
                      aria-label={pillAriaLabel(
                        t("contacts.allStages") || "All stages",
                        contactsBeforeStageFilter.length,
                        stageFilter === "all",
                      )}
                      tabIndex={pillTabIndex(0)}
                      onKeyDown={(e) => onPillKeyDown(e, 0)}
                      onClick={() => setStageFilter("all")}
                      className={`h-7 pl-2.5 pr-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex items-center gap-1.5 ${pillFocusRing} ${
                        stageFilter === "all"
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                      }`}
                    >
                      <Layers size={12} className="opacity-80" aria-hidden="true" />
                      <span>{t("contacts.allStages") || "All"}</span>
                      <span
                        aria-hidden="true"
                        className={`ml-0.5 px-1.5 h-5 min-w-[20px] inline-flex items-center justify-center rounded-full text-[10px] font-semibold ${
                          stageFilter === "all"
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {contactsBeforeStageFilter.length}
                      </span>
                    </button>

                    {/* Subtle divider so "Unstaged" reads as its own bucket
                        rather than another stage option. */}
                    <div className="h-5 w-px bg-border/70 mx-0.5" aria-hidden="true" />

                    {/* Unstaged — dashed outline keeps the "no stage assigned"
                        meaning visible at a glance, with a live count. */}
                    {(() => {
                      const unstagedCount = countContactsForStageFiltered(null);
                      const active = stageFilter === "unstaged";
                      return (
                        <button
                          ref={(el) => { stagePillRefs.current[1] = el; }}
                          role="tab"
                          aria-selected={active}
                          aria-label={pillAriaLabel(
                            t("contacts.unstaged") || "Unstaged",
                            unstagedCount,
                            active,
                          )}
                          tabIndex={pillTabIndex(1)}
                          onKeyDown={(e) => onPillKeyDown(e, 1)}
                          onClick={() => setStageFilter("unstaged")}
                          className={`h-7 pl-2.5 pr-1.5 rounded-full text-xs font-medium border border-dashed transition-all whitespace-nowrap flex items-center gap-1.5 ${pillFocusRing} ${
                            active
                              ? "bg-muted text-foreground border-foreground/50 shadow-sm"
                              : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
                          }`}
                          title={t("contacts.unstaged") || "Unstaged"}
                        >
                          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full border border-dashed border-current" />
                          <span>{t("contacts.unstaged") || "Unstaged"}</span>
                          <span
                            aria-hidden="true"
                            className={`ml-0.5 px-1.5 h-5 min-w-[20px] inline-flex items-center justify-center rounded-full text-[10px] font-semibold ${
                              active ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {unstagedCount}
                          </span>
                        </button>
                      );
                    })()}

                    {stages.map((s, i) => {
                      const idx = i + 2; // offset for All + Unstaged
                      const active = stageFilter === s.id;
                      const count = countContactsForStageFiltered(s.id);
                      // Empty stages stay clickable (so users can confirm "yes,
                      // really nothing here") but render dimmed to telegraph
                      // that picking them yields an empty result.
                      const isEmpty = count === 0;
                      return (
                        <button
                          key={s.id}
                          ref={(el) => { stagePillRefs.current[idx] = el; }}
                          role="tab"
                          aria-selected={active}
                          aria-disabled={isEmpty || undefined}
                          aria-label={pillAriaLabel(s.name, count, active)}
                          title={isEmpty ? (t("contacts.stageEmpty") || `${s.name} — no contacts`) : s.name}
                          tabIndex={pillTabIndex(idx)}
                          onKeyDown={(e) => onPillKeyDown(e, idx)}
                          onClick={() => setStageFilter(s.id)}
                          className={`h-7 pl-2.5 pr-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex items-center gap-1.5 ${pillFocusRing} ${
                            active ? "text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          } ${isEmpty && !active ? "opacity-50" : ""}`}
                          style={{
                            backgroundColor: active ? `${s.color}25` : "transparent",
                            borderColor: active ? s.color : "hsl(var(--border))",
                          }}
                        >
                          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                          <span>{s.name}</span>
                          <span
                            aria-hidden="true"
                            className="ml-0.5 px-1.5 h-5 min-w-[20px] inline-flex items-center justify-center rounded-full text-[10px] font-semibold"
                            style={{
                              backgroundColor: active ? `${s.color}33` : "hsl(var(--muted))",
                              color: active ? s.color : "hsl(var(--muted-foreground))",
                            }}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Selection summary — reflects the active stage pill plus the
                live visible count (which already accounts for the search box
                and other filters above). Helps users confirm what they're
                looking at without counting rows. */}
            {!contactsLoading && stages.length > 0 && contacts.length > 0 && (() => {
              const activeStage =
                stageFilter === "all"
                  ? t("contacts.allStages") || "All stages"
                  : stageFilter === "unstaged"
                  ? t("contacts.unstaged") || "Unstaged"
                  : stages.find((s) => s.id === stageFilter)?.name ||
                    t("contacts.allStages") ||
                    "All stages";
              const visible = filtered.length;
              return (
                <p
                  className="mt-2 text-[11px] text-muted-foreground"
                  aria-live="polite"
                >
                  <span className="font-medium text-foreground">{activeStage}</span>
                  <span className="mx-1.5 opacity-50">·</span>
                  {visible === 1
                    ? t("contacts.oneVisible") || "1 contact visible"
                    : (t("contacts.nVisible") || "{n} contacts visible").replace(
                        "{n}",
                        String(visible),
                      )}
                </p>
              );
            })()}
          </motion.div>

          {/* Events */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="mb-5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="section-label">{t("contacts.events")}</p>
              <button onClick={() => setShowNewFolder(!showNewFolder)} className="text-primary text-xs font-semibold flex items-center gap-1">
                <Plus size={12} /> {t("contacts.newFolder")}
              </button>
            </div>
            {showNewFolder && (
              <div className="flex items-center gap-2 mb-2.5">
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
                  placeholder={t("contacts.folderName")}
                  className="input-field flex-1 text-sm"
                  autoFocus
                />
                <button onClick={handleAddFolder} className="btn-primary px-3 py-2 text-xs">{t("action.add")}</button>
                <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="text-muted-foreground p-2"><X size={14} /></button>
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button onClick={() => setActiveFolder(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!activeFolder ? "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >{t("action.all")}</button>
              {visibleFolders.map((folder) => (
                <button key={folder.id} onClick={() => setActiveFolder(activeFolder === folder.id ? null : folder.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${activeFolder === folder.id ? "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  <span>{folder.emoji} {folder.name}</span>
                  {folder.eventId && <span className="text-[10px] opacity-70">📅</span>}
                </button>
              ))}
            </div>
            {events.length > 0 && (
              <div className="mt-3">
                <p className="section-label mb-2 flex items-center gap-1.5">
                  <Calendar size={12} className="text-muted-foreground/70" />
                  {t("contacts.byEvent") || "Filter by event"}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setActiveEventId(null)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!activeEventId ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    {t("action.all")}
                  </button>
                  {events.map((ev) => {
                    const count = eventContactMap[ev.id]?.size ?? 0;
                    const active = activeEventId === ev.id;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setActiveEventId(active ? null : ev.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                      >
                        <span className="truncate max-w-[140px]">{ev.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-primary-foreground/20" : "bg-background/60"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-foreground hover:bg-muted transition-colors">
                <Download size={12} /> {t("action.import")}
              </button>
              <QuickEmailExportButton
                filteredContacts={filtered}
                filterDescription={
                  activeEventId
                    ? `Event: ${events.find((e) => e.id === activeEventId)?.title ?? "selected"}`
                    : activeFolder
                    ? `Folder: ${folders.find((f) => f.id === activeFolder)?.name ?? "filtered"}`
                    : search
                    ? `Search "${search}"`
                    : `${filtered.length} filtered contacts`
                }
              />
              {sessionContacts.length > 0 && (
                <QuickEmailExportButton
                  filteredContacts={sessionContacts}
                  filterDescription={`Current scan session — ${sessionContacts.length} contact${sessionContacts.length === 1 ? "" : "s"}`}
                  label={`Export session (${sessionContacts.length})`}
                  className="bg-primary/10 text-primary hover:bg-primary/20"
                />
              )}
              {unenrichedCount > 0 && (
                <button onClick={handleBulkEnrich} disabled={bulkEnriching} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                  {bulkEnriching ? (<><Loader2 size={12} className="animate-spin" />{bulkProgress.current}/{bulkProgress.total}</>) : (<><Zap size={12} /> {t("contacts.enrichAll")} ({unenrichedCount})</>)}
                </button>
              )}
            </div>
            {bulkEnriching && (
              <div className="mt-2 w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] rounded-full" initial={{ width: 0 }} animate={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} transition={{ duration: 0.3 }} />
              </div>
            )}
          </motion.div>

          {/* Group By */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mb-4">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <Layers size={13} className="text-muted-foreground shrink-0" />
              {GROUP_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setGroupBy(opt.value)} className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${groupBy === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </motion.div>

          <DuplicateDetector />

          {/* List */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
            {grouped ? (
              <div className="space-y-4">
                {Object.entries(grouped).map(([groupName, groupContacts]) => (
                  <div key={groupName}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{groupName}</h3>
                      <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{groupContacts.length}</span>
                    </div>
                    <div className="space-y-2">
                      {groupContacts.map((contact) => (
                        <ContactRow key={contact.id} contact={contact} selectedContact={selectedContact} setSelectedContact={setSelectedContact} enriching={enriching} handleEnrich={handleEnrich} handleVoiceNote={handleVoiceNote} setMeetingContactId={setMeetingContactId} updateContact={updateContact} deleteContact={deleteContact} navigate={navigate} stages={stages} bulkMode={bulkMode} isChecked={selectedIds.has(contact.id)} onToggleCheck={toggleBulkSelect} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((contact) => (
                  <ContactRow key={contact.id} contact={contact} selectedContact={selectedContact} setSelectedContact={setSelectedContact} enriching={enriching} handleEnrich={handleEnrich} handleVoiceNote={handleVoiceNote} setMeetingContactId={setMeetingContactId} updateContact={updateContact} deleteContact={deleteContact} navigate={navigate} stages={stages} bulkMode={bulkMode} isChecked={selectedIds.has(contact.id)} onToggleCheck={toggleBulkSelect} />
                ))}
              </div>
            )}
            {filtered.length === 0 && (
              <div className="text-center py-16 px-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-4">
                  <UserCircle2 size={28} className="text-primary/60" strokeWidth={1.5} />
                </div>
                <p className="text-base font-semibold text-foreground mb-1.5">{t("contacts.noContactsFound")}</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mx-auto mb-5">{t("contacts.scanToAdd")}</p>
                <button
                  onClick={() => navigate("/scan")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold active:scale-[0.98] transition-transform"
                >
                  <Plus size={14} /> {t("contacts.addFirst") || "Scan your first card"}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Pipeline Tab */}
      {activeTab === "pipeline" && (
        <PipelineView stages={stages} setStages={setStages} contacts={contacts} moveContact={moveContact} getContactsForStage={getContactsForStage} user={user} />
      )}

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <ActivityView user={user} contacts={contacts} stages={stages} />
      )}

      <MeetingRecorder open={!!meetingContactId} onClose={() => setMeetingContactId(null)} onTranscript={handleMeetingTranscript} />
      <AddContactModal open={showAddContact} onClose={() => setShowAddContact(false)} />
      <ContactImportModal open={showImport} onClose={() => setShowImport(false)} />

      {activeTab === "contacts" && !bulkMode && (
        <button onClick={() => setShowAddContact(true)} className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40">
          <Plus size={24} />
        </button>
      )}

      <AnimatePresence>
        {bulkMode && (
          <BulkActionsBar
            selectedCount={selectedIds.size}
            onDelete={handleBulkDelete}
            onMoveStage={handleBulkMoveStage}
            onTag={handleBulkTag}
            onExport={handleBulkExport}
            onCancel={cancelBulkMode}
            stages={stages}
            tags={tags}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        <ContactFilters open={showFilters} onClose={() => setShowFilters(false)} filters={filters} onApply={setFilters} />
      </AnimatePresence>
    </div>
  );
};

// Pipeline View (extracted from Pipeline page)
const PipelineView = ({ stages, setStages, contacts, moveContact, getContactsForStage, user }: any) => {
  const { t } = useLanguage();
  const [showSettings, setShowSettings] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const STAGE_COLORS = ["#6366f1", "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

  const addStage = async () => {
    if (!newStageName.trim() || !user) return;
    const { data } = await supabase.from("pipeline_stages").insert({
      user_id: user.id, name: newStageName.trim(), color: newStageColor, sort_order: stages.length,
    }).select().single();
    if (data) { setStages((prev: any) => [...prev, data]); setNewStageName(""); toast.success(t("pipeline.stageAdded")); }
  };

  const deleteStage = async (id: string) => {
    if (!user) return;
    await supabase.from("pipeline_stages").delete().eq("id", id).eq("user_id", user.id);
    setStages((prev: any) => prev.filter((s: any) => s.id !== id));
    toast.success(t("pipeline.stageRemoved"));
  };

  const reorderStages = async (newOrder: any[]) => {
    if (!user) return;
    setStages(newOrder);
    const updates = newOrder.map((s, idx) =>
      supabase.from("pipeline_stages").update({ sort_order: idx }).eq("id", s.id).eq("user_id", user.id)
    );
    await Promise.all(updates);
  };

  if (!user) return <div className="text-center py-16"><p className="text-sm text-muted-foreground">{t("contacts.signInPipeline")}</p></div>;

  const unstaged = getContactsForStage(null);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">{t("pipeline.title")}</h2>
          <p className="text-xs text-muted-foreground">{contacts.length} {t("pipeline.leads")} {stages.length} {t("pipeline.stages")}</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center">
          <Settings2 size={16} className="text-muted-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="card-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{t("pipeline.manageStages")}</h3>
                {stages.length > 1 && (
                  <span className="text-[10px] text-muted-foreground">{t("pipeline.dragToReorder")}</span>
                )}
              </div>
              <SortableStagesList
                stages={stages}
                getCount={(id: string) => getContactsForStage(id).length}
                onReorder={reorderStages}
                onDelete={deleteStage}
              />
              <div className="flex gap-1 pt-2 border-t border-border/60">
                {STAGE_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewStageColor(c)} className={`w-5 h-5 rounded-full border-2 ${newStageColor === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStage()} placeholder={t("pipeline.newStageName")} className="input-field flex-1" />
                <button onClick={addStage} className="btn-primary px-3 py-2 text-xs rounded-xl">{t("action.add")}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PipelineDndBoard
        stages={stages}
        unstaged={unstaged}
        getContactsForStage={getContactsForStage}
        moveContact={moveContact}
        expandedStage={expandedStage}
        setExpandedStage={setExpandedStage}
      />
    </motion.div>
  );
};

// Drag-and-drop board
const PipelineDndBoard = ({ stages, unstaged, getContactsForStage, moveContact, expandedStage, setExpandedStage }: any) => {
  const { t } = useLanguage();
  const [activeContact, setActiveContact] = useState<any>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const allContacts = [...unstaged, ...stages.flatMap((s: any) => getContactsForStage(s.id))];

  const onDragStart = (e: DragStartEvent) => {
    const c = allContacts.find((x: any) => x.id === e.active.id);
    setActiveContact(c || null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveContact(null);
    if (!e.over) return;
    const contactId = String(e.active.id);
    const overId = String(e.over.id);
    const targetStageId = overId === "stage-unstaged" ? null : overId.replace("stage-", "");
    const contact = allContacts.find((c: any) => c.id === contactId);
    const currentStageId = contact?.stageId || contact?.stage_id || null;
    if (currentStageId === targetStageId) return;
    moveContact(contactId, targetStageId);
    // Auto-expand target stage
    setExpandedStage(targetStageId === null ? "unstaged" : targetStageId);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-3">
        {unstaged.length > 0 && (
          <DroppableStage
            id="stage-unstaged"
            color="hsl(var(--muted))"
            name={t("pipeline.unassigned")}
            count={unstaged.length}
            expanded={expandedStage === "unstaged"}
            onToggle={() => setExpandedStage(expandedStage === "unstaged" ? null : "unstaged")}
          >
            {unstaged.map((contact: any) => (
              <DraggablePipelineContactCard key={contact.id} contact={contact} />
            ))}
          </DroppableStage>
        )}

        {stages.map((stage: any) => {
          const stageContacts = getContactsForStage(stage.id);
          return (
            <DroppableStage
              key={stage.id}
              id={`stage-${stage.id}`}
              color={stage.color}
              name={stage.name}
              count={stageContacts.length}
              expanded={expandedStage === stage.id}
              onToggle={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
            >
              {stageContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 py-3">{t("pipeline.dropHere")}</p>
              ) : (
                stageContacts.map((contact: any) => (
                  <DraggablePipelineContactCard key={contact.id} contact={contact} />
                ))
              )}
            </DroppableStage>
          );
        })}
      </div>
      <DragOverlay>
        {activeContact ? (
          <div className="card-elevated p-3 shadow-2xl rotate-2 opacity-95">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 avatar-circle text-[10px] shrink-0">
                {activeContact.name.split(" ").map((n: string) => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{activeContact.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{activeContact.title} · {activeContact.company}</p>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

const DroppableStage = ({ id, color, name, count, expanded, onToggle, children }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`rounded-2xl transition-colors ${isOver ? "bg-primary/5 ring-2 ring-primary/40" : ""}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 card-elevated">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-foreground flex-1 text-left">{name}</span>
        <span className="text-xs text-muted-foreground mr-1">{count}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {(expanded || isOver) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pl-6 pt-1 space-y-1.5 min-h-[40px]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Sortable list of stages for the manage panel
const SortableStagesList = ({ stages, getCount, onReorder, onDelete }: {
  stages: any[];
  getCount: (id: string) => number;
  onReorder: (newOrder: any[]) => void;
  onDelete: (id: string) => void;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(stages, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {stages.map((stage) => (
            <SortableStageRow key={stage.id} stage={stage} count={getCount(stage.id)} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

const SortableStageRow = ({ stage, count, onDelete }: { stage: any; count: number; onDelete: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1 rounded-lg hover:bg-muted/40 transition-colors">
      <button {...listeners} {...attributes} className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5" aria-label="Reorder">
        <GripVertical size={14} />
      </button>
      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
      <span className="text-sm text-foreground flex-1">{stage.name}</span>
      <span className="text-[10px] text-muted-foreground">{count}</span>
      <button onClick={() => onDelete(stage.id)} className="text-destructive p-0.5"><X size={14} /></button>
    </div>
  );
};

const DraggablePipelineContactCard = ({ contact }: { contact: any }) => {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contact.id });
  return (
    <div ref={setNodeRef} className={`card-elevated p-3 ${isDragging ? "opacity-30" : ""}`}>
      <div className="flex items-center gap-2.5">
        <button {...listeners} {...attributes} className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1" aria-label={t("pipeline.drag")}>
          <GripVertical size={16} />
        </button>
        <div className="w-8 h-8 avatar-circle text-[10px] shrink-0">
          {contact.name.split(" ").map((n: string) => n[0]).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{contact.title} · {contact.company}</p>
        </div>
      </div>
      {contact.follow_up_date && (
        <div className="flex items-center gap-1 mt-1.5 pl-7">
          <Calendar size={10} className="text-warning" />
          <span className="text-[10px] text-warning font-medium">{t("contacts.followUp")} {format(parseISO(contact.follow_up_date), "MMM d")}</span>
        </div>
      )}
    </div>
  );
};


// Activity View
const ActivityView = ({ user, contacts, stages }: { user: any; contacts: any[]; stages: any[] }) => {
  const { t } = useLanguage();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("contact_activities")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setActivities(data || []);
        setLoading(false);
      });
  }, [user]);

  // Engagement summary
  const distribution = { A: 0, B: 0, C: 0 };
  const lastActivityMap: Record<string, string> = {};
  activities.forEach((a) => {
    if (!lastActivityMap[a.contact_id]) lastActivityMap[a.contact_id] = a.created_at;
  });
  contacts.forEach((c: any) => {
    const score = getEngagementScore(c, lastActivityMap[c.id]);
    distribution[score.tier as keyof typeof distribution]++;
  });

  // Dormant contacts (Cold with no recent activity)
  const dormantContacts = contacts
    .filter((c: any) => getEngagementScore(c, lastActivityMap[c.id]).tier === "C")
    .slice(0, 3);

  if (!user) return <div className="text-center py-16"><p className="text-sm text-muted-foreground">{t("contacts.signInActivity")}</p></div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 size={20} className="text-primary animate-spin" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-display font-bold text-foreground mb-1">{t("contacts.activity")}</h2>
      <p className="text-xs text-muted-foreground mb-4">{t("contacts.recentActions")}</p>

      {/* Engagement Summary */}
      {contacts.length > 0 && (
        <div className="card-elevated p-4 mb-4">
          <p className="text-xs font-semibold text-foreground mb-2">{t("contacts.engagementOverview")}</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-2.5 rounded-full overflow-hidden flex bg-muted">
              {distribution.A > 0 && <div className="h-full bg-emerald-400" style={{ width: `${(distribution.A / (contacts.length || 1)) * 100}%` }} />}
              {distribution.B > 0 && <div className="h-full bg-amber-400" style={{ width: `${(distribution.B / (contacts.length || 1)) * 100}%` }} />}
              {distribution.C > 0 && <div className="h-full bg-zinc-400" style={{ width: `${(distribution.C / (contacts.length || 1)) * 100}%` }} />}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-[11px] font-bold text-emerald-400">{distribution.A}</span><span className="text-[10px] text-muted-foreground">{t("dashboard.hot")}</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-[11px] font-bold text-amber-400">{distribution.B}</span><span className="text-[10px] text-muted-foreground">{t("dashboard.warm")}</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-zinc-400" /><span className="text-[11px] font-bold text-zinc-400">{distribution.C}</span><span className="text-[10px] text-muted-foreground">{t("dashboard.cold")}</span></div>
          </div>
        </div>
      )}

      {/* Dormant contacts nudge */}
      {dormantContacts.length > 0 && (
        <div className="card-elevated p-4 mb-4 border-warning/20">
          <p className="text-xs font-semibold text-foreground mb-2">{t("contacts.reEngage")}</p>
          <div className="space-y-2">
            {dormantContacts.map((c: any) => {
              const eng = getEngagementScore(c, lastActivityMap[c.id]);
              return (
                <button key={c.id} onClick={() => navigate(`/contact/${c.id}`)} className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-secondary/40 transition-colors text-left">
                  <div className="w-7 h-7 avatar-circle text-[9px] shrink-0">{c.name.split(" ").map((n: string) => n[0]).join("")}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.company}{eng.daysSinceActivity !== null ? ` · ${eng.daysSinceActivity}d ${t("contacts.inactive")}` : ""}</p>
                  </div>
                  <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 size={40} className="text-border mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">{t("contacts.noActivityYet")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("contacts.activityHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => {
            const contact = contacts.find((c: any) => c.id === activity.contact_id);
            return (
              <div key={activity.id} className="card-elevated p-3 flex items-start gap-3">
                <div className="w-8 h-8 avatar-circle text-[10px] shrink-0 mt-0.5">
                  {contact ? contact.name.split(" ").map((n: string) => n[0]).join("") : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                    {contact && (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${getEngagementScore(contact, lastActivityMap[contact.id]).bgColor} ${getEngagementScore(contact, lastActivityMap[contact.id]).color}`}>
                        {getEngagementScore(contact, lastActivityMap[contact.id]).tier}
                      </span>
                    )}
                  </div>
                  {contact && <p className="text-[10px] text-muted-foreground">{contact.name}{contact.company ? ` · ${contact.company}` : ""}</p>}
                  {activity.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{activity.description}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{format(parseISO(activity.created_at), "MMM d, h:mm a")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// Contact row component
const ContactRow = ({ contact, selectedContact, setSelectedContact, enriching, handleEnrich, handleVoiceNote, setMeetingContactId, updateContact, deleteContact, navigate, stages, bulkMode = false, isChecked = false, onToggleCheck }: {
  contact: Contact;
  selectedContact: Contact | null;
  setSelectedContact: (c: Contact | null) => void;
  enriching: string | null;
  handleEnrich: (c: Contact) => void;
  handleVoiceNote: (id: string, text: string) => void;
  setMeetingContactId: (id: string | null) => void;
  updateContact: (id: string, u: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  navigate: (path: string) => void;
  stages: { id: string; name: string; color: string }[];
  bulkMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (id: string) => void;
}) => {
  const { t } = useLanguage();
  const isSelected = selectedContact?.id === contact.id;
  const currentStage = stages.find((s) => s.id === contact.stageId);
  const engagement = getEngagementScore(contact);

  const handleClick = () => {
    if (bulkMode && onToggleCheck) {
      onToggleCheck(contact.id);
    } else {
      setSelectedContact(isSelected ? null : contact);
    }
  };

  return (
    <SwipeToDelete onDelete={() => { deleteContact(contact.id); toast.success(t("contacts.contactRemoved")); }}>
    <div onClick={handleClick} className={`card-elevated p-3.5 cursor-pointer hover:shadow-md transition-shadow ${bulkMode && isChecked ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}>
      <div className="flex items-center gap-3">
        {bulkMode && (
          <div className="shrink-0">
            {isChecked ? (
              <CheckSquare size={18} className="text-primary" />
            ) : (
              <Square size={18} className="text-muted-foreground/40" />
            )}
          </div>
        )}
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} className="w-9 h-9 rounded-full object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
        ) : null}
        <div className={`w-9 h-9 avatar-circle text-[11px] shrink-0 ${contact.avatar ? "hidden" : ""}`}>
          {contact.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${engagement.bgColor} ${engagement.color}`}>
              {engagement.tier}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {contact.title} · {contact.company}
            {contact.nextStep && <span className="ml-1 text-primary">→ {contact.nextStep}</span>}
          </p>
        </div>
        {stages.length > 0 && (
          <Popover>
            <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
              {currentStage ? (
                <button
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: currentStage.color + "1A",
                    color: currentStage.color,
                    borderColor: currentStage.color + "40",
                  }}
                  title={t("contacts.changeStage") || "Change stage"}
                >
                  {currentStage.name}
                </button>
              ) : (
                <button className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 border border-dashed border-border/60 text-muted-foreground/70 hover:text-foreground hover:border-border transition-colors">
                  {t("pipeline.unassigned")}
                </button>
              )}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-48 p-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                {t("contacts.status") || "Stage"}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateContact(contact.id, { stageId: undefined } as any);
                  if ((contact as any).user_id || true) {
                    supabase.from("contacts").update({ stage_id: null }).eq("id", contact.id);
                  }
                }}
                className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors ${!contact.stageId ? "bg-accent/60" : ""}`}
              >
                <span className="w-2 h-2 rounded-full border border-dashed border-muted-foreground/60" />
                <span className="text-muted-foreground">{t("pipeline.unassigned")}</span>
              </button>
              {stages.map((s) => (
                <button
                  key={s.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateContact(contact.id, { stageId: s.id } as any);
                    supabase.from("contacts").update({ stage_id: s.id }).eq("id", contact.id);
                  }}
                  className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors ${contact.stageId === s.id ? "bg-accent/60" : ""}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-foreground truncate">{s.name}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
        {contact.enriched && <Sparkles size={12} className="text-success shrink-0" />}
        {contact.phone && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isFeatureEnabled("twilioDialer")) {
                  notifyComingSoon("Phone calling is in review for the mobile app.");
                  return;
                }
                window.open(`tel:${contact.phone}`, "_self");
              }}
              className={`w-8 h-8 rounded-full bg-muted/50 hover:bg-primary/10 flex items-center justify-center transition-colors ${!isFeatureEnabled("twilioDialer") ? "opacity-60" : ""}`}
              title={isFeatureEnabled("twilioDialer") ? `Call ${contact.name}` : "Coming soon on mobile"}
              aria-disabled={!isFeatureEnabled("twilioDialer")}
            >
              <Phone size={14} className="text-muted-foreground" />
            </button>
            {!isFeatureEnabled("twilioDialer") && (
              <ComingSoonBadge className="hidden sm:inline-flex" />
            )}
          </div>
        )}
        <ChevronRight size={13} className={`text-muted-foreground/30 shrink-0 transition-transform ${isSelected ? "rotate-90" : ""}`} />
      </div>

      {isSelected && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 pt-3 border-t border-border/60 space-y-2">
          {stages.length > 0 && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("contacts.status")}</span>
              <select value={contact.stageId || ""} onChange={(e) => updateContact(contact.id, { stageId: e.target.value || undefined })} className="text-xs bg-secondary rounded-lg px-2 py-1 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30">
                <option value="">{t("pipeline.unassigned")}</option>
                {stages.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          )}
          {[
            { icon: Mail, value: contact.email },
            { icon: Phone, value: contact.phone },
            { icon: Calendar, value: new Date(contact.scannedAt).toLocaleDateString() },
          ].map(({ icon: Icon, value }) => (
            <div key={value} className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Icon size={12} className="text-primary shrink-0" /> {value}
            </div>
          ))}
          {contact.enriched && (
            <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={10} className="text-success" />
                <span className="text-[10px] font-semibold text-success uppercase tracking-wider">{t("contacts.enriched")}</span>
              </div>
              {contact.website && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Globe size={12} className="text-primary" /> {contact.website}</div>}
              {contact.location && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={12} className="text-primary" /> {contact.location}</div>}
              {contact.industry && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 size={12} className="text-primary" /> {contact.industry}{contact.companySize ? ` · ${contact.companySize}` : ""}</div>}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-border/60">
            <LinkedInActions contactName={contact.name} contactLinkedIn={contact.linkedin} contactCompany={contact.company} contactTitle={contact.title} />
          </div>
          <div className="mt-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <StickyNote size={10} className="text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("contacts.notes")}</span>
              </div>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <VoiceRecorder onTranscript={(text) => handleVoiceNote(contact.id, text)} mode="memo" />
              </div>
            </div>
            <textarea value={contact.notes || ""} onChange={(e) => updateContact(contact.id, { notes: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder={t("contacts.addNote")} rows={2} maxLength={5000} className="input-field resize-none text-xs" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={(e) => { e.stopPropagation(); navigate(`/contact/${contact.id}`); }} className="flex items-center gap-1.5 text-primary text-xs font-semibold">
              <ChevronRight size={12} /> {t("contacts.viewProfile")}
            </button>
            {!contact.enriched && (
              <button onClick={(e) => { e.stopPropagation(); handleEnrich(contact); }} disabled={enriching === contact.id} className="flex items-center gap-1.5 text-primary text-xs font-semibold disabled:opacity-50">
                <Wand2 size={12} /> {enriching === contact.id ? t("contacts.enriching") : t("contacts.enrich")}
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); deleteContact(contact.id); toast.success(t("contacts.contactRemoved")); }} className="flex items-center gap-1.5 text-destructive text-xs font-semibold ml-auto">
              <Trash2 size={12} /> {t("contacts.remove")}
            </button>
          </div>
        </motion.div>
      )}
    </div>
    </SwipeToDelete>
  );
};

export default Contacts;
