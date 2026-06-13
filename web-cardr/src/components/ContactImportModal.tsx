import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, Smartphone, Check, Loader2, AlertCircle, Calendar, Plus } from "lucide-react";
import { useApp, type Contact } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactImportModalProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  linkedin?: string;
  website?: string;
  location?: string;
  notes?: string;
  eventName?: string; // event name from CSV row
  selected: boolean;
}

type EventOption = { id: string; title: string };

// Special sentinel values for the event selector
const EVENT_AUTO = "__auto__";
const EVENT_NONE = "__none__";
const EVENT_NEW = "__new__";

const ContactImportModal = ({ open, onClose }: ContactImportModalProps) => {
  const { addContact, canAddContact, contacts, updateContact } = useApp();
  const { user } = useAuth();
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventChoice, setEventChoice] = useState<string>(EVENT_AUTO);
  const [newEventName, setNewEventName] = useState("");
  const [mergeMode, setMergeMode] = useState<"merge" | "skip">("merge");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load events for mapping
  useEffect(() => {
    if (!user || !open) return;
    supabase
      .from("events")
      .select("id, title, start_date")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false })
      .then(({ data }) => {
        if (data) setEvents(data.map((e: any) => ({ id: e.id, title: e.title })));
      });
  }, [user, open]);

  const reset = () => {
    setParsed([]);
    setStep("upload");
    setImporting(false);
    setEventChoice(EVENT_AUTO);
    setNewEventName("");
    setProgress({ current: 0, total: 0 });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Robust CSV line parser handling quoted fields with escaped quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result.map((s) => s.trim());
  };

  // Parse multi-line CSV (handles newlines inside quoted fields)
  const splitCSVRows = (text: string): string[] => {
    const rows: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '""';
          i++;
        } else {
          inQuotes = !inQuotes;
          current += ch;
        }
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (current.trim().length > 0) rows.push(current);
        current = "";
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else {
        current += ch;
      }
    }
    if (current.trim().length > 0) rows.push(current);
    return rows;
  };

  const findHeader = (headers: string[], candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const parseCSV = (text: string): ParsedContact[] => {
    const rows = splitCSVRows(text);
    if (rows.length < 2) return [];
    const headers = parseCSVLine(rows[0]).map((h) => h.toLowerCase().replace(/['"]/g, ""));

    const nameIdx = headers.findIndex(
      (h) => h.includes("name") && !h.includes("last") && !h.includes("first") && !h.includes("company") && !h.includes("event")
    );
    const firstIdx = findHeader(headers, ["first name", "firstname", "given"]);
    const lastIdx = findHeader(headers, ["last name", "lastname", "surname", "family"]);
    const emailIdx = findHeader(headers, ["email", "e-mail"]);
    const phoneIdx = findHeader(headers, ["phone", "tel", "mobile", "cell"]);
    const companyIdx = findHeader(headers, ["company", "organization", "organisation", "org", "employer"]);
    const titleIdx = findHeader(headers, ["title", "job", "role", "position"]);
    const linkedinIdx = findHeader(headers, ["linkedin"]);
    const websiteIdx = findHeader(headers, ["website", "url", "web"]);
    const locationIdx = findHeader(headers, ["location", "city", "address"]);
    const notesIdx = findHeader(headers, ["notes", "note", "comment"]);
    const eventIdx = findHeader(headers, ["event", "folder", "list", "tag"]);

    return rows
      .slice(1)
      .map((line) => {
        const cols = parseCSVLine(line);
        const get = (idx: number) => (idx >= 0 ? (cols[idx] || "").replace(/^"|"$/g, "").trim() : "");
        const first = get(firstIdx);
        const last = get(lastIdx);
        const fullName = get(nameIdx) || `${first} ${last}`.trim();
        return {
          name: fullName || "Unknown",
          email: get(emailIdx),
          phone: get(phoneIdx),
          company: get(companyIdx),
          title: get(titleIdx),
          linkedin: get(linkedinIdx) || undefined,
          website: get(websiteIdx) || undefined,
          location: get(locationIdx) || undefined,
          notes: get(notesIdx) || undefined,
          eventName: get(eventIdx) || undefined,
          selected: true,
        };
      })
      .filter((c) => c.name && c.name !== "Unknown");
  };

  const parseVCF = (text: string): ParsedContact[] => {
    const cards = text.split("BEGIN:VCARD").slice(1);
    return cards
      .map((card) => {
        const getField = (key: string) => {
          const match = card.match(new RegExp(`${key}[;:]([^\\r\\n]+)`, "i"));
          return match ? match[1].replace(/^.*:/, "").trim() : "";
        };
        const fn = getField("FN");
        const n = getField("N");
        const name = fn || (n ? n.split(";").filter(Boolean).reverse().join(" ") : "Unknown");
        return {
          name,
          email: getField("EMAIL"),
          phone: getField("TEL"),
          company: getField("ORG").replace(/;/g, ""),
          title: getField("TITLE"),
          selected: true,
        };
      })
      .filter((c) => c.name && c.name !== "Unknown");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      let results: ParsedContact[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) results = parseCSV(text);
      else if (file.name.toLowerCase().endsWith(".vcf") || file.name.toLowerCase().endsWith(".vcard")) results = parseVCF(text);
      else { toast.error("Unsupported file format. Use CSV or VCF."); return; }

      if (results.length === 0) { toast.error("No contacts found in file."); return; }
      setParsed(results);
      setStep("preview");
      // If CSV has event column, default to "Auto from CSV"; otherwise "None"
      const hasEventCol = results.some((r) => r.eventName);
      setEventChoice(hasEventCol ? EVENT_AUTO : EVENT_NONE);
      toast.success(`${results.length} contacts found`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleContact = (idx: number) =>
    setParsed((prev) => prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c)));

  const toggleAll = () => {
    const allSelected = parsed.every((c) => c.selected);
    setParsed((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  };

  const csvHasEventCol = useMemo(() => parsed.some((p) => p.eventName), [parsed]);

  // Resolve an event id, creating one if needed; cached per name
  const ensureEventId = async (
    name: string,
    cache: Map<string, string>,
    eventList: EventOption[]
  ): Promise<string | null> => {
    if (!user) return null;
    const key = name.trim().toLowerCase();
    if (!key) return null;
    if (cache.has(key)) return cache.get(key) || null;
    const existing = eventList.find((e) => e.title.trim().toLowerCase() === key);
    if (existing) { cache.set(key, existing.id); return existing.id; }
    const { data, error } = await supabase
      .from("events")
      .insert({ user_id: user.id, title: name.trim(), start_date: new Date().toISOString(), status: "upcoming", event_type: "conference" })
      .select("id, title")
      .single();
    if (error || !data) return null;
    eventList.push({ id: data.id, title: data.title });
    cache.set(key, data.id);
    return data.id;
  };

  const linkContactToEvent = async (contactId: string, eventId: string) => {
    if (!user) return;
    await supabase
      .from("event_contacts")
      .upsert(
        { user_id: user.id, contact_id: contactId, event_id: eventId },
        { onConflict: "event_id,contact_id", ignoreDuplicates: true } as any
      );
  };

  const handleImport = async () => {
    const selected = parsed.filter((c) => c.selected);
    if (selected.length === 0) { toast.error("No contacts selected"); return; }
    if (!user) { toast.error("You must be signed in to import"); return; }

    setImporting(true);
    setProgress({ current: 0, total: selected.length });

    let imported = 0;
    let merged = 0;
    let skipped = 0;
    let linked = 0;

    // Resolve a single fixed event id if applicable
    const eventCache = new Map<string, string>();
    const workingEvents = [...events];
    let fixedEventId: string | null = null;
    if (eventChoice === EVENT_NEW && newEventName.trim()) {
      fixedEventId = await ensureEventId(newEventName.trim(), eventCache, workingEvents);
    } else if (eventChoice !== EVENT_AUTO && eventChoice !== EVENT_NONE && eventChoice !== EVENT_NEW) {
      fixedEventId = eventChoice;
    }

    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      setProgress({ current: i + 1, total: selected.length });

      // Find existing match by email (preferred) or by name+company
      const existing = contacts.find((ec) => {
        if (c.email && ec.email && ec.email.toLowerCase() === c.email.toLowerCase()) return true;
        if (!c.email && ec.name.toLowerCase() === c.name.toLowerCase() && (ec.company || "").toLowerCase() === (c.company || "").toLowerCase()) return true;
        return false;
      });

      let contactId: string | null = null;

      if (existing) {
        if (mergeMode === "skip") {
          skipped++;
        } else {
          // Merge: only fill blanks on existing record
          const updates: Partial<Contact> = {};
          if (!existing.phone && c.phone) updates.phone = c.phone;
          if (!existing.company && c.company) updates.company = c.company;
          if (!existing.title && c.title) updates.title = c.title;
          if (!existing.email && c.email) updates.email = c.email;
          if (!(existing as any).linkedin && c.linkedin) (updates as any).linkedin = c.linkedin;
          if (!(existing as any).website && c.website) (updates as any).website = c.website;
          if (!(existing as any).location && c.location) (updates as any).location = c.location;
          if (c.notes) {
            const ts = new Date().toLocaleString();
            const block = `📥 Imported [${ts}]\n${c.notes}`;
            updates.notes = existing.notes ? `${existing.notes}\n\n${block}` : block;
          }
          if (Object.keys(updates).length > 0) updateContact(existing.id, updates);
          merged++;
          contactId = existing.id;
        }
      } else {
        if (!canAddContact) { skipped++; continue; }
        const newId = Date.now().toString() + Math.random().toString(36).slice(2);
        const created = await addContact({
          id: newId,
          name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          title: c.title,
          linkedin: c.linkedin,
          website: c.website,
          location: c.location,
          notes: c.notes,
          leadSource: "import" as any,
          scannedAt: new Date().toISOString(),
        } as any);
        contactId = (created && (created as Contact).id) || newId;
        imported++;
      }

      // Link to event
      if (contactId && eventChoice !== EVENT_NONE) {
        let targetEventId: string | null = null;
        if (eventChoice === EVENT_AUTO) {
          if (c.eventName) {
            targetEventId = await ensureEventId(c.eventName, eventCache, workingEvents);
          }
        } else {
          targetEventId = fixedEventId;
        }
        if (targetEventId) {
          await linkContactToEvent(contactId, targetEventId);
          linked++;
        }
      }

      await new Promise((r) => setTimeout(r, 5));
    }

    setImporting(false);
    const parts: string[] = [];
    if (imported > 0) parts.push(`${imported} added`);
    if (merged > 0) parts.push(`${merged} merged`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (linked > 0) parts.push(`${linked} linked to event`);
    toast.success(parts.join(" · ") || "Import complete");
    handleClose();
  };

  const selectedCount = parsed.filter((c) => c.selected).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-foreground">Import Contacts</h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {step === "upload" && (
              <div className="space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center gap-4 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">CSV File</p>
                    <p className="text-xs text-muted-foreground">From Cardr export, spreadsheets, CRM</p>
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 rounded-xl border-2 border-dashed border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors flex items-center gap-4 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                    <Smartphone size={18} className="text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">VCF / vCard File</p>
                    <p className="text-xs text-muted-foreground">Export from iPhone, Android, Outlook</p>
                  </div>
                </button>

                <div className="p-3 rounded-xl bg-secondary/50 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-primary" /> Tip
                  </p>
                  <p>Add an <code className="text-foreground">Event</code> column to your CSV to auto-organize rows into event folders.</p>
                  <p>Recognized columns: Name, Email, Phone, Company, Title, LinkedIn, Website, Location, Notes, Event.</p>
                </div>

                <input ref={fileInputRef} type="file" accept=".csv,.vcf,.vcard" className="hidden" onChange={handleFile} />
              </div>
            )}

            {step === "preview" && (
              <div className="space-y-3">
                {/* Event mapping */}
                <div className="rounded-xl border border-border/60 p-3 bg-secondary/30 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar size={12} className="text-primary" /> Add to event folder
                  </p>
                  <select
                    value={eventChoice}
                    onChange={(e) => setEventChoice(e.target.value)}
                    className="w-full input-field !h-9 text-sm"
                  >
                    {csvHasEventCol && (
                      <option value={EVENT_AUTO}>Auto from CSV (Event column)</option>
                    )}
                    <option value={EVENT_NONE}>No event — import as-is</option>
                    {events.length > 0 && (
                      <optgroup label="Existing events">
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>{ev.title}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value={EVENT_NEW}>+ Create new event…</option>
                  </select>
                  {eventChoice === EVENT_NEW && (
                    <input
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      placeholder="New event name"
                      className="input-field !h-9 text-sm"
                      autoFocus
                    />
                  )}
                  {eventChoice === EVENT_AUTO && csvHasEventCol && (
                    <p className="text-[10px] text-muted-foreground">New events will be created automatically when names don't match existing ones.</p>
                  )}
                </div>

                {/* Merge mode */}
                <div className="rounded-xl border border-border/60 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Duplicate handling (matched by email)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMergeMode("merge")}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${mergeMode === "merge" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
                    >Merge (fill blanks)</button>
                    <button
                      onClick={() => setMergeMode("skip")}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${mergeMode === "skip" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
                    >Skip duplicates</button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{selectedCount} of {parsed.length} selected</p>
                  <button onClick={toggleAll} className="text-xs text-primary font-semibold">
                    {parsed.every((c) => c.selected) ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 border border-border/60 rounded-xl p-2">
                  {parsed.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => toggleContact(i)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${c.selected ? "bg-primary/5" : "bg-secondary/30 opacity-60"}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${c.selected ? "border-primary bg-primary" : "border-border"}`}>
                        {c.selected && <Check size={12} className="text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {[c.title, c.company, c.email].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {c.eventName && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent shrink-0 max-w-[100px] truncate">
                          {c.eventName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {importing && (
                  <div className="text-xs text-muted-foreground text-center">
                    Importing {progress.current} / {progress.total}…
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setParsed([]); setStep("upload"); }} disabled={importing} className="btn-secondary flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                    <X size={16} /> Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || selectedCount === 0 || (eventChoice === EVENT_NEW && !newEventName.trim())}
                    className="btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {importing ? "Importing..." : `Import ${selectedCount}`}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContactImportModal;
