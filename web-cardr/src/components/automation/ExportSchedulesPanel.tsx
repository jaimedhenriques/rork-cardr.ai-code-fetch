import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/ui/empty-state";
import {
  Plus, Mail, Calendar as CalendarIcon, Trash2, Play, Clock,
  ChevronLeft, ChevronRight, X, Check, Users, Columns3, Repeat,
  Eye, History, CheckCircle2, XCircle, AlertCircle, Loader2, Send, Download,
  ArrowUp, ArrowDown, GripVertical, Paperclip, FileText, EyeOff, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { checkScheduleDst } from "@/lib/dstCheck";
import { resolveWizardTimezone } from "@/lib/wizardTimezone";
import CsvPreviewDialog from "@/components/CsvPreviewDialog";
import {
  buildPreviewCountQuery,
  buildPreviewSampleQuery,
  type PreviewRow,
} from "@/lib/exportPreviewQuery";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buildRecipientHeaderPreview } from "@/lib/exportHeadersPreview";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ALL_COLUMNS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "mobile_phone", label: "Mobile phone" },
  { key: "work_phone", label: "Work phone" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "website", label: "Website" },
  { key: "location", label: "Location" },
  { key: "industry", label: "Industry" },
  { key: "company_size", label: "Company size" },
  { key: "notes", label: "Notes" },
  { key: "next_step", label: "Next step" },
  { key: "lead_source", label: "Lead source" },
  { key: "scanned_at", label: "Scanned at" },
  { key: "created_at", label: "Created at" },
];
const DEFAULT_COLUMNS = ["name", "title", "company", "email", "phone", "linkedin"];

interface ExportSchedule {
  id: string;
  name: string;
  recipient_email: string;
  recipient_emails: string[] | null;
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  frequency: "daily" | "weekly";
  day_of_week: number | null;
  hour_utc: number;
  timezone: string | null;
  folder_id: string | null;
  event_id: string | null;
  days_back: number | null;
  date_from: string | null;
  date_to: string | null;
  contact_ids: string[] | null;
  columns: string[] | null;
  delivery_mode: "inline" | "attachment" | null;
  attachment_max_kb: number | null;
  attachment_zip_threshold_kb: number | null;
  tag_ids: string[] | null;
  statuses: string[] | null;
  search_query: string | null;
  enabled: boolean;
  last_run_at: string | null;
}

