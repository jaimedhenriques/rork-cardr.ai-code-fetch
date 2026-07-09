import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import {
  Download, Mail, FileSpreadsheet, FolderOpen, Sparkles, ChevronRight,
  FileJson, ContactRound, FileText, Calendar as CalendarIcon, Check,
  CheckSquare, Square, Filter, Send, X, StickyNote, Eye
} from "lucide-react";
import { toast } from "sonner";
import { useApp, Contact } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import CrmExportPanel from "@/components/CrmExportPanel";
import CsvPreviewDialog from "@/components/CsvPreviewDialog";

type ExportTab = "contacts" | "notes";
type DatePreset = "all" | "today" | "7days" | "30days" | "this-month" | "custom";

interface MeetingNote {
  id: string;
  title: string;
  summary: string | null;
  key_topics: string[];
  action_items: { task: string; owner?: string; deadline?: string; done?: boolean }[];
  decisions: string[];
  manual_notes: string | null;
  created_at: string;
  folder_id: string | null;
}

const Export = () => {
  const { contacts, folders } = useApp();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<ExportTab>("contacts");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);

  // Load notes
  useEffect(() => {
    const loadNotes = async () => {
      setLoadingNotes(true);
      if (!user) {
        try {
          const raw = localStorage.getItem("cardscanpro_guest_notes");
          setNotes(raw ? JSON.parse(raw) : []);
        } catch { setNotes([]); }
        setLoadingNotes(false);
        return;
      }
      const { data } = await supabase
        .from("meeting_notes")
        .select("id, title, summary, key_topics, action_items, decisions, manual_notes, created_at, folder_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setNotes((data || []).map((d: any) => ({
        ...d,
        key_topics: Array.isArray(d.key_topics) ? d.key_topics : [],
        action_items: Array.isArray(d.action_items) ? d.action_items : [],
        decisions: Array.isArray(d.decisions) ? d.decisions : [],
      })));
      setLoadingNotes(false);
    };
    loadNotes();
  }, [user]);

  // Date filtering logic
  const getDateRange = useCallback((): { from: Date | null; to: Date | null } => {
    const now = new Date();
    switch (datePreset) {
      case "today": return { from: startOfDay(now), to: endOfDay(now) };
      case "7days": return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case "30days": return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case "this-month": return { from: startOfMonth(now), to: endOfMonth(now) };
      case "custom": return { from: dateFrom ? startOfDay(dateFrom) : null, to: dateTo ? endOfDay(dateTo) : null };
      default: return { from: null, to: null };
    }
  }, [datePreset, dateFrom, dateTo]);

  const isInDateRange = useCallback((dateStr: string) => {
    const { from, to } = getDateRange();
    if (!from && !to) return true;
    const d = parseISO(dateStr);
    if (from && isBefore(d, from)) return false;
    if (to && isAfter(d, to)) return false;
    return true;
  }, [getDateRange]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (selectedFolder !== "all" && c.folderId !== selectedFolder) return false;
      if (!isInDateRange(c.scannedAt)) return false;
      return true;
    });
  }, [contacts, selectedFolder, isInDateRange]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedFolder !== "all" && n.folder_id !== selectedFolder) return false;
      if (!isInDateRange(n.created_at)) return false;
      return true;
    });
  }, [notes, selectedFolder, isInDateRange]);

  // Selection helpers
  const allContactsSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selectedContactIds.has(c.id));
  const allNotesSelected = filteredNotes.length > 0 && filteredNotes.every((n) => selectedNoteIds.has(n.id));

  const toggleAllContacts = () => {
    if (allContactsSelected) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const toggleContact = (id: string) => {
    const next = new Set(selectedContactIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedContactIds(next);
  };

  const toggleAllNotes = () => {
    if (allNotesSelected) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(filteredNotes.map((n) => n.id)));
    }
  };

  const toggleNote = (id: string) => {
    const next = new Set(selectedNoteIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedNoteIds(next);
  };

  // Reset selection when filters change
  useEffect(() => {
    setSelectedContactIds(new Set());
    setSelectedNoteIds(new Set());
  }, [selectedFolder, datePreset, dateFrom, dateTo]);

  // Export helpers
  const getSelectedContacts = () => filteredContacts.filter((c) => selectedContactIds.has(c.id));
  const getSelectedNotes = () => filteredNotes.filter((n) => selectedNoteIds.has(n.id));

  const logExportActivity = async (exportedContacts: Contact[], method: string) => {
    if (!user || exportedContacts.length === 0) return;
    const now = new Date().toISOString();
    const inserts = exportedContacts.map((c) => ({
      user_id: user.id,
      contact_id: c.id,
      type: "export",
      title: `Exported via ${method}`,
      description: `Exported on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
    }));
    await supabase.from("contact_activities").insert(inserts);
  };

  const formatContactForEmail = (c: Contact) => {
    let line = `• ${c.name}`;
    if (c.title) line += ` — ${c.title}`;
    if (c.company) line += ` at ${c.company}`;
    if (c.email) line += `\n  Email: ${c.email}`;
    if (c.phone) line += `\n  Phone: ${c.phone}`;
    if (c.linkedin) line += `\n  LinkedIn: ${c.linkedin}`;
    if (c.website) line += `\n  Website: ${c.website}`;
    if (c.location) line += `\n  Location: ${c.location}`;
    if (includeNotes && c.notes) line += `\n  Notes: ${c.notes}`;
    return line;
  };

  const formatNoteForEmail = (n: MeetingNote) => {
    let line = `📝 ${n.title}`;
    line += `\n  Date: ${format(parseISO(n.created_at), "MMM d, yyyy")}`;
    if (n.summary) line += `\n  Summary: ${n.summary}`;
    if (n.key_topics && n.key_topics.length > 0) line += `\n  Topics: ${n.key_topics.join(", ")}`;
    if (n.action_items && n.action_items.length > 0) {
      line += `\n  Action Items:`;
      n.action_items.forEach((item) => { line += `\n    - ${item.task}${item.owner ? ` (${item.owner})` : ""}`; });
    }
    if (n.decisions && n.decisions.length > 0) {
      line += `\n  Decisions:`;
      n.decisions.forEach((d) => { line += `\n    - ${d}`; });
    }
    if (n.manual_notes) line += `\n  Notes: ${n.manual_notes}`;
    return line;
  };

  const handleEmailExport = () => {
    const selectedContacts = getSelectedContacts();
    const selectedNotes = getSelectedNotes();

    if (selectedContacts.length === 0 && selectedNotes.length === 0) {
      toast.error(t("export.selectAtLeastOne"));
      return;
    }

    let body = "";
    if (selectedContacts.length > 0) {
      body += `CONTACTS (${selectedContacts.length})\n${"─".repeat(30)}\n\n`;
      body += selectedContacts.map(formatContactForEmail).join("\n\n");
    }
    if (selectedNotes.length > 0) {
      if (body) body += "\n\n\n";
      body += `MEETING NOTES (${selectedNotes.length})\n${"─".repeat(30)}\n\n`;
      body += selectedNotes.map(formatNoteForEmail).join("\n\n");
    }

    const subject = `Card ScanPro Export — ${format(new Date(), "MMM d, yyyy")}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success(t("export.openingEmail"));
    logExportActivity(selectedContacts, "email");
  };

  const generateCSV = () => {
    const data = getSelectedContacts();
    const headers = includeNotes
      ? "Name,Title,Company,Email,Phone,LinkedIn,Website,Location,Industry,Notes,Scanned At\n"
      : "Name,Title,Company,Email,Phone,LinkedIn,Website,Location,Industry,Scanned At\n";
    const rows = data.map((c) => {
      const base = `"${c.name}","${c.title}","${c.company}","${c.email}","${c.phone}","${c.linkedin || ""}","${c.website || ""}","${c.location || ""}","${c.industry || ""}"`;
      return includeNotes
        ? `${base},"${(c.notes || "").replace(/"/g, '""')}","${c.scannedAt}"`
        : `${base},"${c.scannedAt}"`;
    }).join("\n");
    return headers + rows;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCsv, setPreviewCsv] = useState("");
  const [previewRowCount, setPreviewRowCount] = useState(0);

  const csvFilename = `cardscanpro-contacts-${format(new Date(), "yyyy-MM-dd")}.csv`;

  const performDownloadCSV = (csv: string, data: Contact[]) => {
    downloadFile(csv, csvFilename, "text/csv");
    toast.success(`${t("export.exported")} ${data.length} ${t("export.contacts")}`);
    logExportActivity(data, "CSV");
  };

  const handlePreviewCSV = () => {
    const data = getSelectedContacts();
    if (data.length === 0) { toast.error(t("export.selectContacts")); return; }
    setPreviewCsv(generateCSV());
    setPreviewRowCount(data.length);
    setPreviewOpen(true);
  };

  const handleDownloadCSV = () => {
    const data = getSelectedContacts();
    if (data.length === 0) { toast.error(t("export.selectContacts")); return; }
    performDownloadCSV(generateCSV(), data);
  };

  const handleDownloadVCF = () => {
    const data = getSelectedContacts();
    if (data.length === 0) { toast.error(t("export.selectContacts")); return; }
    const vcards = data.map((c) => {
      const parts = c.name.split(" ");
      const lastName = parts.pop() || "";
      const firstName = parts.join(" ");
      let vcard = `BEGIN:VCARD\nVERSION:3.0\nN:${lastName};${firstName};;;\nFN:${c.name}\nORG:${c.company}\nTITLE:${c.title}\nEMAIL:${c.email}\nTEL:${c.phone}`;
      if (c.linkedin) vcard += `\nURL:https://${c.linkedin}`;
      if (c.website) vcard += `\nURL:https://${c.website}`;
      if (c.location) vcard += `\nADR:;;${c.location};;;;`;
      if (includeNotes && c.notes) vcard += `\nNOTE:${c.notes.replace(/\n/g, "\\n")}`;
      vcard += `\nEND:VCARD`;
      return vcard;
    }).join("\n");
    downloadFile(vcards, `cardscanpro-contacts-${format(new Date(), "yyyy-MM-dd")}.vcf`, "text/vcard");
    toast.success(`${t("export.exported")} ${data.length} ${t("export.contacts")}`);
    logExportActivity(data, "VCF");
  };

  const totalSelected = selectedContactIds.size + selectedNoteIds.size;
  const datePresets: { key: DatePreset; label: string }[] = [
    { key: "all", label: t("export.allTime") },
    { key: "today", label: t("export.today") },
    { key: "7days", label: t("export.7days") },
    { key: "30days", label: t("export.30days") },
    { key: "this-month", label: t("export.thisMonth") },
    { key: "custom", label: t("export.custom") },
  ];

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-display font-bold text-foreground mb-1">{t("export.title")}</h1>
        <p className="text-xs text-muted-foreground mb-5">{t("export.subtitle")}</p>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="flex gap-2 mb-4">
        {(["contacts", "notes"] as ExportTab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all capitalize tabular-nums",
              tab === tabKey
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
            )}
          >
            {tabKey === "contacts" ? <ContactRound size={13} className="inline mr-1.5 -mt-0.5" /> : <FileText size={13} className="inline mr-1.5 -mt-0.5" />}
            {t(`export.${tabKey}`)} ({tabKey === "contacts" ? filteredContacts.length : filteredNotes.length})
          </button>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="card-elevated p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-primary" />
          <p className="text-xs font-semibold text-foreground">{t("export.filters")}</p>
        </div>

        {/* Folder filter */}
        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">{t("export.folderEvent")}</label>
        <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} className="input-field text-xs mb-3">
          <option value="all">{t("export.allFolders")}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>
          ))}
        </select>

        {/* Date preset chips */}
        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">{t("export.timeRange")}</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {datePresets.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDatePreset(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                datePreset === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <AnimatePresence>
          {datePreset === "custom" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 mt-2 overflow-hidden"
            >
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn("flex-1 input-field text-xs flex items-center gap-2", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon size={12} />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : t("export.from")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn("flex-1 input-field text-xs flex items-center gap-2", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon size={12} />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : t("export.to")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Include notes toggle (contacts tab) */}
        {tab === "contacts" && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-2">
              <StickyNote size={13} className="text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">{t("export.includeNotes")}</span>
            </div>
            <button
              onClick={() => setIncludeNotes(!includeNotes)}
              className={cn(
                "w-9 h-5 rounded-full transition-colors relative",
                includeNotes ? "bg-primary" : "bg-secondary"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                includeNotes ? "translate-x-4" : "translate-x-0.5"
              )} />
            </button>
          </div>
        )}
      </motion.div>

      {/* Selection List */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card-elevated p-4 mb-4">
        {tab === "contacts" ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground tabular-nums">{filteredContacts.length} {t("export.contacts")}</p>
              <button onClick={toggleAllContacts} className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                {allContactsSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                {allContactsSelected ? t("export.deselectAll") : t("export.selectAll")}
              </button>
            </div>
            <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
              {filteredContacts.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-6">{t("export.noContactsMatch")}</p>
              )}
              {filteredContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleContact(c.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                    selectedContactIds.has(c.id) ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-secondary/40"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors",
                    selectedContactIds.has(c.id) ? "bg-primary text-primary-foreground" : "bg-secondary/80"
                  )}>
                    {selectedContactIds.has(c.id) && <Check size={11} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate tabular-nums">
                      {c.title}{c.company ? ` at ${c.company}` : ""} · {format(parseISO(c.scannedAt), "MMM d")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground tabular-nums">{filteredNotes.length} {t("export.notesLabel")}</p>
              <button onClick={toggleAllNotes} className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                {allNotesSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                {allNotesSelected ? t("export.deselectAll") : t("export.selectAll")}
              </button>
            </div>
            <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
              {loadingNotes && <p className="text-xs text-muted-foreground text-center py-6">{t("export.loadingNotes")}</p>}
              {!loadingNotes && filteredNotes.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-6">{t("export.noNotesMatch")}</p>
              )}
              {filteredNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => toggleNote(n.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                    selectedNoteIds.has(n.id) ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-secondary/40"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors",
                    selectedNoteIds.has(n.id) ? "bg-primary text-primary-foreground" : "bg-secondary/80"
                  )}>
                    {selectedNoteIds.has(n.id) && <Check size={11} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{n.title || t("notes.untitledMeeting")}</p>
                    <p className="text-[11px] text-muted-foreground truncate tabular-nums">
                      {format(parseISO(n.created_at), "MMM d, yyyy")}
                      {n.key_topics && n.key_topics.length > 0 ? ` · ${n.key_topics.slice(0, 2).join(", ")}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Export Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        {totalSelected > 0 && (
          <p className="text-[11px] text-primary font-semibold text-center mb-3 tabular-nums">
            {selectedContactIds.size > 0 && `${selectedContactIds.size} ${t("export.contacts")}`}
            {selectedContactIds.size > 0 && selectedNoteIds.size > 0 && " + "}
            {selectedNoteIds.size > 0 && `${selectedNoteIds.size} ${t("export.notesLabel")}`}
            {" "}{t("export.selected")}
          </p>
        )}

        <div className="space-y-2.5">
          {/* Primary: Email */}
          <button
            onClick={handleEmailExport}
            disabled={totalSelected === 0}
            className="w-full btn-primary flex items-center justify-center gap-2.5 py-3.5 disabled:opacity-30"
          >
            <Mail size={16} /> {t("export.sendViaEmail")}
          </button>

          {/* Secondary: File exports (contacts only) */}
          {tab === "contacts" && selectedContactIds.size > 0 && (
            <>
              <button
                onClick={handlePreviewCSV}
                className="w-full card-interactive p-3 flex items-center justify-center gap-2 text-xs font-semibold text-foreground border border-primary/30"
              >
                <Eye size={14} className="text-primary" /> Preview CSV before export
              </button>
              <div className="flex gap-2">
                <button onClick={handleDownloadCSV} className="flex-1 card-interactive p-3 flex items-center justify-center gap-2 text-xs font-semibold text-foreground">
                  <FileSpreadsheet size={14} className="text-primary" /> CSV
                </button>
                <button onClick={handleDownloadVCF} className="flex-1 card-interactive p-3 flex items-center justify-center gap-2 text-xs font-semibold text-foreground">
                  <ContactRound size={14} className="text-success" /> vCard
                </button>
              </div>
              <CrmExportPanel
                getSelectedContacts={getSelectedContacts}
                includeNotes={includeNotes}
                logExportActivity={logExportActivity}
              />
            </>
          )}
        </div>
      </motion.div>

      <CsvPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        csv={previewCsv}
        filename={csvFilename}
        rowCount={previewRowCount}
        onConfirmDownload={() => performDownloadCSV(previewCsv, getSelectedContacts())}
        onConfirmEmail={handleEmailExport}
      />
    </div>
  );
};

export default Export;
