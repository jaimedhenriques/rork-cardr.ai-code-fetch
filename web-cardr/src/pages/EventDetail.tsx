import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, MapPin, Users, ChevronRight, ScanLine, Search, FolderPlus, Folder as FolderIcon, UserPlus, X, Check, Star, Download, Mail, Share2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { findFolderByName } from "@/lib/folder-match";
import CardHolder from "@/components/event/CardHolder";

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { folders, addFolder, updateFolder, updateContact, profile } = useApp();
  const { activeEventId, setActiveEventId } = useActiveEvent();
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "email" | "phone" | "linkedin" | "needs_info">("all");
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [exportEmail, setExportEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  type SendStatus = {
    email: string;
    status: "pending" | "sending" | "sent" | "failed";
    error?: string;
    messageId?: string | null;
    deliveryMode?: string;
  };
  const [sendStatuses, setSendStatuses] = useState<SendStatus[]>([]);

  const isActive = activeEventId === eventId;

  const { data: event, isLoading } = useQuery({
    queryKey: ["event_detail", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["event_detail_contacts", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_contacts")
        .select("id, created_at, contacts(id, name, company, title, email, phone, avatar, folder_id, linkedin)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || [])
        .map((row: any) => ({ ...row.contacts, linkedAt: row.created_at, linkId: row.id }))
        .filter((c: any) => c && c.id);
    },
    enabled: !!eventId && !!user,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_picker", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, company, title")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && showAddPicker,
  });

  const linkedIds = useMemo(() => new Set(contacts.map((c: any) => c.id)), [contacts]);

  // All folders that belong to this event — matched by event_id, or by
  // legacy name match for folders created before the card-holder feature.
  const eventFolders = useMemo(() => {
    if (!event) return [] as typeof folders;
    const byId = folders.filter((f) => f.eventId === eventId);
    const legacy = findFolderByName(folders, event.title);
    if (legacy && !byId.some((f) => f.id === legacy.id)) {
      return [legacy, ...byId];
    }
    return byId;
  }, [folders, event, eventId]);

  // Primary folder = first one (used for auto-assign on add-to-event).
  const eventFolder = eventFolders[0] ?? null;

  // Create a new folder pre-linked to this event (card-holder add).
  const createEventFolder = useMutation({
    mutationFn: async (name: string) => {
      if (!event) throw new Error("no event");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name required");
      const created = await addFolder({
        id: crypto.randomUUID(),
        name: trimmed,
        emoji: "📅",
        createdAt: new Date().toISOString(),
        eventId: eventId!,
      });
      if (!created) throw new Error("Could not create folder");
      // If addFolder returned an existing folder (name collision), make sure
      // it is linked to this event.
      if (created.eventId !== eventId) {
        await updateFolder(created.id, { eventId: eventId! });
      }
      return created;
    },
    onSuccess: (folder) => toast.success(`Added "${folder.name}" to card holder`, { icon: "📂" }),
    onError: (err: any) => toast.error(err?.message || "Couldn't create folder"),
  });

  // Legacy single-folder helper kept for the header tile + auto-link.
  const ensureFolder = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error("no event");
      if (eventFolder) {
        if (eventFolder.eventId !== eventId) {
          await updateFolder(eventFolder.id, { eventId: eventId! });
        }
        return eventFolder;
      }
      return await createEventFolder.mutateAsync(event.title);
    },
    onSuccess: (folder) => {
      if (folder) toast.success(`Folder "${folder.name}" ready`, { icon: "📅" });
    },
    onError: () => toast.error("Couldn't create folder"),
  });

  const addContactToEvent = useMutation({
    mutationFn: async (contactId: string) => {
      if (!user || !eventId) throw new Error("Not authenticated");
      const { error } = await supabase.from("event_contacts").insert({
        event_id: eventId,
        contact_id: contactId,
        user_id: user.id,
      });
      if (error) throw error;
      // Also assign event folder if it exists
      if (eventFolder) {
        await updateContact(contactId, { folderId: eventFolder.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_detail_contacts", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events_dashboard_counts"] });
      toast.success("Added to event", { icon: "✅" });
    },
    onError: (err: any) => toast.error(err?.message || "Couldn't add contact"),
  });

  const removeFromEvent = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("event_contacts").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_detail_contacts", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events_dashboard_counts"] });
      toast.success("Removed from event");
    },
    onError: () => toast.error("Couldn't remove contact"),
  });

  const initials = (name?: string) =>
    (name || "?").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  const totalCount = contacts.length;

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (contacts as any[]).filter((c) => {
      if (q) {
        const hay = `${c.name || ""} ${c.company || ""} ${c.email || ""} ${c.phone || ""} ${c.title || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (activeFilter) {
        case "email": return !!c.email?.trim();
        case "phone": return !!c.phone?.trim();
        case "linkedin": return !!c.linkedin?.trim();
        case "needs_info": return !c.email?.trim() && !c.phone?.trim();
        default: return true;
      }
    });
  }, [contacts, searchQuery, activeFilter]);

  const filteredCount = filteredContacts.length;
  const isFiltering = searchQuery.trim() !== "" || activeFilter !== "all";

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredContacts.forEach((c: any) => {
      const day = c.linkedAt ? format(new Date(c.linkedAt), "EEEE, MMM d") : "Earlier";
      (map[day] = map[day] || []).push(c);
    });
    return map;
  }, [filteredContacts]);

  const filteredPickerContacts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return (allContacts as any[])
      .filter((c) => !linkedIds.has(c.id))
      .filter((c) => !q || `${c.name} ${c.company} ${c.title}`.toLowerCase().includes(q))
      .slice(0, 100);
  }, [allContacts, linkedIds, pickerSearch]);

  // ─── CSV export (event scope) ───
  const exportContacts = filteredContacts.length > 0 ? filteredContacts : contacts;
  const exportScopeLabel = event ? `${event.title}${isFiltering ? " (filtered)" : ""}` : "Event contacts";

  const buildEventCsv = () => {
    const cols = ["name", "company", "title", "email", "phone", "linkedin"] as const;
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.join(",");
    const rows = (exportContacts as any[]).map((c) => cols.map((k) => esc(c[k])).join(","));
    return [header, ...rows].join("\n");
  };

  const csvFilename = () => {
    const slug = (event?.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "event";
    return `${slug}-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  };

  const handleDownloadCsv = async () => {
    if (exportContacts.length === 0) {
      toast.error("No contacts to export");
      return;
    }
    const csv = buildEventCsv();
    const filename = csvFilename();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

    // Try native share first (best mobile experience)
    try {
      const file = new File([blob], filename, { type: "text/csv" });
      const navAny = navigator as any;
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navAny.share({ files: [file], title: filename, text: `${exportContacts.length} contacts from ${event?.title}` });
        toast.success("Shared", { icon: "📤" });
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${exportContacts.length} contact${exportContacts.length === 1 ? "" : "s"} downloaded`, { icon: "⬇️" });
  };

  const handleEmailCsv = async () => {
    if (exportContacts.length === 0) {
      toast.error("No contacts to export");
      return;
    }
    const raw = exportEmail.trim();
    const recipients = Array.from(
      new Set(
        raw
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = recipients.filter((r) => !emailRe.test(r));
    if (recipients.length === 0 || invalid.length > 0) {
      toast.error(invalid.length ? `Invalid email: ${invalid[0]}` : "Enter at least one email");
      return;
    }
    if (!user) {
      toast.error("Sign in to email exports — try the download instead");
      return;
    }
    setSendingEmail(true);
    setSendStatuses(recipients.map((email) => ({ email, status: "pending" })));
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let sentCount = 0;
    let failedCount = 0;
    for (const recipient of recipients) {
      setSendStatuses((prev) =>
        prev.map((s) => (s.email === recipient ? { ...s, status: "sending" } : s))
      );
      try {
        const { data, error } = await supabase.functions.invoke("quick-export-contacts", {
          body: {
            recipientEmail: recipient,
            contactIds: (exportContacts as any[]).map((c) => c.id),
            scopeLabel: exportScopeLabel,
            timezone: tz,
          },
        });
        if (error) throw new Error(error.message || "Email send failed");
        const d = data as any;
        if (d?.error) throw new Error(d.error);
        sentCount++;
        setSendStatuses((prev) =>
          prev.map((s) =>
            s.email === recipient
              ? {
                  ...s,
                  status: "sent",
                  messageId: d?.messageId ?? null,
                  deliveryMode: d?.deliveryMode,
                }
              : s
          )
        );
      } catch (e: any) {
        failedCount++;
        setSendStatuses((prev) =>
          prev.map((s) =>
            s.email === recipient
              ? { ...s, status: "failed", error: e?.message || "Send failed" }
              : s
          )
        );
      }
    }
    setSendingEmail(false);
    if (sentCount && !failedCount) toast.success(`Sent to ${sentCount} recipient${sentCount === 1 ? "" : "s"}`, { icon: "📧" });
    else if (sentCount && failedCount) toast.warning(`Sent ${sentCount}, failed ${failedCount}`);
    else toast.error(`All ${failedCount} send${failedCount === 1 ? "" : "s"} failed`);
  };

  const openExportSheet = () => {
    setExportEmail(profile?.email || user?.email || "");
    setSendStatuses([]);
    setShowExportSheet(true);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 px-5 pt-5">
        <PageHeader title="Event" back="/app/events" />
        <p className="text-center text-sm text-muted-foreground py-12">Loading…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background pb-24 px-5 pt-5">
        <PageHeader title="Event" back="/app/events" />
        <div className="text-center bg-card border border-border rounded-2xl py-12 px-6">
          <p className="text-sm font-semibold text-foreground mb-1">Event not found</p>
          <p className="text-xs text-muted-foreground mb-4">It may have been deleted.</p>
          <Button onClick={() => navigate("/app/events")}>Back to events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 px-5 pt-5">
      <PageHeader title="Event" back="/app/events" />

      {/* Event header */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
            {event.event_type}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(event.start_date), "MMM d, yyyy")}
            {event.end_date ? ` – ${format(new Date(event.end_date), "MMM d, yyyy")}` : ""}
          </span>
          {isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold">
              <Star size={10} className="fill-current" /> Active
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-foreground">{event.title}</h1>
        {event.location && (
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <MapPin size={13} /> {event.location}
          </p>
        )}
        {event.description && (
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{event.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-muted/40 rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
              <Users size={11} /> Contacts
            </div>
            <div className="text-lg font-bold text-foreground mt-0.5">{totalCount}</div>
          </div>
          <button
            onClick={() => ensureFolder.mutate()}
            disabled={ensureFolder.isPending}
            className="bg-muted/40 hover:bg-muted rounded-xl px-3 py-2.5 text-left transition-colors"
          >
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
              <FolderIcon size={11} /> Card holder
            </div>
            <div className="text-sm font-semibold text-foreground mt-0.5 truncate">
              {eventFolders.length === 0
                ? "Tap to create"
                : eventFolders.length === 1
                ? `📅 ${eventFolders[0].name}`
                : `${eventFolders.length} folders`}
            </div>
          </button>
        </div>

        {/* Active event toggle */}
        <button
          onClick={() => {
            if (isActive) {
              setActiveEventId(null);
              toast("Cleared active event");
            } else {
              setActiveEventId(eventId!);
              toast.success("Set as active event", {
                description: "New scans will auto-tag here.",
                icon: "⭐",
              });
            }
          }}
          className={`w-full mt-3 flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border transition-colors ${
            isActive
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : "bg-background border-border text-foreground hover:bg-muted"
          }`}
        >
          <Star size={14} className={isActive ? "fill-current" : ""} />
          {isActive ? "Active — new scans will land here" : "Set as active event"}
        </button>

        <div className="flex gap-2 mt-3">
          <Button size="sm" className="flex-1" onClick={() => navigate("/app/scan")}>
            <ScanLine size={14} className="mr-1.5" /> Scan
          </Button>
          <Sheet open={showAddPicker} onOpenChange={setShowAddPicker}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1">
                <UserPlus size={14} className="mr-1.5" /> Add
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle className="text-left">Add contacts to {event.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search your contacts…"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-[55vh] overflow-y-auto -mx-2">
                  {filteredPickerContacts.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      {pickerSearch ? "No matches." : "All your contacts are already here."}
                    </p>
                  ) : (
                    filteredPickerContacts.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => addContactToEvent.mutate(c.id)}
                        disabled={addContactToEvent.isPending}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 rounded-xl text-left transition-colors disabled:opacity-50"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                          {initials(c.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[c.title, c.company].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <Check size={16} className="text-primary shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={openExportSheet}
            disabled={totalCount === 0}
          >
            <Download size={14} className="mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* Export sheet */}
      <Sheet open={showExportSheet} onOpenChange={setShowExportSheet}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh]">
          <SheetHeader>
            <SheetTitle className="text-left">Export contacts</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div className="bg-muted/50 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">Exporting</p>
              <p className="text-sm font-semibold text-foreground truncate">{exportScopeLabel}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {exportContacts.length} contact{exportContacts.length === 1 ? "" : "s"} · CSV format
              </p>
            </div>

            <button
              onClick={handleDownloadCsv}
              className="w-full flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl text-left hover:bg-muted/60 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Share2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Download / Share</p>
                <p className="text-[11px] text-muted-foreground">
                  Save to Files, AirDrop, or share via any app on your phone
                </p>
              </div>
            </button>

            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">Email the CSV</p>
              </div>
              <Input
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="recipient@example.com, another@example.com"
                value={exportEmail}
                onChange={(e) => setExportEmail(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Separate multiple recipients with commas. Each is sent its own copy via Resend.
              </p>
              <Button
                className="w-full"
                onClick={handleEmailCsv}
                disabled={sendingEmail || !exportEmail.trim()}
              >
                {sendingEmail ? "Sending…" : "Send via Resend"}
              </Button>

              {sendStatuses.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
                      Send status
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {sendStatuses.filter((s) => s.status === "sent").length} sent ·{" "}
                      {sendStatuses.filter((s) => s.status === "failed").length} failed ·{" "}
                      {sendStatuses.filter((s) => s.status === "pending" || s.status === "sending").length} pending
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {sendStatuses.map((s) => (
                      <li
                        key={s.email}
                        className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-[12px] ${
                          s.status === "sent"
                            ? "bg-emerald-500/5 border-emerald-500/30"
                            : s.status === "failed"
                            ? "bg-destructive/5 border-destructive/30"
                            : "bg-muted/40 border-border"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {s.status === "sent" && (
                            <CheckCircle2 size={14} className="text-emerald-600" />
                          )}
                          {s.status === "failed" && (
                            <AlertCircle size={14} className="text-destructive" />
                          )}
                          {s.status === "sending" && (
                            <Loader2 size={14} className="text-primary animate-spin" />
                          )}
                          {s.status === "pending" && (
                            <Loader2 size={14} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{s.email}</p>
                          {s.status === "sent" && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              Delivered to Resend
                              {s.deliveryMode ? ` · ${s.deliveryMode}` : ""}
                              {s.messageId ? ` · id ${s.messageId.slice(0, 8)}…` : ""}
                            </p>
                          )}
                          {s.status === "failed" && (
                            <p className="text-[10px] text-destructive break-words">
                              {s.error || "Send failed"}
                            </p>
                          )}
                          {s.status === "sending" && (
                            <p className="text-[10px] text-muted-foreground">Sending…</p>
                          )}
                          {s.status === "pending" && (
                            <p className="text-[10px] text-muted-foreground">Queued</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {sendStatuses.some((s) => s.status === "failed") && !sendingEmail && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-1"
                      onClick={() => {
                        const failed = sendStatuses.filter((s) => s.status === "failed").map((s) => s.email);
                        setExportEmail(failed.join(", "));
                      }}
                    >
                      Retry failed
                    </Button>
                  )}
                </div>
              )}

              {!user && (
                <p className="text-[11px] text-muted-foreground">
                  Sign in to email exports. The download option works for everyone.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Card holder — folders linked to this event */}
      <CardHolder
        eventId={eventId!}
        eventTitle={event.title}
        folders={eventFolders}
        onCreate={(name) => createEventFolder.mutate(name)}
        onUnlink={(id) => updateFolder(id, { eventId: undefined })}
        creating={createEventFolder.isPending}
      />

      {/* Contacts list */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Contacts at this event</h2>
        <span className="text-[11px] text-muted-foreground">
          {isFiltering ? `${filteredCount} of ${totalCount}` : `${totalCount} total`}
        </span>
      </div>

      {/* Search + filter chips */}
      {totalCount > 0 && (
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, company, email or phone…"
              className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
            {([
              { key: "all", label: "All" },
              { key: "email", label: "Has email" },
              { key: "phone", label: "Has phone" },
              { key: "linkedin", label: "Has LinkedIn" },
              { key: "needs_info", label: "Needs info" },
            ] as const).map((f) => {
              const active = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {contactsLoading ? (
        <p className="text-center text-sm text-muted-foreground py-8">Loading contacts…</p>
      ) : totalCount === 0 ? (
        <div className="text-center bg-card border border-dashed border-border rounded-2xl py-10 px-6">
          <Search size={24} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No contacts yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Set this as your active event and start scanning, or add existing contacts.
          </p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={() => navigate("/app/scan")}>
              <ScanLine size={14} className="mr-1.5" /> Scan
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddPicker(true)}>
              <UserPlus size={14} className="mr-1.5" /> Add existing
            </Button>
          </div>
        </div>
      ) : filteredCount === 0 ? (
        <div className="text-center bg-card border border-dashed border-border rounded-2xl py-10 px-6">
          <Search size={24} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No matches</p>
          <p className="text-xs text-muted-foreground mb-4">
            Try a different search or clear your filters.
          </p>
          <Button size="sm" variant="outline" onClick={() => { setSearchQuery(""); setActiveFilter("all"); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, list]) => (
            <section key={day}>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {day} · {list.length}
              </h3>
              <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {list.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group">
                    <Link to={`/contact/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      {c.avatar ? (
                        <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                          {initials(c.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.title, c.company].filter(Boolean).join(" · ") || c.email || "—"}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary shrink-0" />
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove ${c.name} from this event?`)) {
                          removeFromEvent.mutate(c.linkId);
                        }
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Remove from event"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventDetail;