export default function ExportSchedulesPanel() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [previewFor, setPreviewFor] = useState<ExportSchedule | null>(null);
  const [previewData, setPreviewData] = useState<{ csv: string; rowCount: number; rangeLabel: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [historyFor, setHistoryFor] = useState<ExportSchedule | null>(null);
  // Confirmation gate before sending a test email — avoids accidental
  // duplicates when the user double-taps the Send button.
  const [confirmTestFor, setConfirmTestFor] = useState<ExportSchedule | null>(null);
  // Track when the last test was fired per-schedule so we can warn the user
  // if they're about to re-send within 30s.
  const [lastTestAt, setLastTestAt] = useState<Record<string, number>>({});
  // Current user's email — shown on test buttons and run rows so the user
  // knows exactly which inbox will receive the test message.
  const [myEmail, setMyEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyEmail(data.user?.email ?? null));
  }, []);

  const openPreview = async (s: ExportSchedule) => {
    setPreviewFor(s);
    setPreviewData(null);
    setPreviewLoading(true);
    const { data, error } = await supabase.functions.invoke("run-export-schedule", {
      body: { scheduleId: s.id, preview: true },
    });
    setPreviewLoading(false);
    if (error || !data?.ok) {
      toast.error(error?.message ?? data?.error ?? "Failed to build preview");
      setPreviewFor(null);
      return;
    }
    setPreviewData({ csv: data.csv ?? "", rowCount: data.contactCount ?? 0, rangeLabel: data.rangeLabel ?? "" });
  };

  const downloadPreview = () => {
    if (!previewData || !previewFor) return;
    const blob = new Blob([previewData.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${previewFor.name.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["export-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_schedules" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExportSchedule[];
    },
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders-for-export"],
    queryFn: async () => {
      const { data } = await supabase.from("folders").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags-for-export"],
    queryFn: async () => {
      const { data } = await supabase.from("tags").select("id,name,color").order("name");
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-for-export"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,start_date,status")
        .order("start_date", { ascending: false });
      return data ?? [];
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("export_schedules" as any).update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["export-schedules"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("export_schedules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["export-schedules"] });
      toast.success("Schedule deleted");
    },
  });

  const runNow = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("run-export-schedule", {
        body: { scheduleId: id, manual: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Email sent — ${data?.contactCount ?? 0} contacts exported`);
      qc.invalidateQueries({ queryKey: ["export-schedules"] });
      qc.invalidateQueries({ queryKey: ["export-schedule-runs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send export"),
  });

  const testNow = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const myEmail = userData.user?.email;
      if (!myEmail) throw new Error("No email on your account");
      const { data, error } = await supabase.functions.invoke("run-export-schedule", {
        body: { scheduleId: id, manual: true, testEmail: myEmail },
      });
      if (error) throw error;
      return { ...data, myEmail };
    },
    onSuccess: (data: any, scheduleId) => {
      toast.success(`🧪 Test sent to ${data.myEmail} — ${data?.contactCount ?? 0} contacts`);
      setLastTestAt((prev) => ({ ...prev, [scheduleId]: Date.now() }));
      qc.invalidateQueries({ queryKey: ["export-schedule-runs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send test"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button size="sm"><Plus className="size-4" /> New schedule</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Set up CSV export</SheetTitle>
            </SheetHeader>
            <ScheduleSetupWizard
              folders={folders as any}
              events={events as any}
              onSaved={() => {
                setCreateOpen(false);
                qc.invalidateQueries({ queryKey: ["export-schedules"] });
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No scheduled exports"
          description="Get a CSV of your contacts emailed automatically every day or week."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create schedule</Button>}
        />
      ) : (
        schedules.map((s) => {
          const folder = (folders as any[]).find((f) => f.id === s.folder_id);
          const event = (events as any[]).find((e) => e.id === s.event_id);
          const recipients = s.recipient_emails?.length ? s.recipient_emails : [s.recipient_email];
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{s.name}</h3>
                    <Badge variant="outline" className="capitalize">{s.frequency}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {s.delivery_mode === "attachment" ? "📎 Attachment" : "📄 Inline"}
                    </Badge>
                    {!s.enabled && <Badge variant="secondary">Paused</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    <Mail className="size-3 inline mr-1" />{recipients.join(", ")}
                    {s.cc_emails?.length ? <span className="ml-2">· cc: {s.cc_emails.join(", ")}</span> : null}
                    {s.bcc_emails?.length ? <span className="ml-2">· bcc: {s.bcc_emails.length}</span> : null}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {s.frequency === "weekly" ? `${DAYS[s.day_of_week ?? 0]} ` : "Daily "}
                      {String(s.hour_utc).padStart(2, "0")}:00 {s.timezone || "UTC"}
                    </span>
                    {folder && <span>📁 {folder.emoji} {folder.name}</span>}
                    {event && <span>🎫 {event.title}</span>}
                    {s.contact_ids?.length ? <span>👤 {s.contact_ids.length} selected</span> : null}
                    {(s.date_from || s.date_to) ? (
                      <span>📅 {s.date_from ?? "…"} → {s.date_to ?? "…"}</span>
                    ) : s.days_back ? (
                      <span>📅 last {s.days_back}d</span>
                    ) : null}
                    {s.columns?.length ? <span>📊 {s.columns.length} cols</span> : null}
                    {s.tag_ids?.length ? <span>🏷 {s.tag_ids.length} tag{s.tag_ids.length === 1 ? "" : "s"}</span> : null}
                    {s.statuses?.length ? <span>🗂 {s.statuses.join(", ")}</span> : null}
                    {s.search_query ? <span>🔍 "{s.search_query}"</span> : null}
                    {s.last_run_at && <span>· last run {format(new Date(s.last_run_at), "MMM d, HH:mm")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={(v) => toggleEnabled.mutate({ id: s.id, enabled: v })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => openPreview(s)} title="Preview next CSV">
                    <Eye className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setHistoryFor(s)} title="Send history">
                    <History className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirmTestFor(s)} disabled={testNow.isPending} title={myEmail ? `Send a test email to ${myEmail}` : "Send a test email to me"}>
                    {testNow.isPending && testNow.variables === s.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => runNow.mutate(s.id)} disabled={runNow.isPending} title="Run now (send to all recipients)">
                    <Play className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)} title="Delete">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <LastRunStatusPanel scheduleId={s.id} onOpenHistory={() => setHistoryFor(s)} />
            </Card>
          );
        })
      )}

      <Dialog open={!!previewFor && previewLoading} onOpenChange={(v) => !v && setPreviewFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Building preview…
            </DialogTitle>
            <DialogDescription>Fetching contacts that would be included in the next export.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {previewFor && previewData && (
        <CsvPreviewDialog
          open={!!previewData}
          onOpenChange={(v) => { if (!v) { setPreviewFor(null); setPreviewData(null); } }}
          csv={previewData.csv}
          filename={`${previewFor.name}.csv`}
          rowCount={previewData.rowCount}
          onConfirmDownload={downloadPreview}
        />
      )}

      <SendHistoryDialog schedule={historyFor} onClose={() => setHistoryFor(null)} myEmail={myEmail} />

      <AlertDialog open={!!confirmTestFor} onOpenChange={(v) => !v && setConfirmTestFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-primary" /> Send a test email to yourself?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This will send a one-off test of{" "}
                  <span className="font-medium text-foreground">{confirmTestFor?.name}</span>{" "}
                  to{" "}
                  <span className="font-mono text-foreground">{myEmail ?? "your account email"}</span>{" "}
                  — only to you, not to the configured recipients.
                </p>
                {confirmTestFor && lastTestAt[confirmTestFor.id] &&
                  Date.now() - lastTestAt[confirmTestFor.id] < 30_000 && (
                    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                      ⚠ You sent another test for this schedule{" "}
                      {Math.round((Date.now() - lastTestAt[confirmTestFor.id]) / 1000)}s ago.
                      Sending again will deliver a duplicate.
                    </p>
                  )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTestFor) testNow.mutate(confirmTestFor.id);
                setConfirmTestFor(null);
              }}
            >
              <Send className="size-3.5" /> Send test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SendHistoryDialog({
  schedule,
  onClose,
  myEmail,
}: { schedule: ExportSchedule | null; onClose: () => void; myEmail: string | null }) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastTestAt, setLastTestAt] = useState<number | null>(null);
  const { data: runs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["export-schedule-runs", schedule?.id],
    enabled: !!schedule,
    refetchInterval: schedule ? 5000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_schedule_runs" as any)
        .select("*")
        .eq("schedule_id", schedule!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Header-invariant suppression audits scoped to this schedule. Each row
  // represents one delivery where X-Original-To/Cc were dropped to prevent
  // a Bcc leak (see HEADERS.md, invariants P2/P3). We surface a summary
  // banner so users notice when the privacy guard fired and can see exactly
  // which rules were violated, even when individual offenders are Bcc-masked.
  const { data: audits = [] } = useQuery({
    queryKey: ["export-schedule-audits", schedule?.id],
    enabled: !!schedule,
    refetchInterval: schedule ? 5000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_header_suppression_audits" as any)
        .select("id,run_id,bcc_recipient,conflicting_addresses,reason,invariant,created_at")
        .eq("schedule_id", schedule!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as unknown) as Array<{
        id: string;
        run_id: string | null;
        bcc_recipient: string;
        conflicting_addresses: string[];
        reason: string;
        invariant: string;
        created_at: string;
      }>;
    },
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      if (!schedule) throw new Error("No schedule");
      const { data: userData } = await supabase.auth.getUser();
      const myEmail = userData.user?.email;
      if (!myEmail) throw new Error("No email on your account");
      const { data, error } = await supabase.functions.invoke("run-export-schedule", {
        body: { scheduleId: schedule.id, manual: true, testEmail: myEmail },
      });
      if (error) throw error;
      return { ...data, myEmail };
    },
    onSuccess: (data: any) => {
      toast.success(`🧪 Test sent to ${data.myEmail}`);
      setLastTestAt(Date.now());
      qc.invalidateQueries({ queryKey: ["export-schedule-runs", schedule?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send test"),
  });

  // Per-run CSV download — fetches a short-lived signed URL from private
  // storage and triggers the browser download. Useful for inspecting the
  // exact CSV that was generated, especially on failed/partial runs.
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null);
  const downloadRunCsv = async (csvPath: string | null | undefined, runId: string) => {
    if (!csvPath) return;
    setDownloadingRunId(runId);
    try {
      const { data, error } = await supabase.storage
        .from("csv-exports")
        .createSignedUrl(csvPath, 60, { download: csvPath.split("/").pop() ?? "export.csv" });
      if (error || !data?.signedUrl) throw error ?? new Error("Could not create download link");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.rel = "noopener";
      a.click();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to download CSV");
    } finally {
      setDownloadingRunId(null);
    }
  };

  // Per-run "Email link" — generates a longer-lived signed URL (24h) for the
  // same private CSV and opens the user's mail client with it pre-filled.
  // Lets the user forward the same private download link the existing button
  // uses to a teammate (or themselves on another device).
  const [emailingRunId, setEmailingRunId] = useState<string | null>(null);
  const emailRunCsv = async (
    csvPath: string | null | undefined,
    runId: string,
    createdAt: string,
  ) => {
    if (!csvPath) return;
    setEmailingRunId(runId);
    try {
      const filename = csvPath.split("/").pop() ?? "export.csv";
      const { data, error } = await supabase.storage
        .from("csv-exports")
        .createSignedUrl(csvPath, 60 * 60 * 24, { download: filename });
      if (error || !data?.signedUrl) throw error ?? new Error("Could not create download link");

      const scheduleName = schedule?.name ?? "CSV export";
      const runDate = format(new Date(createdAt), "MMM d, yyyy 'at' HH:mm");
      const subject = `CSV export: ${scheduleName} (${runDate})`;
      const body =
        `Hi,\n\n` +
        `Here is the CSV export for "${scheduleName}" generated on ${runDate}.\n\n` +
        `Download (link valid for 24 hours):\n${data.signedUrl}\n\n` +
        `File: ${filename}\n`;

      try {
        await navigator.clipboard.writeText(data.signedUrl);
      } catch {
        // clipboard may be unavailable; non-fatal
      }

      const mailto = `mailto:${myEmail ? encodeURIComponent(myEmail) : ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      toast.success("Opened your email app · download link copied to clipboard");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to prepare email");
    } finally {
      setEmailingRunId(null);
    }
  };

  // Export the visible run history as a CSV for offline auditing.
  // Includes status, timestamps, contact/recipient counts, range, manual flag,
  // error message, and storage path of the generated CSV (if any).
  const exportHistoryToCsv = () => {
    if (!schedule || runs.length === 0) return;
    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      "run_id", "created_at_iso", "created_at_local", "status", "manual",
      "contact_count", "recipient_count", "range_label", "error_message", "csv_path",
    ];
    const lines = [headers.join(",")];
    for (const r of runs) {
      lines.push([
        r.id,
        r.created_at,
        format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
        r.status,
        r.manual ? "true" : "false",
        r.contact_count ?? 0,
        r.recipient_count ?? 0,
        r.range_label ?? "",
        r.error_message ?? "",
        r.csv_path ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = schedule.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "schedule";
    a.download = `${slug}_history_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${runs.length} run${runs.length === 1 ? "" : "s"} to CSV`);
  };

  return (
    <Dialog open={!!schedule} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" /> Send history
          </DialogTitle>
          <DialogDescription>
            Last 50 runs of <span className="font-medium text-foreground">{schedule?.name}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 pb-2">
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={sendTest.isPending} title={myEmail ? `Send test to ${myEmail}` : undefined}>
            {sendTest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span>Test email to {myEmail ?? "me"}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Repeat className="size-4" />}
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportHistoryToCsv}
            disabled={runs.length === 0}
            title="Download this run history as a CSV for auditing"
            className="ml-auto"
          >
            <Download className="size-4" />
            Export history
          </Button>
        </div>
        {audits.length > 0 && (() => {
          // Group audits by invariant rule, count affected deliveries, and
          // surface the distinct Bcc-mailbox count without revealing addresses.
          const byInvariant = new Map<string, number>();
          const distinctBcc = new Set<string>();
          const affectedRuns = new Set<string>();
          for (const a of audits) {
            byInvariant.set(a.invariant, (byInvariant.get(a.invariant) ?? 0) + 1);
            distinctBcc.add(a.bcc_recipient.trim().toLowerCase());
            if (a.run_id) affectedRuns.add(a.run_id);
          }
          // Human-readable label for each known invariant ID — falls back to
          // the raw identifier so future invariants still render usefully.
          const ruleLabel = (id: string): string => {
            switch (id) {
              case "bcc_in_to_or_cc":
                return "Bcc address also in To/Cc — visible headers suppressed";
              default:
                return id;
            }
          };
          return (
            <Alert variant="destructive" className="mb-3 border-destructive/40 bg-destructive/5">
              <ShieldAlert className="size-4" />
              <AlertTitle className="flex items-center gap-2 flex-wrap">
                Header invariant violations
                <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive bg-destructive/10">
                  {audits.length} deliver{audits.length === 1 ? "y" : "ies"} affected
                </Badge>
                <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive bg-destructive/10 gap-1">
                  <EyeOff className="size-2.5" />
                  {distinctBcc.size} Bcc mailbox{distinctBcc.size === 1 ? "" : "es"}
                </Badge>
                <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive bg-destructive/10">
                  {affectedRuns.size} run{affectedRuns.size === 1 ? "" : "s"}
                </Badge>
              </AlertTitle>
              <AlertDescription className="space-y-1.5 mt-1">
                <p className="text-xs">
                  X-Original-To / X-Original-Cc were dropped on the deliveries
                  below to prevent a Bcc leak. Fix the schedule's recipient
                  lists so no Bcc address appears in To or Cc.
                </p>
                <ul className="text-xs space-y-1 mt-1">
                  {Array.from(byInvariant.entries()).map(([rule, count]) => (
                    <li key={rule} className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-destructive/40 text-destructive bg-background shrink-0"
                      >
                        {rule}
                      </Badge>
                      <span className="break-words">
                        {ruleLabel(rule)}
                        <span className="text-muted-foreground"> · {count} deliver{count === 1 ? "y" : "ies"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          );
        })()}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No runs yet. Send a test or hit "Run now" to verify delivery.</p>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {runs.map((r) => {
                const Icon = r.status === "success" ? CheckCircle2 : r.status === "partial" ? AlertCircle : XCircle;
                const colorClass =
                  r.status === "success" ? "text-emerald-600 dark:text-emerald-400"
                  : r.status === "partial" ? "text-amber-600 dark:text-amber-400"
                  : "text-destructive";
                return (
                  <div key={r.id} className="p-3 flex items-start gap-3">
                    <Icon className={cn("size-5 shrink-0 mt-0.5", colorClass)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("capitalize", colorClass)}>{r.status}</Badge>
                        {r.manual && <Badge variant="secondary" className="text-[10px]">Manual</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "MMM d, yyyy 'at' HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">
                        {r.contact_count} contact{r.contact_count === 1 ? "" : "s"} · {r.recipient_count} recipient{r.recipient_count === 1 ? "" : "s"}
                        {r.range_label ? <span className="text-muted-foreground"> · {r.range_label}</span> : null}
                      </p>
                      {r.manual && r.recipient_count === 1 && myEmail && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          🧪 Test sent to <span className="font-mono text-foreground">{myEmail}</span>
                        </p>
                      )}
                      {r.error_message && (
                        <p className="text-xs text-destructive mt-1 break-words">⚠ {r.error_message}</p>
                      )}
                      {r.csv_path && (
                        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => downloadRunCsv(r.csv_path, r.id)}
                            disabled={downloadingRunId === r.id}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60"
                            title="Download the CSV that was generated for this run"
                          >
                            {downloadingRunId === r.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Download className="size-3" />
                            )}
                            Download CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => emailRunCsv(r.csv_path, r.id, r.created_at)}
                            disabled={emailingRunId === r.id}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60"
                            title="Open your email app with the private download link pre-filled (link valid 24h, also copied to clipboard)"
                          >
                            {emailingRunId === r.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Mail className="size-3" />
                            )}
                            Email link
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-primary" /> Send a test email to yourself?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This sends a one-off test of{" "}
                  <span className="font-medium text-foreground">{schedule?.name}</span>{" "}
                  to{" "}
                  <span className="font-mono text-foreground">{myEmail ?? "your account email"}</span>{" "}
                  — only to you, not the configured recipients.
                </p>
                {lastTestAt && Date.now() - lastTestAt < 30_000 && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                    ⚠ You sent another test {Math.round((Date.now() - lastTestAt) / 1000)}s ago.
                    Sending again will deliver a duplicate.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { sendTest.mutate(); setConfirmOpen(false); }}
            >
              <Send className="size-3.5" /> Send test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS: { title: string; icon: any }[] = [
  { title: "Frequency", icon: Repeat },
  { title: "Recipients", icon: Mail },
  { title: "Contacts", icon: Users },
  { title: "Columns", icon: Columns3 },
  { title: "Preview", icon: Eye },
];

function ScheduleSetupWizard({
  folders,
  events,
  onSaved,
}: {
  folders: { id: string; name: string; emoji: string }[];
  events: { id: string; title: string; start_date: string; status: string }[];
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);

  // Step 1 — Frequency
  const [name, setName] = useState("Weekly contacts export");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [hourUtc, setHourUtc] = useState<number>(9);
  const browserTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  }, []);

  // Per-user default timezone for new schedules. When the user toggles
  // "Use my default" off, they can override it just for this one schedule.
  const queryClient = useQueryClient();
  const { data: defaultTzPref } = useQuery({
    queryKey: ["profile-default-export-tz"],
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("default_export_timezone")
        .eq("id", userId)
        .maybeSingle();
      return (data?.default_export_timezone as string | null) ?? null;
    },
  });
  const effectiveDefaultTz = defaultTzPref ?? browserTz;

  // `useMyDefault` is the override toggle. ON ⇒ timezone is locked to the
  // user's profile default. OFF ⇒ user picks any timezone for this schedule
  // only. Both values are persisted to localStorage so reopening the wizard
  // (and back/forward step navigation) restores the last selection.
  // NOTE: loadedPrefs is read inside the initialisers below — it's defined
  // further down in the file but available at render time via closure.
  const readPersistedTz = (): { tz: string | null; useDefault: boolean } => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("cardr.exportSchedules.previewPrefs.v1") : null;
      if (!raw) return { tz: null, useDefault: true };
      const parsed = JSON.parse(raw) as { timezone?: string | null; useMyDefault?: boolean };
      return {
        tz: typeof parsed.timezone === "string" ? parsed.timezone : null,
        useDefault: typeof parsed.useMyDefault === "boolean" ? parsed.useMyDefault : true,
      };
    } catch { return { tz: null, useDefault: true }; }
  };
  const persisted = useMemo(readPersistedTz, []);
  const [useMyDefault, setUseMyDefault] = useState(persisted.useDefault);
  const [timezone, setTimezone] = useState<string>(persisted.tz ?? effectiveDefaultTz);
  const [tzInitialised, setTzInitialised] = useState(false);
  // Until the profile resolves we keep the picker in sync. After init, we
  // only auto-update while the user is still in "use default" mode AND no
  // explicit override is persisted — once they override, their choice wins.
  useEffect(() => {
    if (!tzInitialised) {
      // If nothing was persisted, fall back to the resolved default.
      if (!persisted.tz) setTimezone(effectiveDefaultTz);
      setTzInitialised(true);
      return;
    }
    if (useMyDefault) setTimezone(effectiveDefaultTz);
  }, [effectiveDefaultTz, useMyDefault, tzInitialised, persisted.tz]);

  const saveTzAsDefault = async () => {
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) { toast.error("You must be signed in."); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ default_export_timezone: timezone })
      .eq("id", userId);
    if (error) { toast.error(`Couldn't save default: ${error.message}`); return; }
    toast.success(`${timezone} is now your default export timezone.`);
    queryClient.setQueryData(["profile-default-export-tz"], timezone);
    setUseMyDefault(true);
  };

  // Step 2 — Recipients
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [bccRecipients, setBccRecipients] = useState<string[]>([]);
  const [bccInput, setBccInput] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  // ── Persist & restore last preview parameters ──────────────────────────────
  // Folder, date range and column choices are remembered across wizard sessions
  // so reopening picks up exactly where you left off.
  const PREVIEW_PREFS_KEY = "cardr.exportSchedules.previewPrefs.v1";
  type PreviewPrefs = {
    selectionMode: "all" | "folder" | "event" | "range" | "manual";
    folderId: string;
    eventId: string;
    rangeMode: "rolling" | "custom";
    daysBack: string;
    dateFrom: string | null; // ISO date (yyyy-MM-dd)
    dateTo: string | null;
    columns: string[];
    timezone: string | null;
    useMyDefault: boolean;
  };
  const loadedPrefs = useMemo<Partial<PreviewPrefs>>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(PREVIEW_PREFS_KEY) : null;
      return raw ? (JSON.parse(raw) as Partial<PreviewPrefs>) : {};
    } catch { return {}; }
  }, []);
  const parseStoredDate = (s: string | null | undefined): Date | undefined => {
    if (!s) return undefined;
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  };

  // Step 3 — Contact selection (initialised from saved preview prefs when present)
  const [selectionMode, setSelectionMode] = useState<"all" | "folder" | "event" | "range" | "manual">(
    loadedPrefs.selectionMode === "manual" ? "all" : (loadedPrefs.selectionMode ?? "all"),
  );
  const [folderId, setFolderId] = useState<string>(loadedPrefs.folderId ?? "all");
  const [eventId, setEventId] = useState<string>(loadedPrefs.eventId ?? "");
  const [rangeMode, setRangeMode] = useState<"rolling" | "custom">(loadedPrefs.rangeMode ?? "rolling");
  const [daysBack, setDaysBack] = useState<string>(loadedPrefs.daysBack ?? "7");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(parseStoredDate(loadedPrefs.dateFrom));
  const [dateTo, setDateTo] = useState<Date | undefined>(parseStoredDate(loadedPrefs.dateTo));
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Step 3 — Additional filters (apply on top of selection mode, except "manual")
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: tags = [] } = useQuery({
    queryKey: ["tags-for-export-wizard"],
    queryFn: async () => {
      const { data } = await supabase.from("tags").select("id,name,color").order("name");
      return (data ?? []) as { id: string; name: string; color: string | null }[];
    },
  });

  // Step 4 — Columns (restored from saved prefs, falling back to defaults)
  const [columns, setColumns] = useState<string[]>(() => {
    const saved = loadedPrefs.columns;
    if (Array.isArray(saved) && saved.length > 0) return saved.filter((c) => typeof c === "string");
    return DEFAULT_COLUMNS;
  });

  // Persist preview-relevant fields whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const toIsoDateLocal = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : null);
    const prefs: PreviewPrefs = {
      selectionMode,
      folderId,
      eventId,
      rangeMode,
      daysBack,
      dateFrom: toIsoDateLocal(dateFrom),
      dateTo: toIsoDateLocal(dateTo),
      columns,
      timezone,
      useMyDefault,
    };
    try { window.localStorage.setItem(PREVIEW_PREFS_KEY, JSON.stringify(prefs)); } catch { /* quota / private mode */ }
  }, [selectionMode, folderId, eventId, rangeMode, daysBack, dateFrom, dateTo, columns, timezone, useMyDefault]);


  // Delivery mode (chosen on Frequency step). Preselects the user's last
  // saved choice so repeat schedule creation is one click faster. Falls back
  // to "attachment" for first-time users / private-mode storage failures.
  const DELIVERY_MODE_PREF_KEY = "cardr.exportSchedules.lastDeliveryMode.v1";
  const [deliveryMode, setDeliveryMode] = useState<"inline" | "attachment">(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(DELIVERY_MODE_PREF_KEY) : null;
      return raw === "inline" || raw === "attachment" ? raw : "attachment";
    } catch {
      return "attachment";
    }
  });
  // Per-schedule cap (KB) — when the generated CSV exceeds this, the run
  // automatically falls back to inline / download-link delivery instead of
  // attaching. Empty string = no per-schedule cap (only the global 18 MB
  // Resend limit applies). Stored as string in form state so the user can
  // type freely; coerced to number on save.
  const [attachmentMaxKbInput, setAttachmentMaxKbInput] = useState<string>("");
  // Per-schedule "zip when above N KB" — when the raw CSV exceeds this,
  // the run compresses it into a .zip before attaching. Must be smaller
  // than the cap above (validated server-side too) so the zip path runs
  // BEFORE the cap-based downgrade kicks in.
  const [attachmentZipThresholdKbInput, setAttachmentZipThresholdKbInput] = useState<string>("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email && recipients.length === 0) setRecipients([data.user.email]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: contactList = [] } = useQuery({
    queryKey: ["contacts-for-export-pick", contactSearch],
    enabled: selectionMode === "manual",
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("id,name,email,company")
        .order("name")
        .limit(200);
      if (contactSearch.trim()) {
        q = q.ilike("name", `%${contactSearch.trim()}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const ROLE_LABEL: Record<"to" | "cc" | "bcc", string> = { to: "To", cc: "CC", bcc: "BCC" };

  /**
   * Normalise a single raw email token before comparison/storage.
   *
   * The CC field in particular silently drops recipients when the user
   * pastes addresses that *look* the same but differ in casing, surrounding
   * whitespace, zero-width characters, an angle-bracket display form
   * (`"Alice" <alice@x.com>`), or a `mailto:` prefix from a copy out of a
   * mail client. Centralising the cleanup here means the dedup check, the
   * stored chip, and the saved payload all see the same canonical string.
   */
  const normalizeEmailToken = (raw: string): string => {
    let v = raw
      // Strip BOM + zero-width chars that survive copy/paste from web pages.
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      // Collapse all whitespace (incl. NBSP / tabs) — emails can't contain it.
      .replace(/\s+/g, "")
      // Drop `mailto:` prefix from clipboard imports.
      .replace(/^mailto:/i, "")
      // Drop trailing punctuation left over from list separators.
      .replace(/[,;<>]+$/g, "")
      .replace(/^[<,;]+/, "");
    // Pull the address out of "Name <addr@x>" if that's what was pasted.
    const angle = v.match(/<([^>]+)>$/);
    if (angle) v = angle[1];
    return v;
  };

  /**
   * Split a raw input string on any common email separator (comma, semicolon,
   * newline, tab, whitespace between angle-bracket forms) and normalise each
   * piece. Returns the cleaned tokens, dropping empties.
   */
  const splitRecipientsInput = (raw: string): string[] => {
    if (!raw) return [];
    return raw
      .split(/[,;\n\r\t]+/)
      .map((t) => normalizeEmailToken(t))
      .filter((t) => t.length > 0);
  };

  /**
   * Add one or more recipients in a single call, returning a summary the
   * UI can surface to the user. Catches the silent-drop cases that the
   * single-entry adder used to swallow:
   *   - pasted lists separated by `,` `;` newlines, etc.
   *   - case-only / whitespace-only duplicates (kept as one canonical entry)
   *   - cross-role collisions (e.g. CC entry already in TO)
   */
  type AddOutcome = {
    added: string[];
    invalid: string[];
    duplicatesInList: string[];
    crossRoleConflicts: { email: string; existingRole: "to" | "cc" | "bcc" }[];
  };

  const makeAdder = (
    role: "to" | "cc" | "bcc",
    list: string[],
    setList: (fn: (r: string[]) => string[]) => void,
    setInput: (v: string) => void,
  ) => (raw: string): AddOutcome => {
    const outcome: AddOutcome = {
      added: [], invalid: [], duplicatesInList: [], crossRoleConflicts: [],
    };
    const tokens = splitRecipientsInput(raw);
    if (tokens.length === 0) {
      // Empty add (e.g. lone Enter) — leave the input alone, do nothing.
      return outcome;
    }

    // Build canonical sets we can extend as we accept new tokens, so a paste
    // that contains the same address twice (with different casing) is only
    // added once.
    const canon = (s: string) => s.toLowerCase();
    const toSet = new Set(recipients.map(canon));
    const ccSet = new Set(ccRecipients.map(canon));
    const bccSet = new Set(bccRecipients.map(canon));
    const acceptedThisBatch = new Set<string>();

    for (const v of tokens) {
      if (!isEmail(v)) { outcome.invalid.push(v); continue; }
      const k = canon(v);
      const inTo = toSet.has(k);
      const inCc = ccSet.has(k);
      const inBcc = bccSet.has(k);
      const existingRole: "to" | "cc" | "bcc" | null =
        inTo ? "to" : inCc ? "cc" : inBcc ? "bcc" : null;

      if (existingRole && existingRole !== role) {
        outcome.crossRoleConflicts.push({ email: v, existingRole });
        continue;
      }
      if (existingRole === role || acceptedThisBatch.has(k)) {
        outcome.duplicatesInList.push(v);
        continue;
      }
      acceptedThisBatch.add(k);
      // Reflect into the role's own set so two same-role dupes in one paste
      // don't both pass.
      if (role === "to") toSet.add(k);
      else if (role === "cc") ccSet.add(k);
      else bccSet.add(k);
      outcome.added.push(v);
    }

    if (outcome.added.length > 0) {
      setList((r) => [...r, ...outcome.added]);
    }

    // Surface the summary as toasts so the user notices silently-dropped
    // entries — especially CC, which the user explicitly called out.
    const roleLbl = ROLE_LABEL[role];
    if (outcome.added.length > 0 && tokens.length > 1) {
      toast.success(`Added ${outcome.added.length} ${roleLbl} recipient${outcome.added.length === 1 ? "" : "s"}`);
    }
    if (outcome.invalid.length > 0) {
      toast.error(
        `Skipped ${outcome.invalid.length} invalid ${roleLbl} email${outcome.invalid.length === 1 ? "" : "s"}: ${outcome.invalid.slice(0, 3).join(", ")}${outcome.invalid.length > 3 ? "…" : ""}`,
      );
    }
    if (outcome.duplicatesInList.length > 0) {
      toast.warning(
        `Skipped ${outcome.duplicatesInList.length} duplicate ${roleLbl} entr${outcome.duplicatesInList.length === 1 ? "y" : "ies"} (case/whitespace only): ${outcome.duplicatesInList.slice(0, 3).join(", ")}${outcome.duplicatesInList.length > 3 ? "…" : ""}`,
      );
    }
    if (outcome.crossRoleConflicts.length > 0) {
      const first = outcome.crossRoleConflicts[0];
      toast.warning(
        `${first.email} is already in ${ROLE_LABEL[first.existingRole]}${outcome.crossRoleConflicts.length > 1 ? ` (+${outcome.crossRoleConflicts.length - 1} more)` : ""} — remove it there first to add it to ${roleLbl}.`,
      );
    }

    // Keep any tokens we rejected in the input so the user can fix them
    // in place; clear the input only if everything was accepted.
    const leftovers = [...outcome.invalid];
    setInput(leftovers.join(", "));
    return outcome;
  };
  const addRecipient = makeAdder("to", recipients, setRecipients, setRecipientInput);
  const addCc = makeAdder("cc", ccRecipients, setCcRecipients, setCcInput);
  const addBcc = makeAdder("bcc", bccRecipients, setBccRecipients, setBccInput);

  // ── Validation: recipients ───────────────────────────────────────────────
  const invalidRecipients = useMemo(
    () => [...recipients, ...ccRecipients, ...bccRecipients].filter((e) => !isEmail(e)),
    [recipients, ccRecipients, bccRecipients],
  );
  const dupRecipients = useMemo(() => {
    const all = [...recipients, ...ccRecipients, ...bccRecipients].map((e) => e.trim().toLowerCase());
    const seen = new Set<string>(); const dups = new Set<string>();
    for (const e of all) { if (seen.has(e)) dups.add(e); else seen.add(e); }
    return Array.from(dups);
  }, [recipients, ccRecipients, bccRecipients]);
  // ── Role-conflict detection (BCC privacy guard) ──────────────────────────
  // Surface immediate per-pair warnings so the user knows WHY a duplicate is
  // a problem (BCC leaks if mirrored in To/CC). Same address in To+CC is a
  // softer conflict but still flagged separately.
  const roleConflicts = useMemo(() => {
    const toSet = new Set(recipients.map((e) => e.trim().toLowerCase()).filter(Boolean));
    const ccSet = new Set(ccRecipients.map((e) => e.trim().toLowerCase()).filter(Boolean));
    const bccSet = new Set(bccRecipients.map((e) => e.trim().toLowerCase()).filter(Boolean));
    const intersect = (a: Set<string>, b: Set<string>) =>
      Array.from(a).filter((v) => b.has(v));
    return {
      toBcc: intersect(toSet, bccSet),
      ccBcc: intersect(ccSet, bccSet),
      toCc: intersect(toSet, ccSet),
    };
  }, [recipients, ccRecipients, bccRecipients]);
  const hasBccConflict = roleConflicts.toBcc.length > 0 || roleConflicts.ccBcc.length > 0;
  // Per-recipient header preview — mirrors the safeHeadersForDelivery
  // logic in the run-export-schedule edge function so the user sees the
  // exact To/Cc rows each recipient role will receive before saving.
  const headerPreviewRows = useMemo(
    () =>
      buildRecipientHeaderPreview({
        toRecipients: recipients,
        ccRecipients: ccRecipients,
        bccRecipients: bccRecipients,
      }),
    [recipients, ccRecipients, bccRecipients],
  );

  /**
   * Pre-flight header-invariant validation. Mirrors the runtime checks in
   * `safeHeadersForDelivery` (run-export-schedule edge function) so we can
   * BLOCK schedule creation when any delivery would either:
   *
   *   - leak a BCC address (BCC recipient also in To/Cc → headers suppressed
   *     at send time, P2/P3 in HEADERS.md), or
   *   - render with no visible context at all (To list empty AND Cc list
   *     empty → P4: a Bcc-only schedule produces null headers, which most
   *     mail clients treat as "Undisclosed recipients" and many spam
   *     filters score harshly).
   *
   * The wizard surfaces both as inline alerts AND as a hard gate on canNext
   * so the user can't advance past Recipients (or hit Create) until each
   * violation is resolved.
   */
  const headerInvariantViolations = useMemo(() => {
    // Missing visible context: every delivery would render with empty
    // To/Cc rows. Only check once the user has actually entered recipients
    // — an empty form is a different (existing) error.
    const hasAnyRecipient =
      recipients.length + ccRecipients.length + bccRecipients.length > 0;
    const missingContext =
      hasAnyRecipient && recipients.length === 0 && ccRecipients.length === 0;

    // Bcc leak: any preview row whose suppression flag fired. Surface the
    // exact masked addresses so the user can find and fix them.
    const leaked = headerPreviewRows
      .filter((r) => r.suppressed)
      .map((r) => r.recipient);

    return {
      missingContext,
      leakedBcc: leaked,
      hasAny: missingContext || leaked.length > 0,
    };
  }, [recipients, ccRecipients, bccRecipients, headerPreviewRows]);
  const uniqueRecipientCount = useMemo(() => {
    const all = [...recipients, ...ccRecipients, ...bccRecipients]
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return new Set(all).size;
  }, [recipients, ccRecipients, bccRecipients]);
  const totalRecipientCount = recipients.length + ccRecipients.length + bccRecipients.length;
  const hasPendingRecipientInput = !!(recipientInput.trim() || ccInput.trim() || bccInput.trim());
  const recipientsValid =
    recipients.length > 0 && invalidRecipients.length === 0 && dupRecipients.length === 0;

  // ── Validation: date range ───────────────────────────────────────────────
  const dateRangeError = useMemo(() => {
    if (selectionMode !== "range" || rangeMode !== "custom") return null;
    if (dateFrom && dateTo && dateFrom > dateTo) return "Start date is after end date.";
    if (!dateFrom && !dateTo) return "Pick at least a start or end date.";
    return null;
  }, [selectionMode, rangeMode, dateFrom, dateTo]);

  // ── Live "matching contacts" count for Step 2 ────────────────────────────
  const contactMatchKey = [
    "wizard-contact-match-count",
    selectionMode,
    folderId,
    eventId,
    rangeMode,
    daysBack,
    dateFrom?.toISOString() ?? null,
    dateTo?.toISOString() ?? null,
    Array.from(selectedContactIds).sort().join(","),
    Array.from(filterTagIds).sort().join(","),
    Array.from(filterStatuses).sort().join(","),
    searchQuery.trim(),
  ];
  const { data: matchCount, isFetching: matchCountLoading, error: matchCountError } = useQuery({
    queryKey: contactMatchKey,
    enabled: step === 2 && !dateRangeError && (selectionMode !== "event" || !!eventId),
    staleTime: 5_000,
    retry: false,
    queryFn: async (): Promise<number> => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) return 0;
      let q = supabase.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (selectionMode === "manual") {
        const ids = Array.from(selectedContactIds);
        if (ids.length === 0) return 0;
        q = q.in("id", ids);
      } else if (selectionMode === "folder" && folderId !== "all") {
        q = q.eq("folder_id", folderId);
      } else if (selectionMode === "event") {
        if (!eventId) return 0;
        const { data: linked, error: lerr } = await supabase
          .from("event_contacts").select("contact_id").eq("event_id", eventId);
        if (lerr) throw lerr;
        const ids = Array.from(new Set((linked ?? []).map((r: any) => r.contact_id).filter(Boolean)));
        if (ids.length === 0) return 0;
        q = q.in("id", ids);
      } else if (selectionMode === "range") {
        if (rangeMode === "custom" && (dateFrom || dateTo)) {
          const fromISO = dateFrom ? new Date(format(dateFrom, "yyyy-MM-dd") + "T00:00:00Z").toISOString() : null;
          const toISO = dateTo ? new Date(format(dateTo, "yyyy-MM-dd") + "T23:59:59.999Z").toISOString() : null;
          const filters: string[] = [];
          if (fromISO && toISO) {
            filters.push(`and(scanned_at.gte.${fromISO},scanned_at.lte.${toISO})`);
            filters.push(`and(created_at.gte.${fromISO},created_at.lte.${toISO})`);
          } else if (fromISO) { filters.push(`scanned_at.gte.${fromISO}`); filters.push(`created_at.gte.${fromISO}`); }
          else if (toISO) { filters.push(`scanned_at.lte.${toISO}`); filters.push(`created_at.lte.${toISO}`); }
          q = q.or(filters.join(","));
        } else if (rangeMode === "rolling") {
          const n = Number(daysBack);
          if (n > 0) q = q.gte("scanned_at", new Date(Date.now() - n * 86400_000).toISOString());
        }
      }
      if (selectionMode !== "manual") {
        if (filterStatuses.size > 0) q = q.in("conversation_status", Array.from(filterStatuses));
        if (searchQuery.trim()) {
          const term = searchQuery.trim().replace(/[%,()]/g, " ");
          const like = `%${term}%`;
          q = q.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},title.ilike.${like}`);
        }
        if (filterTagIds.size > 0) {
          const { data: tagged, error: tagErr } = await supabase
            .from("contact_tags").select("contact_id").in("tag_id", Array.from(filterTagIds));
          if (tagErr) throw tagErr;
          const ids = Array.from(new Set((tagged ?? []).map((r: any) => r.contact_id).filter(Boolean)));
          if (ids.length === 0) return 0;
          q = q.in("id", ids);
        }
      }
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
  const previewErrorMsg = matchCountError instanceof Error
    ? matchCountError.message
    : matchCountError
      ? String(matchCountError)
      : null;
  const zeroMatch = matchCount === 0 && !matchCountLoading && !dateRangeError && !previewErrorMsg;

  const canNext = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1)
      return recipientsValid && !hasPendingRecipientInput && !headerInvariantViolations.hasAny;
    if (step === 2) {
      if (dateRangeError) return false;
      if (previewErrorMsg) return false;
      if (selectionMode === "event" && !eventId) return false;
      if (zeroMatch) return false;
      if (selectionMode === "manual") return selectedContactIds.size > 0;
      if (selectionMode === "range" && rangeMode === "custom") return !!(dateFrom || dateTo);
      if (selectionMode === "range" && rangeMode === "rolling") return Number(daysBack) > 0;
      return true;
    }
    if (step === 3) return columns.length > 0;
    if (step === 4)
      return (
        columns.length > 0 &&
        recipientsValid &&
        !zeroMatch &&
        !dateRangeError &&
        !previewErrorMsg &&
        !headerInvariantViolations.hasAny
      );
    return false;
  }, [step, name, recipientsValid, hasPendingRecipientInput, dateRangeError, previewErrorMsg, zeroMatch, selectionMode, selectedContactIds, rangeMode, dateFrom, dateTo, daysBack, columns, headerInvariantViolations, eventId]);

  const save = async () => {
    if (!recipientsValid) { toast.error("Fix recipient emails before saving."); return; }
    // Warn if there is still un-added text in any recipient input box. The
    // most common silent loss for CC is "user typed an address, never hit
    // Enter, then clicked Create" — the address is in the input but never
    // makes it into ccRecipients.
    if (recipientInput.trim() || ccInput.trim() || bccInput.trim()) {
      const pending: string[] = [];
      if (recipientInput.trim()) pending.push(`To ("${recipientInput.trim()}")`);
      if (ccInput.trim()) pending.push(`CC ("${ccInput.trim()}")`);
      if (bccInput.trim()) pending.push(`BCC ("${bccInput.trim()}")`);
      toast.error(
        `Unadded recipient text in ${pending.join(", ")}. Press Enter (or click Add) to confirm — or clear it before saving.`,
      );
      return;
    }
    // Pre-save normalization audit. Re-run the canonical cleanup on every
    // already-stored recipient and report:
    //   - whitespace/case/zero-width drift between what the user typed and
    //     what would actually be sent (e.g. "alice @x.com" vs "alice@x.com"),
    //   - cross-list collisions that survive case-insensitive matching
    //     (most importantly CC ↔ TO, which silently demotes the CC at send
    //     time because the SMTP layer dedups by lower-cased address).
    {
      type Bucket = { role: "to" | "cc" | "bcc"; raw: string; canon: string };
      const buckets: Bucket[] = [
        ...recipients.map((e) => ({ role: "to" as const, raw: e, canon: normalizeEmailToken(e).toLowerCase() })),
        ...ccRecipients.map((e) => ({ role: "cc" as const, raw: e, canon: normalizeEmailToken(e).toLowerCase() })),
        ...bccRecipients.map((e) => ({ role: "bcc" as const, raw: e, canon: normalizeEmailToken(e).toLowerCase() })),
      ];
      const driftedCc = ccRecipients.filter((e) => normalizeEmailToken(e) !== e.trim());
      // CC entries that collapse onto a TO entry once normalised — these
      // would be silently dropped by the SMTP server, which is exactly the
      // class of bug the user is asking us to catch.
      const toCanon = new Set(
        recipients.map((e) => normalizeEmailToken(e).toLowerCase()).filter(Boolean),
      );
      const ccShadowedByTo = ccRecipients.filter((e) =>
        toCanon.has(normalizeEmailToken(e).toLowerCase()),
      );
      // Same-list collapse (two CC chips that canonicalise to one address).
      const ccCanonCounts = new Map<string, number>();
      for (const b of buckets) {
        if (b.role !== "cc" || !b.canon) continue;
        ccCanonCounts.set(b.canon, (ccCanonCounts.get(b.canon) ?? 0) + 1);
      }
      const ccInternalCollapse = Array.from(ccCanonCounts.entries())
        .filter(([, n]) => n > 1)
        .map(([k]) => k);

      if (ccShadowedByTo.length > 0) {
        toast.error(
          `Cannot save: ${ccShadowedByTo.join(", ")} is in both To and CC (case/whitespace differences). The CC copy would be silently dropped — remove it from one list.`,
        );
        return;
      }
      if (ccInternalCollapse.length > 0) {
        toast.error(
          `Cannot save: CC contains entries that resolve to the same address (${ccInternalCollapse.join(", ")}). Remove the duplicates.`,
        );
        return;
      }
      if (driftedCc.length > 0) {
        // Non-blocking — we just normalise on save, but tell the user so the
        // chip rendered in History matches what they expected.
        toast.warning(
          `Cleaned up formatting in ${driftedCc.length} CC entr${driftedCc.length === 1 ? "y" : "ies"} (whitespace / hidden characters) before saving.`,
        );
      }
    }
    if (headerInvariantViolations.missingContext) {
      toast.error("Add at least one To or Cc recipient — a Bcc-only schedule has no visible context.");
      return;
    }
    if (headerInvariantViolations.leakedBcc.length > 0) {
      toast.error(
        `Bcc leak: ${headerInvariantViolations.leakedBcc.join(", ")} also appears in To/Cc — remove the duplicate before saving.`,
      );
      return;
    }
    if (dateRangeError) { toast.error(dateRangeError); return; }
    if (previewErrorMsg) { toast.error(`Preview query failed — fix before saving: ${previewErrorMsg}`); return; }
    if (zeroMatch) { toast.error("Current filters match 0 contacts. Adjust before saving."); return; }
    // Validate the per-schedule attachment cap (if the user entered one).
    if (attachmentMaxKbInput.trim()) {
      const n = Number(attachmentMaxKbInput.trim());
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        toast.error("Attachment cap must be a whole number of kilobytes (1 or more).");
        return;
      }
      if (n > 18432) {
        toast.error("Attachment cap can't exceed 18432 KB (18 MB) — that's the upstream provider limit.");
        return;
      }
    }
    // Validate the per-schedule zip threshold (if entered). Mirrors the
    // database trigger so the user gets a friendly toast instead of a raw
    // Postgres error string from the failed insert.
    if (attachmentZipThresholdKbInput.trim()) {
      const z = Number(attachmentZipThresholdKbInput.trim());
      if (!Number.isFinite(z) || !Number.isInteger(z) || z < 1) {
        toast.error("Zip threshold must be a whole number of kilobytes (1 or more).");
        return;
      }
      if (z > 18432) {
        toast.error("Zip threshold can't exceed 18432 KB (18 MB) — same upstream provider limit.");
        return;
      }
      if (attachmentMaxKbInput.trim()) {
        const cap = Number(attachmentMaxKbInput.trim());
        if (Number.isFinite(cap) && z >= cap) {
          toast.error(
            `Zip threshold (${z} KB) must be less than the download-link cap (${cap} KB), otherwise the cap fires first and the zip step never runs.`,
          );
          return;
        }
      }
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();

    // Final guard: re-count with the exact same filters the cron will use.
    // If the live preview returns 0 rows, refuse to save an empty schedule.
    try {
      const { count: dryCount, error: dryErr } = await (async () => {
        const userId = u.user?.id;
        if (!userId) return { count: null as number | null, error: null as any };
        let q = supabase.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (selectionMode === "manual") {
          const ids = Array.from(selectedContactIds);
          if (ids.length === 0) return { count: 0, error: null };
          q = q.in("id", ids);
        } else {
          if (selectionMode === "folder" && folderId !== "all") q = q.eq("folder_id", folderId);
          if (selectionMode === "event") {
            if (!eventId) return { count: 0, error: null };
            const { data: linked, error: lerr } = await supabase
              .from("event_contacts").select("contact_id").eq("event_id", eventId);
            if (lerr) return { count: null, error: lerr };
            const ids = Array.from(new Set((linked ?? []).map((r: any) => r.contact_id).filter(Boolean)));
            if (ids.length === 0) return { count: 0, error: null };
            q = q.in("id", ids);
          }
          if (selectionMode === "range" && rangeMode === "custom" && (dateFrom || dateTo)) {
            const fromISO = dateFrom ? new Date(format(dateFrom, "yyyy-MM-dd") + "T00:00:00Z").toISOString() : null;
            const toISO = dateTo ? new Date(format(dateTo, "yyyy-MM-dd") + "T23:59:59.999Z").toISOString() : null;
            const filters: string[] = [];
            if (fromISO && toISO) {
              filters.push(`and(scanned_at.gte.${fromISO},scanned_at.lte.${toISO})`);
              filters.push(`and(created_at.gte.${fromISO},created_at.lte.${toISO})`);
            } else if (fromISO) { filters.push(`scanned_at.gte.${fromISO}`); filters.push(`created_at.gte.${fromISO}`); }
            else if (toISO) { filters.push(`scanned_at.lte.${toISO}`); filters.push(`created_at.lte.${toISO}`); }
            q = q.or(filters.join(","));
          } else if (selectionMode === "range" && rangeMode === "rolling") {
            const n = Number(daysBack);
            if (n > 0) q = q.gte("scanned_at", new Date(Date.now() - n * 86400_000).toISOString());
          }
          if (filterStatuses.size > 0) q = q.in("conversation_status", Array.from(filterStatuses));
          if (searchQuery.trim()) {
            const term = searchQuery.trim().replace(/[%,()]/g, " ");
            const like = `%${term}%`;
            q = q.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},title.ilike.${like}`);
          }
          if (filterTagIds.size > 0) {
            const { data: tagged } = await supabase.from("contact_tags").select("contact_id").in("tag_id", Array.from(filterTagIds));
            const ids = Array.from(new Set((tagged ?? []).map((r: any) => r.contact_id).filter(Boolean)));
            if (ids.length === 0) return { count: 0, error: null };
            q = q.in("id", ids);
          }
        }
        const { count, error } = await q;
        return { count: count ?? 0, error };
      })();
      if (dryErr) {
        setSaving(false);
        const msg = (dryErr as { message?: string })?.message ?? "Unknown error";
        toast.error(`Preview query failed — can't save schedule: ${msg}`);
        return;
      }
      if (dryCount === 0) {
        setSaving(false);
        toast.error("CSV preview returned 0 rows — can’t save an empty schedule. Adjust your filters and try again.");
        return;
      }
    } catch (e) {
      setSaving(false);
      const msg = e instanceof Error ? e.message : "Preview validation failed";
      toast.error(`Couldn't validate preview — can't save schedule: ${msg}`);
      return;
    }
    const toIsoDate = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : null);

    const payload: any = {
      user_id: u.user!.id,
      name,
      recipient_email: normalizeEmailToken(recipients[0]),
      recipient_emails: recipients.map(normalizeEmailToken),
      cc_emails: ccRecipients.map(normalizeEmailToken),
      bcc_emails: bccRecipients.map(normalizeEmailToken),
      frequency,
      day_of_week: frequency === "weekly" ? dayOfWeek : null,
      hour_utc: hourUtc,
      timezone,
      folder_id: selectionMode === "folder" && folderId !== "all" ? folderId : null,
      event_id: selectionMode === "event" && eventId ? eventId : null,
      days_back: selectionMode === "range" && rangeMode === "rolling" ? Number(daysBack) : null,
      date_from: selectionMode === "range" && rangeMode === "custom" ? toIsoDate(dateFrom) : null,
      date_to: selectionMode === "range" && rangeMode === "custom" ? toIsoDate(dateTo) : null,
      contact_ids: selectionMode === "manual" ? Array.from(selectedContactIds) : null,
      tag_ids: selectionMode !== "manual" && filterTagIds.size > 0 ? Array.from(filterTagIds) : null,
      statuses: selectionMode !== "manual" && filterStatuses.size > 0 ? Array.from(filterStatuses) : null,
      search_query: selectionMode !== "manual" && searchQuery.trim() ? searchQuery.trim() : null,
      columns,
      delivery_mode: deliveryMode,
      attachment_max_kb: (() => {
        const trimmed = attachmentMaxKbInput.trim();
        if (!trimmed) return null;
        const n = Math.floor(Number(trimmed));
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      attachment_zip_threshold_kb: (() => {
        const trimmed = attachmentZipThresholdKbInput.trim();
        if (!trimmed) return null;
        const n = Math.floor(Number(trimmed));
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      // Snapshot of what the preview looked like at save-time. Used by the
      // history panel to highlight drift (row count, filters, columns) once
      // real runs start firing.
      preview_snapshot: {
        capturedAt: new Date().toISOString(),
        rowCount: typeof matchCount === "number" ? matchCount : null,
        columns,
        filters: {
          selectionMode,
          folderId: selectionMode === "folder" ? folderId : null,
          eventId: selectionMode === "event" ? eventId : null,
          rangeMode: selectionMode === "range" ? rangeMode : null,
          daysBack: selectionMode === "range" && rangeMode === "rolling" ? Number(daysBack) : null,
          dateFrom: selectionMode === "range" && rangeMode === "custom" ? toIsoDate(dateFrom) : null,
          dateTo: selectionMode === "range" && rangeMode === "custom" ? toIsoDate(dateTo) : null,
          tagIds: filterTagIds.size > 0 ? Array.from(filterTagIds) : [],
          statuses: filterStatuses.size > 0 ? Array.from(filterStatuses) : [],
          searchQuery: searchQuery.trim() || null,
          contactIdCount: selectionMode === "manual" ? selectedContactIds.size : null,
        },
      },
    };

    const { error } = await supabase.from("export_schedules" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    // Remember this choice so the next "New schedule" wizard preselects it.
    try { window.localStorage.setItem(DELIVERY_MODE_PREF_KEY, deliveryMode); } catch { /* quota / private mode */ }
    toast.success("Schedule created");
    onSaved();
  };

  return (
    <div className="mt-4 pb-8">
      {/* Stepper */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div key={s.title} className="flex-1 flex items-center">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={cn(
                    "size-8 rounded-full grid place-items-center border-2 transition-colors",
                    active && "border-primary bg-primary text-primary-foreground",
                    done && "border-primary bg-primary/10 text-primary",
                    !active && !done && "border-muted bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </div>
                <span className={cn("text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 flex-1 -mt-4 mx-1", i < step ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="hour-local">Hour</Label>
                <span
                  className="text-[11px] text-muted-foreground font-mono truncate max-w-[60%]"
                  title={`Wall-clock hour in ${timezone}`}
                >
                  {timezone}
                </span>
              </div>
              <Select value={String(hourUtc)} onValueChange={(v) => setHourUtc(Number(v))}>
                <SelectTrigger id="hour-local"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Local wall-clock time in the selected timezone (not UTC).
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Timezone</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="use-default-tz" className="text-xs text-muted-foreground cursor-pointer">
                  Use my default
                </Label>
                <Switch
                  id="use-default-tz"
                  checked={useMyDefault}
                  onCheckedChange={(v) => {
                    setUseMyDefault(v);
                    if (v) setTimezone(effectiveDefaultTz);
                  }}
                />
              </div>
            </div>
            <Select
              value={timezone}
              onValueChange={(v) => { setTimezone(v); setUseMyDefault(false); }}
              disabled={useMyDefault}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(() => {
                  // @ts-ignore — supportedValuesOf available in modern runtimes
                  const all: string[] = (Intl as any).supportedValuesOf?.("timeZone") ?? [
                    "UTC","Europe/London","Europe/Paris","Europe/Berlin","Europe/Madrid","Europe/Amsterdam","Europe/Stockholm",
                    "America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Sao_Paulo",
                    "Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Tokyo","Asia/Shanghai","Australia/Sydney",
                  ];
                  const pinned = Array.from(new Set([
                    ...(defaultTzPref ? [defaultTzPref] : []),
                    browserTz,
                    "UTC",
                  ]));
                  const ordered = [...pinned, ...all.filter((t) => !pinned.includes(t))];
                  return ordered.map((tz) => {
                    const labels: string[] = [];
                    if (tz === defaultTzPref) labels.push("your default");
                    if (tz === browserTz) labels.push("browser");
                    const suffix = labels.length ? ` (${labels.join(" · ")})` : "";
                    return <SelectItem key={tz} value={tz}>{tz}{suffix}</SelectItem>;
                  });
                })()}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between gap-2 text-xs">
              <p className="text-muted-foreground">
                Runs at {String(hourUtc).padStart(2, "0")}:00 in <span className="font-medium text-foreground">{timezone}</span>
                {useMyDefault
                  ? defaultTzPref
                    ? " · using your saved default"
                    : " · using browser timezone (no default saved yet)"
                  : " · overriding your default for this schedule"}
              </p>
              {!useMyDefault && timezone !== defaultTzPref && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] shrink-0"
                  onClick={saveTzAsDefault}
                  title="Save this timezone as the default for all future schedules"
                >
                  Save as my default
                </Button>
              )}
            </div>
            {(() => {
              const dst = checkScheduleDst({ timezone, frequency });
              if (!dst) return null;
              return (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <p className="font-medium text-foreground">{dst.title}</p>
                    <p className="text-muted-foreground leading-relaxed">{dst.message}</p>
                    {dst.suggestedTz && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] mt-1"
                        onClick={() => { setTimezone(dst.suggestedTz!); setUseMyDefault(false); }}
                      >
                        Switch to {dst.suggestedTz} (no DST)
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          {frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Day of week</Label>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map((d, i) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={dayOfWeek === i ? "default" : "outline"}
                    onClick={() => setDayOfWeek(i)}
                    type="button"
                  >{d}</Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <Label>How should the CSV be delivered?</Label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMode("attachment")}
                className={cn(
                  "text-left p-3 rounded-lg border-2 transition-colors",
                  deliveryMode === "attachment" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                )}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  📎 Downloadable CSV file
                  <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Email contains a "Download CSV" button. The file is hosted privately
                  and the link expires after 7 days.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("inline")}
                className={cn(
                  "text-left p-3 rounded-lg border-2 transition-colors",
                  deliveryMode === "inline" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                )}
              >
                <div className="font-medium text-sm">📄 Inline CSV in email body</div>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV content is pasted directly into the email body. Useful for very
                  small lists or copy-paste workflows.
                </p>
              </button>
            </div>

            {/* Inline size warning — estimates whether the CSV will fit as
                an email attachment, and explains the fallback behavior so
                users aren't surprised when a large export arrives as a
                download link instead of a real attached file. */}
            {(() => {
              const ATTACH_SOFT_LIMIT = 5 * 1024 * 1024; // 5 MB — safe for most inboxes
              const ATTACH_HARD_LIMIT = 10 * 1024 * 1024; // 10 MB — provider hard cap
              const INLINE_SOFT_LIMIT = 256 * 1024; // 256 KB — inline body gets ugly past this
              const rowEstimate = typeof matchCount === "number" ? matchCount : 0;
              if (rowEstimate === 0 || columns.length === 0) return null;
              // ~50 bytes/cell average + header row + newlines
              const estimatedBytes =
                columns.join(",").length + 1 +
                rowEstimate * (columns.length * 50 + 1);
              const fmt = (b: number) =>
                b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;
              const sizeLabel = fmt(estimatedBytes);

              if (deliveryMode === "attachment") {
                if (estimatedBytes > ATTACH_HARD_LIMIT) {
                  return (
                    <div className="flex gap-2 items-start rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                      <AlertCircle className="size-4 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium">Too large to attach (~{sizeLabel})</p>
                        <p className="text-destructive/80">
                          Estimated size exceeds the 10 MB attachment limit most inbox
                          providers enforce. Recipients will instead receive a private
                          download link valid for 7 days. To attach the file directly,
                          reduce columns or narrow the date range.
                        </p>
                      </div>
                    </div>
                  );
                }
                if (estimatedBytes > ATTACH_SOFT_LIMIT) {
                  return (
                    <div className="flex gap-2 items-start rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                      <AlertCircle className="size-4 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium">Large attachment (~{sizeLabel})</p>
                        <p className="text-amber-700/80 dark:text-amber-400/80">
                          Some inbox providers (corporate Outlook, older Gmail filters)
                          may strip attachments larger than 5 MB. If delivery fails,
                          the email will fall back to a private download link automatically.
                        </p>
                      </div>
                    </div>
                  );
                }
                return (
                  <p className="text-[11px] text-muted-foreground">
                    Estimated CSV size: ~{sizeLabel} · fits well within attachment limits.
                  </p>
                );
              }

              // Inline mode warnings
              if (estimatedBytes > INLINE_SOFT_LIMIT) {
                return (
                  <div className="flex gap-2 items-start rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium">Inline body will be very long (~{sizeLabel})</p>
                      <p className="text-amber-700/80 dark:text-amber-400/80">
                        Pasting the full CSV inline is hard to read past a few hundred
                        rows and may be clipped by some clients (Gmail clips messages
                        over ~102 KB). Switch to "Downloadable CSV file" for better delivery.
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <p className="text-[11px] text-muted-foreground">
                  Estimated CSV size: ~{sizeLabel} · safe to inline.
                </p>
              );
            })()}

            {/* Per-schedule attachment cap. When the generated CSV is larger
                than this, the run automatically falls back to inline /
                download-link delivery instead of attaching, regardless of
                the global 18 MB Resend limit. Only meaningful when the
                schedule is currently configured for attachment delivery. */}
            <div className={cn("space-y-1.5", deliveryMode !== "attachment" && "opacity-60")}>
              <Label htmlFor="attachment-max-kb" className="text-xs">
                Force download link above (KB)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="attachment-max-kb"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={18432}
                  step={1}
                  placeholder="No cap (up to 18 MB)"
                  className="w-44"
                  value={attachmentMaxKbInput}
                  onChange={(e) => setAttachmentMaxKbInput(e.target.value)}
                  disabled={deliveryMode !== "attachment"}
                />
                {attachmentMaxKbInput.trim() && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setAttachmentMaxKbInput("")}
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                When the CSV exceeds this size, recipients get a private
                download link instead of an attached file. Leave blank to use
                only the global 18 MB inbox limit.
              </p>
            </div>

            {/* Per-schedule zip-when-large threshold. When the raw CSV
                exceeds this size, the run compresses it into a .zip BEFORE
                the cap above kicks in, so recipients still get the file
                inline as an attachment (just .zip instead of .csv). */}
            <div className={cn("space-y-1.5", deliveryMode !== "attachment" && "opacity-60")}>
              <Label htmlFor="attachment-zip-kb" className="text-xs">
                Zip & attach when above (KB)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="attachment-zip-kb"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={18432}
                  step={1}
                  placeholder="Never auto-zip"
                  className="w-44"
                  value={attachmentZipThresholdKbInput}
                  onChange={(e) => setAttachmentZipThresholdKbInput(e.target.value)}
                  disabled={deliveryMode !== "attachment"}
                />
                {attachmentZipThresholdKbInput.trim() && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setAttachmentZipThresholdKbInput("")}
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                When the CSV exceeds this size, it's compressed into a .zip
                and sent as the attachment. Must be smaller than the
                download-link cap above.
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <RecipientField
            label="To"
            list={recipients}
            input={recipientInput}
            setInput={setRecipientInput}
            onAdd={addRecipient}
            onRemove={(r) => setRecipients((arr) => arr.filter((e) => e !== r))}
            placeholder="add@example.com"
            emptyText="No recipients yet."
            helper="Press Enter or comma to add multiple recipients."
          />

          <div className="flex flex-wrap gap-2 text-xs">
            {!showCc && (
              <button type="button" className="text-primary hover:underline" onClick={() => setShowCc(true)}>
                + Add CC
              </button>
            )}
            {!showBcc && (
              <button type="button" className="text-primary hover:underline" onClick={() => setShowBcc(true)}>
                + Add BCC
              </button>
            )}
          </div>

          {showCc && (
            <RecipientField
              label="CC"
              list={ccRecipients}
              input={ccInput}
              setInput={setCcInput}
              onAdd={addCc}
              onRemove={(r) => setCcRecipients((arr) => arr.filter((e) => e !== r))}
              placeholder="cc@example.com"
              emptyText="No CC recipients."
              onClear={() => { setCcRecipients([]); setShowCc(false); }}
            />
          )}

          {showBcc && (
            <RecipientField
              label="BCC"
              list={bccRecipients}
              input={bccInput}
              setInput={setBccInput}
              onAdd={addBcc}
              onRemove={(r) => setBccRecipients((arr) => arr.filter((e) => e !== r))}
              placeholder="bcc@example.com"
              emptyText="No BCC recipients."
              helper="BCC recipients won't see each other's addresses."
              onClear={() => { setBccRecipients([]); setShowBcc(false); }}
            />
          )}

          {totalRecipientCount > 0 && (
            <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Unique recipients (after deduping To/CC/BCC)
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {uniqueRecipientCount}
                {totalRecipientCount !== uniqueRecipientCount && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    of {totalRecipientCount}
                  </span>
                )}
              </span>
            </div>
          )}

          {recipients.length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>At least one recipient is required</AlertTitle>
              <AlertDescription>Add an email in the “To” field to continue.</AlertDescription>
            </Alert>
          )}
          {invalidRecipients.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Invalid email{invalidRecipients.length === 1 ? "" : "s"}</AlertTitle>
              <AlertDescription>
                Fix or remove: <span className="font-mono">{invalidRecipients.join(", ")}</span>
              </AlertDescription>
            </Alert>
          )}
          {hasPendingRecipientInput && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                You have unconfirmed text in a recipient field. Press Enter or comma to add it before continuing.
              </AlertDescription>
            </Alert>
          )}
          {roleConflicts.toBcc.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Conflict: same address in To and BCC</AlertTitle>
              <AlertDescription>
                BCC is meant to stay hidden — keeping{" "}
                <span className="font-mono">{roleConflicts.toBcc.join(", ")}</span> in both To and BCC
                defeats the privacy of BCC. Remove it from one of the two roles.
              </AlertDescription>
            </Alert>
          )}
          {roleConflicts.ccBcc.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Conflict: same address in CC and BCC</AlertTitle>
              <AlertDescription>
                <span className="font-mono">{roleConflicts.ccBcc.join(", ")}</span> appears in both CC and BCC.
                Remove it from one role — BCC recipients should not also be visible in CC.
              </AlertDescription>
            </Alert>
          )}
          {roleConflicts.toCc.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Conflict: same address in To and CC</AlertTitle>
              <AlertDescription>
                <span className="font-mono">{roleConflicts.toCc.join(", ")}</span> appears in both To and CC.
                Keep each address in only one role.
              </AlertDescription>
            </Alert>
          )}
          {dupRecipients.length > 0 &&
            roleConflicts.toBcc.length === 0 &&
            roleConflicts.ccBcc.length === 0 &&
            roleConflicts.toCc.length === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Duplicate recipient{dupRecipients.length === 1 ? "" : "s"}</AlertTitle>
                <AlertDescription>
                  The following address{dupRecipients.length === 1 ? " appears" : "es appear"} more than once —
                  remove the extras: <span className="font-mono">{dupRecipients.join(", ")}</span>
                </AlertDescription>
              </Alert>
            )}

          {/* Hard-blocking header invariant errors. These mirror the runtime
              guards in safeHeadersForDelivery and prevent advancing past
              this step (and prevent Create) until resolved. The earlier
              role-conflict alerts catch raw duplicates; this one also
              catches canonicalized variants (display names, +tags, Gmail
              dots) since it's keyed off the same canonicalAddress() the
              edge function uses. */}
          {headerInvariantViolations.missingContext && (
            <Alert variant="destructive">
              <ShieldAlert className="size-4" />
              <AlertTitle>Header invariant: no visible recipients</AlertTitle>
              <AlertDescription>
                A Bcc-only schedule produces empty <span className="font-mono">To</span> and{" "}
                <span className="font-mono">Cc</span> headers — most mail clients show
                "Undisclosed recipients" and many spam filters score it harshly.
                Add at least one To or Cc recipient before continuing.
              </AlertDescription>
            </Alert>
          )}
          {headerInvariantViolations.leakedBcc.length > 0 && (
            <Alert variant="destructive">
              <ShieldAlert className="size-4" />
              <AlertTitle>
                Header invariant: Bcc leak ({headerInvariantViolations.leakedBcc.length})
              </AlertTitle>
              <AlertDescription>
                These Bcc address{headerInvariantViolations.leakedBcc.length === 1 ? "" : "es"}{" "}
                also appear in To or Cc, so the privacy guard would suppress all visible
                headers at send time:{" "}
                <span className="font-mono break-all">
                  {headerInvariantViolations.leakedBcc.join(", ")}
                </span>
                . Remove the duplicate from one role to continue.
              </AlertDescription>
            </Alert>
          )}

          {/* Per-recipient header preview ─ shows what each recipient role
              will literally see in the To/Cc rows (and as X-Original-To /
              X-Original-Cc headers) once the schedule runs. Mirrors the
              edge-function's safeHeadersForDelivery so previews and sends
              stay in lock-step. */}
          {headerPreviewRows.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Eye className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-medium">Per-recipient header preview</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                These are the exact <span className="font-mono">To</span> and{" "}
                <span className="font-mono">Cc</span> rows each recipient will see in their
                inbox. BCC addresses are never echoed — and if a BCC also appears in To/Cc,
                headers are suppressed entirely for that delivery to protect the BCC list.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-1 pr-2 font-medium">Recipient</th>
                      <th className="py-1 pr-2 font-medium">Role</th>
                      <th className="py-1 pr-2 font-medium">visible To</th>
                      <th className="py-1 font-medium">visible Cc</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {headerPreviewRows.map((row, i) => (
                      <tr key={`${row.role}-${row.recipient}-${i}`} className="border-b border-border/50 last:border-0 align-top">
                        <td className="py-1 pr-2 break-all">{row.recipient}</td>
                        <td className="py-1 pr-2">
                          <Badge
                            variant={row.role === "bcc" ? "secondary" : "outline"}
                            className="text-[10px] px-1.5 py-0 uppercase"
                          >
                            {row.role}
                          </Badge>
                        </td>
                        <td className="py-1 pr-2 break-all">
                          {row.suppressed ? (
                            <span className="text-amber-600 dark:text-amber-400 font-sans italic">
                              suppressed (BCC leak guard)
                            </span>
                          ) : row.visibleTo === null ? (
                            <span className="text-muted-foreground font-sans italic">none</span>
                          ) : (
                            row.visibleTo
                          )}
                        </td>
                        <td className="py-1 break-all">
                          {row.suppressed ? (
                            <span className="text-amber-600 dark:text-amber-400 font-sans italic">
                              suppressed
                            </span>
                          ) : row.visibleCc === null ? (
                            <span className="text-muted-foreground font-sans italic">none</span>
                          ) : (
                            row.visibleCc
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {headerPreviewRows.some((r) => r.suppressed) && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠ One or more BCC recipients also appear in To/Cc — their visible headers
                  will be suppressed at send time so the BCC list doesn't leak.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Which contacts?</Label>
            <Select value={selectionMode} onValueChange={(v: any) => setSelectionMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contacts</SelectItem>
                <SelectItem value="folder">Contacts in a folder</SelectItem>
                <SelectItem value="event">Contacts in an event</SelectItem>
                <SelectItem value="range">By date range</SelectItem>
                <SelectItem value="manual">Pick specific contacts</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Folder-only or event-scoped — event-scoped schedules include the event name in the email summary.
            </p>
          </div>

          {/* Live match-count banner */}
          {dateRangeError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Invalid date range</AlertTitle>
              <AlertDescription>{dateRangeError}</AlertDescription>
            </Alert>
          ) : previewErrorMsg ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Preview query failed — can't continue</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>The preview query returned an error. Fix the filters before saving:</p>
                <p className="font-mono text-[11px] break-all">{previewErrorMsg}</p>
              </AlertDescription>
            </Alert>
          ) : matchCountLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Counting matching contacts…
            </div>
          ) : zeroMatch ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>0 contacts match these filters</AlertTitle>
              <AlertDescription>
                The schedule would send an empty CSV. Adjust the folder, date range, or refine filters below.
              </AlertDescription>
            </Alert>
          ) : typeof matchCount === "number" ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span><span className="font-semibold">{matchCount}</span> contact{matchCount === 1 ? "" : "s"} would be exported with the current selection.</span>
            </div>
          ) : null}

          {selectionMode === "folder" && (
            <div className="space-y-2">
              <Label>Folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All folders</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.emoji} {f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectionMode === "event" && (
            <div className="space-y-2">
              <Label>Event</Label>
              {events.length === 0 ? (
                <Alert>
                  <AlertCircle className="size-4" />
                  <AlertTitle>No events yet</AlertTitle>
                  <AlertDescription>
                    Create an event first, then come back to scope this schedule to it.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Select value={eventId} onValueChange={setEventId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an event…" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          🎫 {e.title}
                          {e.start_date ? ` — ${format(new Date(e.start_date), "MMM d, yyyy")}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only contacts linked to this event will be exported. The event name appears in the email summary.
                  </p>
                </>
              )}
            </div>
          )}

          {selectionMode === "range" && (
            <div className="space-y-3">
              <Select value={rangeMode} onValueChange={(v: any) => setRangeMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rolling">Rolling window (last N days)</SelectItem>
                  <SelectItem value="custom">Custom date range</SelectItem>
                </SelectContent>
              </Select>

              {rangeMode === "rolling" && (
                <div>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    placeholder="e.g. 7"
                    value={daysBack}
                    onChange={(e) => setDaysBack(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Each run includes contacts scanned in the last N days.
                  </p>
                </div>
              )}

              {rangeMode === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                      >
                        <CalendarIcon className="size-4 mr-2" />
                        {dateFrom ? format(dateFrom, "PP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                      >
                        <CalendarIcon className="size-4 mr-2" />
                        {dateTo ? format(dateTo, "PP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        disabled={(d) => (dateFrom ? d < dateFrom : false)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}

          {selectionMode === "manual" && (
            <div className="space-y-2">
              <Input
                placeholder="Search contacts…"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-1">
                  {(contactList as any[]).map((c) => {
                    const checked = selectedContactIds.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedContactIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(c.id); else next.delete(c.id);
                              return next;
                            });
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[c.company, c.email].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                  {(contactList as any[]).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No contacts found.</p>
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {selectedContactIds.size} contact{selectedContactIds.size === 1 ? "" : "s"} selected
              </p>
            </div>
          )}

          {selectionMode !== "manual" && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Refine (optional)
                </Label>
                {(filterTagIds.size > 0 || filterStatuses.size > 0 || searchQuery.trim()) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => {
                      setFilterTagIds(new Set());
                      setFilterStatuses(new Set());
                      setSearchQuery("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Search query</Label>
                <Input
                  placeholder="Match name, company, email, or title…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Conversation status</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: "new", label: "New" },
                    { value: "in_progress", label: "In progress" },
                    { value: "qualified", label: "Qualified" },
                    { value: "won", label: "Won" },
                    { value: "lost", label: "Lost" },
                  ].map((s) => {
                    const active = filterStatuses.has(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() =>
                          setFilterStatuses((prev) => {
                            const next = new Set(prev);
                            if (next.has(s.value)) next.delete(s.value);
                            else next.add(s.value);
                            return next;
                          })
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs border transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary/50",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tags</Label>
                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No tags yet — create tags from the Contacts page.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
                    {(tags as { id: string; name: string; color: string | null }[]).map((t) => {
                      const active = filterTagIds.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setFilterTagIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(t.id)) next.delete(t.id);
                              else next.add(t.id);
                              return next;
                            })
                          }
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs border transition-colors",
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:border-primary/50",
                          )}
                          style={!active && t.color ? { borderColor: t.color } : undefined}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Filters combine with the selection above. Contacts must match every selected filter.
              </p>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>CSV columns</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setColumns(ALL_COLUMNS.map((c) => c.key))}
              >
                Select all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setColumns(DEFAULT_COLUMNS)}
              >
                Reset
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 border rounded-md p-2">
            {ALL_COLUMNS.map((c) => {
              const checked = columns.includes(c.key);
              return (
                <label
                  key={c.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setColumns((prev) =>
                        v ? [...prev, c.key] : prev.filter((k) => k !== c.key),
                      );
                    }}
                  />
                  <span className="text-sm">{c.label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {columns.length} column{columns.length === 1 ? "" : "s"} will be included in the CSV.
          </p>

          {/* ── Ordered export preview ─────────────────────────────────────── */}
          <div className="rounded-lg border bg-muted/20 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Columns3 className="size-3.5 text-primary" />
                Export order preview
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Left → right in CSV
              </span>
            </div>

            {columns.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Select at least one column to see the export order.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border-b bg-background/60">
                  <table className="text-xs font-mono">
                    <thead>
                      <tr>
                        {columns.map((key, i) => {
                          const label = ALL_COLUMNS.find((c) => c.key === key)?.label ?? key;
                          return (
                            <th
                              key={key}
                              className="text-left px-3 py-1.5 font-semibold text-foreground whitespace-nowrap border-r last:border-r-0 border-border/60"
                              title={`Column ${i + 1} · field "${key}"`}
                            >
                              <span className="text-[10px] text-muted-foreground mr-1.5">{i + 1}</span>
                              {label}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                  </table>
                </div>

                <ul className="divide-y">
                  {columns.map((key, i) => {
                    const label = ALL_COLUMNS.find((c) => c.key === key)?.label ?? key;
                    return (
                      <li
                        key={key}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/40"
                      >
                        <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] tabular-nums text-muted-foreground w-5 text-right">
                          {i + 1}.
                        </span>
                        <span className="flex-1 truncate">
                          {label}
                          <span className="ml-2 text-[10px] text-muted-foreground font-mono">{key}</span>
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          disabled={i === 0}
                          onClick={() =>
                            setColumns((prev) => {
                              const next = [...prev];
                              [next[i - 1], next[i]] = [next[i], next[i - 1]];
                              return next;
                            })
                          }
                          title="Move up"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          disabled={i === columns.length - 1}
                          onClick={() =>
                            setColumns((prev) => {
                              const next = [...prev];
                              [next[i + 1], next[i]] = [next[i], next[i + 1]];
                              return next;
                            })
                          }
                          title="Move down"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() =>
                            setColumns((prev) => prev.filter((k) => k !== key))
                          }
                          title="Remove column"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>

                <div className="px-3 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                  <span>This is the exact header order recipients will see in the CSV.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px]"
                    onClick={() => {
                      setColumns((prev) =>
                        ALL_COLUMNS.map((c) => c.key).filter((k) => prev.includes(k)),
                      );
                    }}
                  >
                    Sort by default order
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          {previewErrorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Preview query failed — can't save this schedule</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>The preview query returned an error. Go back to step 3 and adjust the filters:</p>
                <p className="font-mono text-[11px] break-all">{previewErrorMsg}</p>
              </AlertDescription>
            </Alert>
          )}
          {zeroMatch && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>CSV preview is empty — can’t save this schedule</AlertTitle>
              <AlertDescription>
                The current filters return 0 rows, so this schedule would deliver an
                empty CSV every run. Go back and adjust the folder, date range, or
                filters before creating the schedule.
              </AlertDescription>
            </Alert>
          )}
          {headerInvariantViolations.hasAny && (
            <Alert variant="destructive">
              <ShieldAlert className="size-4" />
              <AlertTitle>Header invariant violation — can't create this schedule</AlertTitle>
              <AlertDescription className="space-y-1">
                {headerInvariantViolations.missingContext && (
                  <p>
                    No To or Cc recipients — every delivery would render with empty
                    visible headers. Go back to Recipients and add at least one.
                  </p>
                )}
                {headerInvariantViolations.leakedBcc.length > 0 && (
                  <p>
                    Bcc leak on{" "}
                    <span className="font-mono break-all">
                      {headerInvariantViolations.leakedBcc.join(", ")}
                    </span>
                    {" "}— remove the duplicate from To/Cc before continuing.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Eye className="size-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-0.5">Final preview</p>
              <p>
                Review the first rows generated from your selected contacts and columns.
                If everything looks right, create the schedule below.
              </p>
            </div>
          </div>

          <DraftPreviewSection
            columns={columns}
            selectionMode={selectionMode}
            folderId={folderId}
            eventId={eventId}
            rangeMode={rangeMode}
            daysBack={daysBack}
            dateFrom={dateFrom}
            dateTo={dateTo}
            selectedContactIds={selectedContactIds}
            filterTagIds={filterTagIds}
            filterStatuses={filterStatuses}
            searchQuery={searchQuery}
            scheduleName={name}
          />

          {/* Visible recipients preview — quick scan of who will be visible
              in the email vs hidden, so the user can sanity-check before saving. */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Eye className="size-3.5 text-primary" />
                Visible recipients
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                What everyone will see
              </span>
            </div>
            <div className="divide-y text-xs">
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 h-5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">To</span>
                  <span className="text-[11px] text-muted-foreground">
                    {recipients.length} visible · primary recipient{recipients.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-[36px]">
                  {recipients.length === 0 ? (
                    <span className="text-destructive text-xs">(no recipients)</span>
                  ) : (
                    recipients.map((email) => (
                      <span key={`to-${email}`} className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium break-all">
                        {email}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {ccRecipients.length > 0 && (
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 h-5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-semibold uppercase tracking-wide">Cc</span>
                    <span className="text-[11px] text-muted-foreground">
                      {ccRecipients.length} visible · all recipients can see these
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-[36px]">
                    {ccRecipients.map((email) => (
                      <span key={`cc-${email}`} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-medium break-all">
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {bccRecipients.length > 0 && (
                <div className="px-3 py-2 bg-muted/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 h-5 rounded bg-muted text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">Bcc</span>
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <EyeOff className="size-3" />
                      {bccRecipients.length} hidden · not shown to others
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-[36px]">
                    {bccRecipients.map((email) => (
                      <span key={`bcc-${email}`} className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium break-all line-through decoration-muted-foreground/40">
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-3 py-2 border-t bg-muted/20 text-[11px] text-muted-foreground">
              {recipients.length + ccRecipients.length} address{recipients.length + ccRecipients.length === 1 ? "" : "es"} visible to recipients
              {bccRecipients.length > 0 && <> · {bccRecipients.length} hidden via Bcc</>}
            </div>
          </div>

          {/* Email header preview — exactly what recipients will see */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Mail className="size-3.5 text-primary" />
                Email header preview
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                As recipients will see it
              </span>
            </div>
            <div className="divide-y text-xs font-mono">
              <div className="grid grid-cols-[64px_1fr] gap-2 px-3 py-1.5">
                <span className="text-muted-foreground">From:</span>
                <span className="text-foreground break-all">Cardr &lt;notify@cardr.ai&gt;</span>
              </div>
              <div className="grid grid-cols-[64px_1fr] gap-2 px-3 py-1.5">
                <span className="text-muted-foreground">Subject:</span>
                <span className="text-foreground break-all">
                  {(name || "Scheduled export")} — <span className="text-muted-foreground">{matchCount ?? 0}</span> contacts
                </span>
              </div>
              <div className="grid grid-cols-[64px_1fr] gap-2 px-3 py-1.5">
                <span className="text-muted-foreground">To:</span>
                <span className="text-foreground break-all">
                  {recipients.length === 0
                    ? <span className="text-destructive">(no recipients)</span>
                    : recipients.join(", ")}
                </span>
              </div>
              {ccRecipients.length > 0 && (
                <div className="grid grid-cols-[64px_1fr] gap-2 px-3 py-1.5">
                  <span className="text-muted-foreground">Cc:</span>
                  <span className="text-foreground break-all">{ccRecipients.join(", ")}</span>
                </div>
              )}
              {bccRecipients.length > 0 && (
                <div className="grid grid-cols-[64px_1fr] gap-2 px-3 py-1.5">
                  <span className="text-muted-foreground">Bcc:</span>
                  <span className="text-foreground break-all">
                    {bccRecipients.join(", ")}
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground not-italic">
                      hidden from others
                    </span>
                  </span>
                </div>
              )}
            </div>
            <div className="px-3 py-2 border-t bg-muted/20 text-[11px] text-muted-foreground">
              Each address receives its own copy. CC addresses are visible to all recipients; BCC addresses are not.
            </div>
          </div>

          {/* CSV summary — shows the exact filename, row count, estimated
              size, and generated timestamp the recipient will see, so the
              user has a clear "what am I sending" check before saving. */}
          {(() => {
            const slug = (name || "scheduled_export")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "") || "scheduled_export";
            const stamp = format(new Date(), "yyyy-MM-dd");
            const fileName = `${slug}_${stamp}.csv`;
            const rowEstimate = typeof matchCount === "number" ? matchCount : 0;
            const estimatedBytes =
              columns.join(",").length + 1 +
              rowEstimate * (columns.length * 50 + 1);
            const sizeLabel = estimatedBytes >= 1024 * 1024
              ? `${(estimatedBytes / 1024 / 1024).toFixed(1)} MB`
              : `${Math.max(1, Math.ceil(estimatedBytes / 1024))} KB`;
            const isAttachment = deliveryMode === "attachment";
            const generatedLabel = format(new Date(), "MMM d, yyyy · HH:mm");
            return (
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    {isAttachment ? <Paperclip className="size-3.5 text-primary" /> : <FileText className="size-3.5 text-primary" />}
                    {isAttachment ? "Attached file" : "Inline CSV"}
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {isAttachment ? "Downloads as" : "Pasted in body"}
                  </span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-foreground break-all">{fileName}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground">{rowEstimate}</span> row{rowEstimate === 1 ? "" : "s"}
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{columns.length}</span> column{columns.length === 1 ? "" : "s"}
                    </span>
                    <span>
                      ~<span className="font-medium text-foreground">{sizeLabel}</span>
                    </span>
                    <span>
                      Generated <span className="font-medium text-foreground">{generatedLabel}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <div className="font-medium text-foreground">Schedule summary</div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">{name}</span> · {frequency}
              {frequency === "weekly" ? ` · ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayOfWeek]}` : ""}
              {" "}at {String(hourUtc).padStart(2, "0")}:00 ({timezone})
            </div>
            <div className="text-muted-foreground">
              {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
              {ccRecipients.length ? ` · ${ccRecipients.length} CC` : ""}
              {bccRecipients.length ? ` · ${bccRecipients.length} BCC` : ""}
              {" · "}{columns.length} column{columns.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => (s - 1) as Step)}
        >
          <ChevronLeft className="size-4" /> Back
        </Button>
        {step < 4 ? (
          <Button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" disabled={!canNext || saving} onClick={() => setConfirmCreateOpen(true)}>
            <CalendarIcon className="size-4" /> {saving ? "Saving…" : "Create schedule"}
          </Button>
        )}
      </div>

      {/* Final confirmation — recap recipients, columns, date range */}
      <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-primary" />
              Create this schedule?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Once created, the schedule will start firing automatically. You can pause or
                  delete it any time from the schedules list.
                </p>

                {/* Cadence */}
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">When</div>
                  <div className="text-foreground">
                    <span className="font-medium">{name || "(untitled)"}</span>
                    <span className="text-muted-foreground"> · </span>
                    {frequency === "weekly"
                      ? `Every ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dayOfWeek]}`
                      : "Every day"}
                    {" at "}
                    <span className="font-mono">{String(hourUtc).padStart(2, "0")}:00</span>
                    <span className="text-muted-foreground"> ({timezone})</span>
                  </div>
                </div>

                {/* Recipients */}
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Recipients ({recipients.length + ccRecipients.length + bccRecipients.length})
                  </div>
                  {recipients.length === 0 ? (
                    <div className="text-destructive text-xs">No primary recipients set.</div>
                  ) : (
                    <div>
                      <span className="text-muted-foreground text-xs">To: </span>
                      <span className="text-foreground break-all">{recipients.join(", ")}</span>
                    </div>
                  )}
                  {ccRecipients.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Cc: </span>
                      <span className="text-foreground break-all">{ccRecipients.join(", ")}</span>
                    </div>
                  )}
                  {bccRecipients.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Bcc: </span>
                      <span className="text-foreground break-all">{bccRecipients.join(", ")}</span>
                    </div>
                  )}
                </div>

                {/* Date range / contact source */}
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Contacts included</div>
                  <div className="text-foreground">
                    {selectionMode === "all" && "All contacts"}
                    {selectionMode === "folder" && (() => {
                      const f = folders.find((x) => x.id === folderId);
                      return f ? `Folder: ${f.emoji} ${f.name}` : "Folder";
                    })()}
                    {selectionMode === "event" && (() => {
                      const e = events.find((x) => x.id === eventId);
                      return e ? `Event: 🎫 ${e.title}` : "Event (none selected)";
                    })()}
                    {selectionMode === "manual" && `${selectedContactIds.size} hand-picked contact${selectedContactIds.size === 1 ? "" : "s"}`}
                    {selectionMode === "range" && (
                      rangeMode === "rolling"
                        ? `Scanned in the last ${daysBack || "?"} day${daysBack === "1" ? "" : "s"} (rolling window — recomputed each run)`
                        : `Scanned between ${dateFrom || "?"} and ${dateTo || "?"} (fixed range)`
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Current match: <span className="font-medium text-foreground">{matchCount ?? 0}</span> contact{matchCount === 1 ? "" : "s"}
                  </div>
                </div>

                {/* Columns in export order */}
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Columns ({columns.length}) — in export order
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {columns.map((c, i) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[11px] font-mono"
                      >
                        <span className="text-muted-foreground">{i + 1}.</span>{c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review again</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setConfirmCreateOpen(false);
                save();
              }}
            >
              <CalendarIcon className="size-3.5" /> Create schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RecipientField({
  label, list, input, setInput, onAdd, onRemove,
  placeholder, emptyText, helper, onClear,
}: {
  label: string;
  list: string[];
  input: string;
  setInput: (v: string) => void;
  /** Returns an outcome summary; we don't need it here, but it lets callers
   *  surface aggregated paste results upstream if they want. */
  onAdd: (v: string) => unknown;
  onRemove: (v: string) => void;
  placeholder: string;
  emptyText: string;
  helper?: string;
  onClear?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {onClear && (
          <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
            Remove
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              onAdd(input);
            }
          }}
          onPaste={(e) => {
            // If the clipboard contains a separator, treat it as a list paste:
            // intercept the default single-string fill, hand the raw text
            // straight to onAdd (which splits on , ; newlines etc.) so we
            // don't lose entries to formatting drift. Single-address pastes
            // fall through to default behaviour.
            const text = e.clipboardData.getData("text");
            if (text && /[,;\n\r\t]/.test(text)) {
              e.preventDefault();
              onAdd(text);
            }
          }}
        />
        <Button type="button" onClick={() => onAdd(input)}>Add</Button>
      </div>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      <div className="flex flex-wrap gap-2">
        {list.map((r) => (
          <Badge key={r} variant="secondary" className="gap-1.5 pr-1">
            {r}
            <button
              type="button"
              className="rounded-full hover:bg-background/40 p-0.5"
              onClick={() => onRemove(r)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function DraftPreviewSection({
  columns,
  selectionMode,
  folderId,
  eventId,
  rangeMode,
  daysBack,
  dateFrom,
  dateTo,
  selectedContactIds,
  filterTagIds,
  filterStatuses,
  searchQuery,
  scheduleName,
}: {
  columns: string[];
  selectionMode: "all" | "folder" | "event" | "range" | "manual";
  folderId: string;
  eventId: string;
  rangeMode: "rolling" | "custom";
  daysBack: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  selectedContactIds: Set<string>;
  filterTagIds: Set<string>;
  filterStatuses: Set<string>;
  searchQuery: string;
  scheduleName?: string;
}) {
  // Auto-open on mount: this section only renders on the Preview step, so
  // landing here should immediately fetch + show rows (and surface the
  // "Download CSV" button) without an extra click.
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [error, setError] = useState<{
    message: string;
    name?: string;
    code?: string;
    details?: string;
    hint?: string;
    stage: "auth" | "count" | "sample" | "tags" | "unknown";
  } | null>(null);
  const [previewLimit, setPreviewLimit] = useState<number>(10);
  // 0-indexed page. Rows shown = [page * previewLimit, page * previewLimit + previewLimit).
  // Reset to 0 whenever filters / page size change so the user never lands on
  // an empty page that no longer exists.
  const [page, setPage] = useState<number>(0);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    let stage: "auth" | "count" | "sample" | "tags" | "unknown" = "auth";
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");

      // Build typed count + sample queries via the helper, so dynamic
      // .select(columns) doesn't require any unsafe casts at this call site.
      let countQ = buildPreviewCountQuery(userId);
      const from = page * previewLimit;
      const to = from + previewLimit - 1;
      let sampleQ = buildPreviewSampleQuery(columns, userId).range(from, to);

      if (selectionMode === "manual") {
        const ids = Array.from(selectedContactIds);
        if (ids.length === 0) {
          setRows([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        countQ = countQ.in("id", ids);
        sampleQ = sampleQ.in("id", ids);
      } else if (selectionMode === "folder" && folderId !== "all") {
        countQ = countQ.eq("folder_id", folderId);
        sampleQ = sampleQ.eq("folder_id", folderId);
      } else if (selectionMode === "event") {
        if (!eventId) {
          setRows([]); setTotalCount(0); setLoading(false); return;
        }
        const { data: linked, error: lerr } = await supabase
          .from("event_contacts").select("contact_id").eq("event_id", eventId);
        if (lerr) throw lerr;
        const ids = Array.from(new Set((linked ?? []).map((r: any) => r.contact_id).filter(Boolean)));
        if (ids.length === 0) {
          setRows([]); setTotalCount(0); setLoading(false); return;
        }
        countQ = countQ.in("id", ids);
        sampleQ = sampleQ.in("id", ids);
      } else if (selectionMode === "range") {
        if (rangeMode === "custom" && (dateFrom || dateTo)) {
          const fromISO = dateFrom ? new Date(format(dateFrom, "yyyy-MM-dd") + "T00:00:00Z").toISOString() : null;
          const toISO = dateTo ? new Date(format(dateTo, "yyyy-MM-dd") + "T23:59:59.999Z").toISOString() : null;
          const filters: string[] = [];
          if (fromISO && toISO) {
            filters.push(`and(scanned_at.gte.${fromISO},scanned_at.lte.${toISO})`);
            filters.push(`and(created_at.gte.${fromISO},created_at.lte.${toISO})`);
          } else if (fromISO) {
            filters.push(`scanned_at.gte.${fromISO}`);
            filters.push(`created_at.gte.${fromISO}`);
          } else if (toISO) {
            filters.push(`scanned_at.lte.${toISO}`);
            filters.push(`created_at.lte.${toISO}`);
          }
          countQ = countQ.or(filters.join(","));
          sampleQ = sampleQ.or(filters.join(","));
        } else if (rangeMode === "rolling") {
          const n = Number(daysBack);
          if (n > 0) {
            const since = new Date(Date.now() - n * 86400_000).toISOString();
            countQ = countQ.gte("scanned_at", since);
            sampleQ = sampleQ.gte("scanned_at", since);
          }
        }
      }

      // Additional filters (tags / statuses / search) — apply unless hand-picking
      if (selectionMode !== "manual") {
        if (filterStatuses.size > 0) {
          const arr = Array.from(filterStatuses);
          countQ = countQ.in("conversation_status", arr);
          sampleQ = sampleQ.in("conversation_status", arr);
        }
        if (searchQuery.trim()) {
          const term = searchQuery.trim().replace(/[%,()]/g, " ");
          const like = `%${term}%`;
          const orExpr = `name.ilike.${like},company.ilike.${like},email.ilike.${like},title.ilike.${like}`;
          countQ = countQ.or(orExpr);
          sampleQ = sampleQ.or(orExpr);
        }
        if (filterTagIds.size > 0) {
          stage = "tags";
          const { data: tagged, error: tErr } = await supabase
            .from("contact_tags")
            .select("contact_id")
            .in("tag_id", Array.from(filterTagIds));
          if (tErr) throw tErr;
          const ids = Array.from(new Set((tagged ?? []).map((r: any) => r.contact_id).filter(Boolean)));
          if (ids.length === 0) {
            setRows([]);
            setTotalCount(0);
            setLoading(false);
            return;
          }
          countQ = countQ.in("id", ids);
          sampleQ = sampleQ.in("id", ids);
        }
      }

      stage = "count";
      const [countRes, sampleRes] = await Promise.all([countQ, sampleQ]);
      if (countRes.error) throw countRes.error;
      stage = "sample";
      if (sampleRes.error) throw sampleRes.error;

      setTotalCount(countRes.count ?? 0);
      setRows(sampleRes.data ?? []);
    } catch (e: unknown) {
      const err = (e ?? {}) as {
        message?: string;
        name?: string;
        code?: string;
        details?: string;
        hint?: string;
      };
      setError({
        message: err.message ?? String(e) ?? "Failed to load preview",
        name: err.name,
        code: err.code,
        details: err.details,
        hint: err.hint,
        stage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && rows.length === 0 && !error) {
      await fetchPreview();
    }
  };

  // Debounced auto-refresh: when the user edits columns, filters, folder,
  // date range or selection mode while the preview is open, wait 500ms of
  // idle time before re-fetching so we don't fire a query on every keystroke.
  const [pendingRefresh, setPendingRefresh] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPendingRefresh(true);
    const t = setTimeout(() => {
      setPendingRefresh(false);
      fetchPreview();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    previewLimit,
    page,
    // Stringify collections so referential changes don't trigger extra runs
    columns.join("|"),
    selectionMode,
    folderId,
    eventId,
    rangeMode,
    daysBack,
    dateFrom?.toISOString() ?? "",
    dateTo?.toISOString() ?? "",
    Array.from(selectedContactIds).sort().join(","),
    Array.from(filterTagIds).sort().join(","),
    Array.from(filterStatuses).sort().join(","),
    searchQuery,
  ]);

  // Whenever filters or page size change, jump back to the first page so the
  // user doesn't end up looking at an empty page beyond the new total.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [
    previewLimit,
    columns.join("|"),
    selectionMode,
    folderId,
    eventId,
    rangeMode,
    daysBack,
    dateFrom?.toISOString() ?? "",
    dateTo?.toISOString() ?? "",
    Array.from(selectedContactIds).sort().join(","),
    Array.from(filterTagIds).sort().join(","),
    Array.from(filterStatuses).sort().join(","),
    searchQuery,
  ]);

  // Build CSV preview text from rows + selected columns
  const previewCsv = useMemo(() => {
    if (rows.length === 0) return "";
    const header = columns.join(",");
    const lines = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
    return [header, ...lines].join("\n");
  }, [rows, columns]);

  // Build a filename slug shared by both download variants.
  const buildDownloadName = (kind: "preview" | "full") => {
    const slug = (scheduleName || "export")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "export";
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = kind === "preview" ? "preview_top5" : "preview_full";
    return `${slug}_${suffix}_${stamp}.csv`;
  };

  // Trigger a CSV download from already-loaded rows. Mobile browsers route
  // the blob through the device Files / Downloads app; on iOS Safari the
  // user gets a "Save to Files" prompt.
  const triggerCsvDownload = (csvBody: string, filename: string) => {
    // Prepend BOM so Excel / Numbers detect UTF-8 correctly.
    const blob = new Blob(["\ufeff" + csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Download the first 5 rows of the in-memory preview.
  const handleDownloadPreview = () => {
    if (rows.length === 0) {
      toast.error("Nothing to download yet — load the preview first.");
      return;
    }
    const top = rows.slice(0, 5);
    const header = columns.join(",");
    const lines = top.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
    triggerCsvDownload([header, ...lines].join("\n"), buildDownloadName("preview"));
    toast.success(`Downloaded ${top.length} preview row${top.length === 1 ? "" : "s"}.`);
  };

  // Re-runs the same filters but without a row cap so the user can save the
  // full preview to their device. Capped at FULL_DOWNLOAD_MAX rows for safety
  // — anything bigger should go through the scheduled email instead.
  const FULL_DOWNLOAD_MAX = 5000;
  const [downloadingFull, setDownloadingFull] = useState(false);
  const handleDownloadFull = async () => {
    if (downloadingFull) return;
    setDownloadingFull(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");

      let q = buildPreviewSampleQuery(columns, userId).range(0, FULL_DOWNLOAD_MAX - 1);

      if (selectionMode === "manual") {
        const ids = Array.from(selectedContactIds);
        if (ids.length === 0) { toast.error("No contacts selected."); return; }
        q = q.in("id", ids);
      } else if (selectionMode === "folder" && folderId !== "all") {
        q = q.eq("folder_id", folderId);
      } else if (selectionMode === "event") {
        if (!eventId) { toast.error("No event selected."); return; }
        const { data: linked, error: lerr } = await supabase
          .from("event_contacts").select("contact_id").eq("event_id", eventId);
        if (lerr) throw lerr;
        const ids = Array.from(new Set((linked ?? []).map((r: any) => r.contact_id).filter(Boolean)));
        if (ids.length === 0) { toast.error("No contacts linked to this event."); return; }
        q = q.in("id", ids);
      } else if (selectionMode === "range") {
        if (rangeMode === "custom" && (dateFrom || dateTo)) {
          const fromISO = dateFrom ? new Date(format(dateFrom, "yyyy-MM-dd") + "T00:00:00Z").toISOString() : null;
          const toISO = dateTo ? new Date(format(dateTo, "yyyy-MM-dd") + "T23:59:59.999Z").toISOString() : null;
          const filters: string[] = [];
          if (fromISO && toISO) {
            filters.push(`and(scanned_at.gte.${fromISO},scanned_at.lte.${toISO})`);
            filters.push(`and(created_at.gte.${fromISO},created_at.lte.${toISO})`);
          } else if (fromISO) { filters.push(`scanned_at.gte.${fromISO}`); filters.push(`created_at.gte.${fromISO}`); }
          else if (toISO) { filters.push(`scanned_at.lte.${toISO}`); filters.push(`created_at.lte.${toISO}`); }
          q = q.or(filters.join(","));
        } else if (rangeMode === "rolling") {
          const n = Number(daysBack);
          if (n > 0) q = q.gte("scanned_at", new Date(Date.now() - n * 86400_000).toISOString());
        }
      }

      if (selectionMode !== "manual") {
        if (filterStatuses.size > 0) q = q.in("conversation_status", Array.from(filterStatuses));
        if (searchQuery.trim()) {
          const term = searchQuery.trim().replace(/[%,()]/g, " ");
          const like = `%${term}%`;
          q = q.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},title.ilike.${like}`);
        }
        if (filterTagIds.size > 0) {
          const { data: tagged, error: tErr } = await supabase
            .from("contact_tags").select("contact_id").in("tag_id", Array.from(filterTagIds));
          if (tErr) throw tErr;
          const ids = Array.from(new Set((tagged ?? []).map((r: any) => r.contact_id).filter(Boolean)));
          if (ids.length === 0) { toast.error("No contacts match these filters."); return; }
          q = q.in("id", ids);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      const fullRows = (data ?? []) as PreviewRow[];
      if (fullRows.length === 0) { toast.error("No rows to download."); return; }

      const header = columns.join(",");
      const lines = fullRows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
      triggerCsvDownload([header, ...lines].join("\n"), buildDownloadName("full"));

      const cappedNote = totalCount > FULL_DOWNLOAD_MAX
        ? ` (capped at ${FULL_DOWNLOAD_MAX.toLocaleString()} of ${totalCount.toLocaleString()})`
        : "";
      toast.success(`Downloaded ${fullRows.length.toLocaleString()} row${fullRows.length === 1 ? "" : "s"}${cappedNote}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to build full preview");
    } finally {
      setDownloadingFull(false);
    }
  };



  // Infer per-column types from sample rows
  type ColType = "number" | "date" | "boolean" | "email" | "url" | "text" | "empty";
  const inferType = (v: unknown): ColType => {
    if (v === null || v === undefined || v === "") return "empty";
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number" && Number.isFinite(v)) return "number";
    const s = String(v).trim();
    if (s === "") return "empty";
    if (s === "true" || s === "false") return "boolean";
    // ISO date / datetime
    if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) {
      const t = Date.parse(s); if (!Number.isNaN(t)) return "date";
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "email";
    if (/^https?:\/\/\S+$/i.test(s)) return "url";
    if (/^-?\d+(\.\d+)?$/.test(s)) return "number";
    return "text";
  };
  const columnTypes = useMemo<Record<string, ColType>>(() => {
    const out: Record<string, ColType> = {};
    for (const c of columns) {
      const seen: Record<ColType, number> = { number: 0, date: 0, boolean: 0, email: 0, url: 0, text: 0, empty: 0 };
      for (const r of rows) seen[inferType(r[c])]++;
      const nonEmpty = (Object.keys(seen) as ColType[]).filter((k) => k !== "empty");
      const winner = nonEmpty.sort((a, b) => seen[b] - seen[a])[0];
      out[c] = (winner && seen[winner] > 0) ? winner : "empty";
    }
    return out;
  }, [rows, columns]);

  const typeStyle: Record<ColType, string> = {
    number: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    date: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    boolean: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    email: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    url: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    text: "bg-muted text-muted-foreground border-border",
    empty: "bg-muted/40 text-muted-foreground/70 border-border",
  };

  // Lightweight CSV linter — checks each cell + assembled CSV for common issues
  type CsvIssue = { severity: "error" | "warning"; message: string; location?: string };
  const csvIssues = useMemo<CsvIssue[]>(() => {
    if (rows.length === 0) return [];
    const issues: CsvIssue[] = [];
    rows.forEach((r, ri) => {
      columns.forEach((c) => {
        const v = r[c];
        if (v === null || v === undefined) return;
        const s = typeof v === "string" ? v : String(v);
        // Unbalanced double quotes (odd count of un-escaped quotes)
        const quotes = (s.match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
          issues.push({ severity: "error", message: `Unbalanced double quote in “${c}”`, location: `row ${ri + 1}` });
        }
        // Embedded newline / carriage return
        if (/[\r\n]/.test(s)) {
          issues.push({ severity: "warning", message: `Line break inside “${c}” — will be quoted but may break naïve parsers`, location: `row ${ri + 1}` });
        }
        // Stray null byte
        if (/\u0000/.test(s)) {
          issues.push({ severity: "error", message: `Null byte in “${c}”`, location: `row ${ri + 1}` });
        }
        // Cell starts with formula char (CSV injection risk)
        if (/^[=+\-@\t\r]/.test(s)) {
          issues.push({ severity: "warning", message: `“${c}” starts with “${s[0]}” — possible CSV/Excel formula injection`, location: `row ${ri + 1}` });
        }
      });
    });
    // Header sanity
    columns.forEach((c) => {
      if (/[",\r\n]/.test(c)) {
        issues.push({ severity: "warning", message: `Header “${c}” contains a delimiter or quote character` });
      }
    });
    // Inconsistent column counts in the assembled CSV
    if (previewCsv) {
      const lines = previewCsv.split("\n");
      const headerCount = (lines[0]?.match(/,/g) || []).length + 1;
      // Naïve column count — only meaningful when no quoted cells contain commas
      const hasQuoted = previewCsv.includes('"');
      if (!hasQuoted) {
        for (let i = 1; i < lines.length; i++) {
          const cells = (lines[i].match(/,/g) || []).length + 1;
          if (cells !== headerCount) {
            issues.push({ severity: "error", message: `Row ${i} has ${cells} fields but header has ${headerCount}` });
          }
        }
      }
    }
    // Dedupe identical messages while preserving worst severity
    const seen = new Map<string, CsvIssue>();
    for (const i of issues) {
      const key = `${i.severity}|${i.message}`;
      if (!seen.has(key)) seen.set(key, i);
    }
    return Array.from(seen.values()).slice(0, 20);
  }, [rows, columns, previewCsv]);

  const errorCount = csvIssues.filter((i) => i.severity === "error").length;
  const warnCount = csvIssues.filter((i) => i.severity === "warning").length;

  // Per-column emptiness on the current page. We surface this so users can
  // see *before* saving which chosen columns will produce blank cells in the
  // CSV — typically because contacts haven't been enriched, or the field
  // simply isn't captured during scanning.
  const missingByColumn = useMemo(() => {
    const out: { key: string; label: string; missing: number; total: number; pct: number }[] = [];
    if (rows.length === 0) return out;
    for (const c of columns) {
      let missing = 0;
      for (const r of rows) {
        const v = r[c];
        if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) missing++;
      }
      if (missing === 0) continue;
      const friendly = ALL_COLUMNS.find((col) => col.key === c)?.label ?? c;
      out.push({
        key: c,
        label: friendly,
        missing,
        total: rows.length,
        pct: Math.round((missing / rows.length) * 100),
      });
    }
    // Worst offenders first
    return out.sort((a, b) => b.pct - a.pct);
  }, [rows, columns]);

  const fullyEmptyColumns = missingByColumn.filter((m) => m.missing === m.total);

  return (
    <div className="border rounded-md p-3 mt-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Eye className="size-4 text-primary" />
          Preview CSV
        </div>
        <div className="flex items-center gap-2">
          {open && (pendingRefresh || loading) && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {pendingRefresh && !loading ? "Waiting for changes…" : "Refreshing…"}
            </span>
          )}
          {open && (
            <Select value={String(previewLimit)} onValueChange={(v) => setPreviewLimit(Number(v))}>
              <SelectTrigger className="h-7 w-[88px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 25, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {open && !loading && !error && rows.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-7 gap-1.5"
                  disabled={downloadingFull}
                  title="Save preview rows as a CSV file to your device"
                >
                  {downloadingFull
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <Download className="size-3.5" />}
                  Download CSV
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                  Save to your device
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownloadPreview} className="flex-col items-start gap-0.5">
                  <span className="text-sm font-medium">First 5 rows</span>
                  <span className="text-[11px] text-muted-foreground">
                    Quick sanity check · uses already-loaded rows
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDownloadFull}
                  disabled={downloadingFull}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">
                    Full preview{totalCount > 0 && ` (${Math.min(totalCount, FULL_DOWNLOAD_MAX).toLocaleString()} row${Math.min(totalCount, FULL_DOWNLOAD_MAX) === 1 ? "" : "s"})`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {totalCount > FULL_DOWNLOAD_MAX
                      ? `Capped at ${FULL_DOWNLOAD_MAX.toLocaleString()} of ${totalCount.toLocaleString()} matches`
                      : "Every row that matches your filters"}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {open && !loading && !error && (
            <Button type="button" size="sm" variant="ghost" onClick={fetchPreview} className="h-7">
              <Loader2 className={cn("size-3", loading && "animate-spin")} /> Refresh
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={handleToggle} className="h-7">
            {open ? "Hide" : "Show preview"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        See the first {previewLimit} rows that match your folder, date range, and column selection.
      </p>

      {open && (
        <div className="mt-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
              <Loader2 className="size-3 animate-spin" /> Loading preview…
            </div>
          ) : error ? (
            <div className="rounded border border-destructive/40 bg-destructive/5 text-xs">
              <div className="px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium text-destructive">
                    <AlertCircle className="size-3.5" />
                    <span>Couldn't load preview</span>
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase tracking-wide">
                      {error.stage}
                    </Badge>
                    {error.code && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-mono">
                        {error.code}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-foreground break-words">{error.message}</p>
                  {(error.details || error.hint || error.name) && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                        Technical details
                      </summary>
                      <div className="mt-1 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                        {error.name && <div><span className="text-foreground">name:</span> {error.name}</div>}
                        {error.details && <div><span className="text-foreground">details:</span> {error.details}</div>}
                        {error.hint && <div><span className="text-foreground">hint:</span> {error.hint}</div>}
                      </div>
                    </details>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={fetchPreview}
                  disabled={loading}
                  className="h-7 shrink-0"
                >
                  <Repeat className={cn("size-3", loading && "animate-spin")} />
                  Retry
                </Button>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              No contacts match the current filters.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                <span className="font-semibold text-foreground">{totalCount}</span> contact{totalCount === 1 ? "" : "s"} will be exported · showing first {rows.length} ·{" "}
                <span className="font-medium text-foreground">{columns.length}</span> column{columns.length === 1 ? "" : "s"} · selection:{" "}
                <span className="font-medium text-foreground">
                  {selectionMode === "all" && "All contacts"}
                  {selectionMode === "folder" && (folderId === "all" ? "All folders" : "Folder")}
                  {selectionMode === "event" && "Event"}
                  {selectionMode === "range" && (rangeMode === "rolling" ? `Last ${daysBack} day${daysBack === "1" ? "" : "s"}` : "Date range")}
                  {selectionMode === "manual" && `${selectedContactIds.size} hand-picked`}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mb-2">
                Header shows the friendly label on top and the exact CSV field key (matching the exported file) underneath.
              </p>
              {csvIssues.length > 0 ? (
                <div className={cn(
                  "mb-2 rounded border text-xs",
                  errorCount > 0
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-amber-500/40 bg-amber-500/5",
                )}>
                  <div className="px-2.5 py-1.5 font-medium flex items-center gap-2">
                    {errorCount > 0 ? "⚠ CSV issues detected" : "⚠ Heads up"}
                    {errorCount > 0 && <Badge variant="destructive" className="h-4 px-1.5">{errorCount} error{errorCount === 1 ? "" : "s"}</Badge>}
                    {warnCount > 0 && <Badge variant="outline" className="h-4 px-1.5">{warnCount} warning{warnCount === 1 ? "" : "s"}</Badge>}
                  </div>
                  <ul className="px-3 pb-2 space-y-0.5 list-disc list-inside">
                    {csvIssues.map((i, idx) => (
                      <li key={idx} className={cn(i.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
                        {i.message}{i.location ? ` (${i.location})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">✓ No CSV formatting issues detected.</p>
              )}
              {missingByColumn.length > 0 && (
                <div className={cn(
                  "mb-2 rounded border text-xs",
                  fullyEmptyColumns.length > 0
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-amber-500/30 bg-amber-500/5",
                )}>
                  <div className="px-2.5 py-1.5 font-medium flex items-center gap-2 flex-wrap">
                    <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Missing values in selected columns</span>
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                      {missingByColumn.length} column{missingByColumn.length === 1 ? "" : "s"}
                    </Badge>
                    {fullyEmptyColumns.length > 0 && (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                        {fullyEmptyColumns.length} fully empty
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (sampled on this page — {rows.length} row{rows.length === 1 ? "" : "s"})
                    </span>
                  </div>
                  <ul className="px-3 pb-2 space-y-0.5 list-disc list-inside text-amber-700 dark:text-amber-400">
                    {missingByColumn.slice(0, 10).map((m) => (
                      <li key={m.key}>
                        <span className="font-medium">{m.label}</span>{" "}
                        <span className="font-mono text-[10px] text-muted-foreground">({m.key})</span>{" "}
                        — <span className="font-medium">{m.missing}/{m.total}</span> blank
                        {" · "}
                        <span className="font-medium">{m.pct}%</span> missing
                        {m.missing === m.total && (
                          <span className="ml-1 text-destructive font-medium">— column will be empty in CSV</span>
                        )}
                      </li>
                    ))}
                    {missingByColumn.length > 10 && (
                      <li className="text-muted-foreground">…and {missingByColumn.length - 10} more</li>
                    )}
                  </ul>
                  <div className="px-3 pb-2 text-[10px] text-muted-foreground">
                    Tip: enrich your contacts (Pipedrive / LinkedIn / web) or remove unused columns to fill these gaps.
                  </div>
                </div>
              )}
              <ScrollArea className="h-64 rounded border bg-background">
                <table className="text-[11px] font-mono w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {columns.map((c) => {
                        const friendly = ALL_COLUMNS.find((col) => col.key === c)?.label ?? c;
                        const miss = missingByColumn.find((m) => m.key === c);
                        return (
                          <th key={c} className="text-left p-2 border-b align-top whitespace-nowrap">
                            <div className="font-semibold text-foreground">{friendly}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{c}</div>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className={cn("inline-block px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wide", typeStyle[columnTypes[c]])}>
                                {columnTypes[c]}
                              </span>
                              {miss && (
                                <span
                                  className={cn(
                                    "inline-block px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wide",
                                    miss.missing === miss.total
                                      ? "bg-destructive/10 text-destructive border-destructive/40"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40",
                                  )}
                                  title={`${miss.missing} of ${miss.total} sampled rows are blank for this column`}
                                >
                                  {miss.pct}% missing
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                        {columns.map((c) => (
                          <td key={c} className="p-2 align-top whitespace-nowrap max-w-[220px] truncate">
                            {r[c] === null || r[c] === undefined || r[c] === "" ? (
                              <span className="text-muted-foreground/50 italic">∅</span>
                            ) : String(r[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              {(() => {
                const totalPages = Math.max(1, Math.ceil(totalCount / previewLimit));
                const from = totalCount === 0 ? 0 : page * previewLimit + 1;
                const to = Math.min(totalCount, page * previewLimit + rows.length);
                const canPrev = page > 0 && !loading;
                const canNext = page < totalPages - 1 && !loading;
                return (
                  <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                    <div className="text-[11px] text-muted-foreground">
                      Showing <span className="font-medium text-foreground">{from}</span>–
                      <span className="font-medium text-foreground">{to}</span> of{" "}
                      <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> matching contact{totalCount === 1 ? "" : "s"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button" size="sm" variant="outline" className="h-7 px-2"
                        disabled={!canPrev}
                        onClick={() => setPage(0)}
                        title="First page"
                      >
                        «
                      </Button>
                      <Button
                        type="button" size="sm" variant="outline" className="h-7 px-2"
                        disabled={!canPrev}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        title="Previous page"
                      >
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      <div className="flex items-center gap-1 text-[11px] px-1">
                        <span className="text-muted-foreground">Page</span>
                        <Input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={page + 1}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n)) return;
                            const clamped = Math.max(1, Math.min(totalPages, Math.floor(n)));
                            setPage(clamped - 1);
                          }}
                          className="h-7 w-14 text-center text-[11px] px-1"
                        />
                        <span className="text-muted-foreground">of {totalPages}</span>
                      </div>
                      <Button
                        type="button" size="sm" variant="outline" className="h-7 px-2"
                        disabled={!canNext}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        title="Next page"
                      >
                        <ChevronRight className="size-3.5" />
                      </Button>
                      <Button
                        type="button" size="sm" variant="outline" className="h-7 px-2"
                        disabled={!canNext}
                        onClick={() => setPage(totalPages - 1)}
                        title="Last page"
                      >
                        »
                      </Button>
                    </div>
                  </div>
                );
              })()}
              <details className="mt-2">
                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">View raw CSV</summary>
                <pre className="text-[11px] font-mono p-2 mt-1 rounded border bg-background whitespace-pre overflow-x-auto">{previewCsv}</pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LastRunStatusPanel — inline per-schedule status of the most recent run with
// per-recipient delivery state and links to the Resend delivery record.
// =============================================================================
function LastRunStatusPanel({
  scheduleId,
  onOpenHistory,
}: {
  scheduleId: string;
  onOpenHistory: () => void;
}) {
  const { data: run, isLoading } = useQuery({
    queryKey: ["export-schedule-last-run", scheduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_schedule_runs")
        .select("id, status, created_at, delivery_status, recipient_count, contact_count, error_message, manual, range_label")
        .eq("schedule_id", scheduleId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Loading last run…
      </div>
    );
  }
  if (!run) {
    return (
      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
        No runs yet — use Test or Run to fire the first one.
      </div>
    );
  }

  const deliveries: Array<{
    recipient: string;
    role?: "to" | "cc" | "bcc";
    messageId: string | null;
    status: "queued" | "sent" | "delivered" | "failed" | "bounced";
    error?: string;
    sentAt?: string;
  }> = Array.isArray(run.delivery_status) ? (run.delivery_status as any) : [];

  const counts = deliveries.reduce(
    (acc, d) => {
      const k = (d.status || "queued") as keyof typeof acc;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    { queued: 0, sent: 0, delivered: 0, failed: 0, bounced: 0 } as Record<string, number>,
  );

  const overallTone =
    run.status === "success" ? "text-emerald-600" :
    run.status === "partial" ? "text-amber-600" :
    run.status === "failure" ? "text-destructive" : "text-muted-foreground";

  const StatusIcon =
    run.status === "success" ? CheckCircle2 :
    run.status === "failure" ? XCircle :
    run.status === "partial" ? AlertCircle : Clock;

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <StatusIcon className={cn("size-3.5", overallTone)} />
          <span className={cn("font-medium capitalize", overallTone)}>{run.status}</span>
          <span className="text-muted-foreground">
            · {format(new Date(run.created_at), "MMM d, HH:mm")}
            {run.manual ? " · manual" : ""}
            {run.range_label ? ` · ${run.range_label}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {counts.delivered > 0 && <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">✓ {counts.delivered} delivered</Badge>}
          {counts.sent > 0 && <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-600">↗ {counts.sent} sent</Badge>}
          {counts.queued > 0 && <Badge variant="outline" className="text-[10px]">⏳ {counts.queued} queued</Badge>}
          {counts.bounced > 0 && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">↩ {counts.bounced} bounced</Badge>}
          {counts.failed > 0 && <Badge variant="destructive" className="text-[10px]">✕ {counts.failed} failed</Badge>}
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onOpenHistory}>
            <History className="size-3 mr-1" /> Full log
          </Button>
        </div>
      </div>

      {deliveries.length > 0 && (
        <div className="space-y-1">
          {deliveries.slice(0, 4).map((d, i) => {
            const resendUrl = d.messageId
              ? `https://resend.com/emails/${d.messageId}`
              : null;
            const tone =
              d.status === "delivered" ? "text-emerald-600" :
              d.status === "sent" ? "text-sky-600" :
              d.status === "failed" || d.status === "bounced" ? "text-destructive" :
              "text-muted-foreground";
            return (
              <div key={`${d.recipient}-${i}`} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {d.role && <span className="uppercase text-[9px] text-muted-foreground shrink-0">{d.role}</span>}
                  <span className="truncate">{d.recipient}</span>
                  <span className={cn("shrink-0 capitalize", tone)}>· {d.status}</span>
                </div>
                {resendUrl ? (
                  <a
                    href={resendUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary hover:underline shrink-0 font-mono"
                    title="Open Resend delivery record"
                  >
                    {d.messageId!.slice(0, 8)}↗
                  </a>
                ) : (
                  <span className="text-[10px] text-muted-foreground shrink-0">no id</span>
                )}
              </div>
            );
          })}
          {deliveries.length > 4 && (
            <button
              onClick={onOpenHistory}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              +{deliveries.length - 4} more recipients — view all
            </button>
          )}
        </div>
      )}

      {run.error_message && (
        <p className="text-[11px] text-destructive line-clamp-2">{run.error_message}</p>
      )}
    </div>
  );
}
