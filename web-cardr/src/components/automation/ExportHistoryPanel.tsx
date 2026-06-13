import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import {
  CheckCircle2, XCircle, Clock, RefreshCw, History, Users, Mail, AlertTriangle,
  Camera, TrendingUp, TrendingDown, Minus, EyeOff, Send, MailCheck, AlertOctagon,
  HelpCircle, FileCheck2, FileWarning, Paperclip, Link2, Copy, ShieldAlert, ShieldCheck, RotateCcw,
  ListTree, Activity, Search, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";

/**
 * Per-recipient delivery record stored on `export_schedule_runs.delivery_status`.
 * Captured at send time, then refreshed on demand by `check-export-delivery`,
 * which polls the email provider's GET /emails/{id} endpoint.
 */
/**
 * Structured error codes emitted by run-export-schedule. Keep this list in
 * sync with supabase/functions/run-export-schedule/errors.ts (catalog is
 * authoritative there). Codes are STABLE — never rename one in place.
 */
type ExportErrorCode =
  | "BCC_LEAK_TO"
  | "BCC_LEAK_CC"
  | "BCC_LEAK_TO_AND_CC"
  | "MISSING_TO_LIST"
  | "ROLE_LIST_MISMATCH_TO"
  | "ROLE_LIST_MISMATCH_CC"
  | "ATTACHMENT_FILENAME_INVALID"
  | "ATTACHMENT_EMPTY"
  | "ATTACHMENT_TOO_LARGE"
  | "ATTACHMENT_UPLOAD_FAILED"
  | "ATTACHMENT_SIGNED_URL_FAILED"
  | "ATTACHMENT_ZIPPED"
  | "ATTACHMENT_ZIP_FAILED"
  | "SEND_FAILED"
  | "NO_FAILED_RECIPIENTS";

const EXPORT_ERROR_CODES: readonly ExportErrorCode[] = [
  "BCC_LEAK_TO",
  "BCC_LEAK_CC",
  "BCC_LEAK_TO_AND_CC",
  "MISSING_TO_LIST",
  "ROLE_LIST_MISMATCH_TO",
  "ROLE_LIST_MISMATCH_CC",
  "ATTACHMENT_FILENAME_INVALID",
  "ATTACHMENT_EMPTY",
  "ATTACHMENT_TOO_LARGE",
  "ATTACHMENT_UPLOAD_FAILED",
  "ATTACHMENT_SIGNED_URL_FAILED",
  "ATTACHMENT_ZIPPED",
  "ATTACHMENT_ZIP_FAILED",
  "SEND_FAILED",
  "NO_FAILED_RECIPIENTS",
] as const;

const EXPORT_ERROR_CODE_SET = new Set<ExportErrorCode>(EXPORT_ERROR_CODES);

/**
 * Pull the structured `codes=A,B,C` prefix off a run's `error_message`.
 * The edge function persists codes as a leading prefix so we can extract +
 * filter without a schema migration. Mirrors `parseErrorCodes` in
 * supabase/functions/run-export-schedule/errors.ts.
 */
function parseRunErrorCodes(errorMessage: string | null | undefined): ExportErrorCode[] {
  if (!errorMessage) return [];
  const m = /^codes=([A-Z0-9_,]+)/.exec(errorMessage);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ExportErrorCode => EXPORT_ERROR_CODE_SET.has(s as ExportErrorCode));
}

/** Strip the `codes=…` prefix from `error_message` for human display. */
function stripCodePrefix(errorMessage: string | null | undefined): string | null {
  if (!errorMessage) return null;
  return errorMessage.replace(/^codes=[A-Z0-9_,]+\s*·\s*/, "").replace(/^codes=[A-Z0-9_,]+\s*$/, "") || null;
}

/** Short, human-friendly label for each error code shown in badges. */
const ERROR_CODE_LABELS: Record<ExportErrorCode, string> = {
  BCC_LEAK_TO: "Bcc leak (To)",
  BCC_LEAK_CC: "Bcc leak (Cc)",
  BCC_LEAK_TO_AND_CC: "Bcc leak (To+Cc)",
  MISSING_TO_LIST: "Missing To list",
  ROLE_LIST_MISMATCH_TO: "Role mismatch (To)",
  ROLE_LIST_MISMATCH_CC: "Role mismatch (Cc)",
  ATTACHMENT_FILENAME_INVALID: "Bad filename",
  ATTACHMENT_EMPTY: "Empty CSV",
  ATTACHMENT_TOO_LARGE: "CSV too large",
  ATTACHMENT_UPLOAD_FAILED: "Upload failed",
  ATTACHMENT_SIGNED_URL_FAILED: "Link failed",
  ATTACHMENT_ZIPPED: "Auto-zipped",
  ATTACHMENT_ZIP_FAILED: "Zip failed",
  SEND_FAILED: "Send failed",
  NO_FAILED_RECIPIENTS: "Nothing to retry",
};

interface DeliveryRecord {
  recipient: string;
  role: "to" | "cc" | "bcc";
  messageId: string | null;
  status: "queued" | "sent" | "delivered" | "bounced" | "complained" | "failed";
  error?: string;
  /** Structured error code from run-export-schedule. See ExportErrorCode. */
  errorCode?: ExportErrorCode;
  sentAt: string;
  lastCheckedAt?: string;
}

interface RunRow {
  id: string;
  schedule_id: string;
  status: string;
  contact_count: number;
  recipient_count: number;
  error_message: string | null;
  range_label: string | null;
  manual: boolean;
  created_at: string;
  delivery_status: DeliveryRecord[] | null;
}

/**
 * Snapshot persisted on `export_schedules.preview_snapshot` at create-time.
 * Lets us show drift between what the user previewed and what each run
 * actually delivered.
 */
interface PreviewSnapshot {
  capturedAt: string;
  rowCount: number | null;
  columns: string[];
  filters: {
    selectionMode?: string | null;
    folderId?: string | null;
    rangeMode?: string | null;
    daysBack?: number | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    tagIds?: string[];
    statuses?: string[];
    searchQuery?: string | null;
    contactIdCount?: number | null;
  };
}

interface ScheduleMeta {
  name: string;
  snapshot: PreviewSnapshot | null;
  /** Counts only — never the addresses themselves, so BCC stays private. */
  toCount: number;
  ccCount: number;
  bccCount: number;
  /** Configured delivery mode: 'attachment' attaches the CSV; 'inline' sends a download link. */
  deliveryMode: "attachment" | "inline";
}

/**
 * Pre-send attachment validation result, one row per export run.
 * Persisted by run-export-schedule and queried alongside runs so we can show
 * file-size / MIME / filename check status next to each entry.
 */
interface AttachmentValidation {
  run_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  outcome: "passed" | "failed" | "skipped";
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
  failure_reason: string | null;
}

/**
 * Header-invariant suppression audit (one row per offending recipient).
 * Written by run-export-schedule when a Bcc address collides with the
 * To/Cc list, forcing X-Original-* headers to be dropped for that delivery.
 * Surfaced in the UI so users can see exactly which recipient tripped which
 * invariant, and what the offending To/Cc collisions were.
 */
interface SuppressionAudit {
  run_id: string | null;
  bcc_recipient: string;
  conflicting_addresses: string[];
  reason: string;
  invariant: string;
}

type RecipientStatusFilter = "all" | "queued" | "sent" | "delivered" | "bounced" | "complained" | "failed";
type DeliveryModeFilter = "all" | "attachment" | "inline";

export default function ExportHistoryPanel() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [schedules, setSchedules] = useState<Record<string, ScheduleMeta>>({});
  const [validations, setValidations] = useState<Record<string, AttachmentValidation>>({});
  // Map runId → list of header-invariant suppression audits for that run.
  // Empty array (or missing key) means no Bcc/To-Cc collisions occurred.
  const [audits, setAudits] = useState<Record<string, SuppressionAudit[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "failure">("all");
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<RecipientStatusFilter>("all");
  const [deliveryModeFilter, setDeliveryModeFilter] = useState<DeliveryModeFilter>("all");
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [expandedClassification, setExpandedClassification] = useState<string | null>(null);
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
  const [refreshingDelivery, setRefreshingDelivery] = useState<string | null>(null);
  const [retryingRun, setRetryingRun] = useState<string | null>(null);
  const [errorCodeFilter, setErrorCodeFilter] = useState<"all" | ExportErrorCode>("all");
  // Per-run "find by message ID / recipient" search query. Keyed by run id so
  // each expanded delivery panel keeps its own paste buffer independently.
  const [recipientSearch, setRecipientSearch] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data: runRows } = await supabase
      .from("export_schedule_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: schedRows } = await supabase
      .from("export_schedules")
      .select("id,name,preview_snapshot,recipient_email,recipient_emails,cc_emails,bcc_emails,delivery_mode" as any);
    const map: Record<string, ScheduleMeta> = {};
    (schedRows || []).forEach((s: any) => {
      // Compute role counts but discard the actual addresses so BCC privacy
      // is preserved in the run-history UI.
      const toList: string[] = [
        ...(Array.isArray(s.recipient_emails) ? s.recipient_emails : []),
        ...(s.recipient_email ? [s.recipient_email] : []),
      ];
      const cc: string[] = Array.isArray(s.cc_emails) ? s.cc_emails : [];
      const bcc: string[] = Array.isArray(s.bcc_emails) ? s.bcc_emails : [];
      const norm = (e: string) => e.trim().toLowerCase();
      const toSet = new Set(toList.map(norm).filter(Boolean));
      const ccSet = new Set(cc.map(norm).filter(Boolean));
      const bccSet = new Set(bcc.map(norm).filter(Boolean));
      map[s.id] = {
        name: s.name,
        snapshot: (s.preview_snapshot as PreviewSnapshot | null) ?? null,
        toCount: toSet.size,
        ccCount: ccSet.size,
        bccCount: bccSet.size,
        deliveryMode: s.delivery_mode === "attachment" ? "attachment" : "inline",
      };
    });
    setSchedules(map);
    const runList = (runRows as unknown as RunRow[]) || [];
    setRuns(runList);

    // Pull attachment validation rows for the loaded runs in one query.
    // RLS scopes them to the current user, so we only get our own.
    const runIds = runList.map((r) => r.id);
    if (runIds.length > 0) {
      const { data: valRows } = await supabase
        .from("export_attachment_validations" as any)
        .select("run_id,file_name,mime_type,size_bytes,outcome,checks,failure_reason")
        .in("run_id", runIds);
      const valMap: Record<string, AttachmentValidation> = {};
      (valRows as unknown as AttachmentValidation[] | null)?.forEach((v) => {
        if (v.run_id) valMap[v.run_id] = v;
      });
      setValidations(valMap);

      // Pull header-invariant suppression audits for the same runs.
      // We surface the exact reason next to the offending Bcc recipient
      // in the delivery breakdown — see HEADERS.md (invariants P2/P3).
      const { data: auditRows } = await supabase
        .from("export_header_suppression_audits" as any)
        .select("run_id,bcc_recipient,conflicting_addresses,reason,invariant")
        .in("run_id", runIds);
      const auditMap: Record<string, SuppressionAudit[]> = {};
      (auditRows as unknown as SuppressionAudit[] | null)?.forEach((a) => {
        if (!a.run_id) return;
        (auditMap[a.run_id] ||= []).push(a);
      });
      setAudits(auditMap);
    } else {
      setValidations({});
      setAudits({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /**
   * Compute the effective delivery mode for a run: 'attachment' only when
   * the schedule is configured for it AND CSV validation didn't fail
   * (failed validation triggers an automatic inline fallback in run-export-schedule).
   */
  const effectiveDeliveryMode = (runId: string, scheduleId: string): "attachment" | "inline" => {
    const configured = schedules[scheduleId]?.deliveryMode ?? "inline";
    const v = validations[runId];
    return configured === "attachment" && (!v || v.outcome === "passed") ? "attachment" : "inline";
  };

  const filtered = runs.filter((r) => {
    if (filter !== "all") {
      const ok = r.status === "success" || r.status === "completed";
      if (filter === "success" ? !ok : ok) return false;
    }
    if (deliveryModeFilter !== "all") {
      if (effectiveDeliveryMode(r.id, r.schedule_id) !== deliveryModeFilter) return false;
    }
    if (recipientStatusFilter !== "all") {
      const recs = r.delivery_status ?? [];
      if (!recs.some((d) => d.status === recipientStatusFilter)) return false;
    }
    if (errorCodeFilter !== "all") {
      // Match either run-level codes (parsed from error_message prefix)
      // or per-recipient delivery codes — both are surfaced as filterable.
      const runCodes = parseRunErrorCodes(r.error_message);
      const recCodes = (r.delivery_status ?? [])
        .map((d) => d.errorCode)
        .filter((c): c is ExportErrorCode => !!c);
      if (!runCodes.includes(errorCodeFilter) && !recCodes.includes(errorCodeFilter)) return false;
    }
    return true;
  });

  const successCount = runs.filter(r => r.status === "success" || r.status === "completed").length;
  const failureCount = runs.length - successCount;

  /** Render a tiny drift badge: % delta vs. snapshot baseline rowCount. */
  const driftBadge = (snap: PreviewSnapshot | null, actual: number) => {
    if (!snap || snap.rowCount === null || snap.rowCount === undefined) return null;
    const baseline = snap.rowCount;
    const delta = actual - baseline;
    if (baseline === 0) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Camera className="size-2.5" />baseline 0 → {actual}
        </Badge>
      );
    }
    const pct = Math.round((delta / baseline) * 100);
    const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
    const tone =
      Math.abs(pct) <= 5
        ? "border-muted text-muted-foreground"
        : delta > 0
          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
          : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5";
    return (
      <Badge
        variant="outline"
        className={`text-[10px] gap-1 ${tone}`}
        title={`Preview snapshot expected ${baseline}, this run delivered ${actual} (${delta >= 0 ? "+" : ""}${delta})`}
      >
        <Icon className="size-2.5" />
        {delta >= 0 ? "+" : ""}{pct}% vs preview
      </Badge>
    );
  };

  /**
   * Roll the per-recipient delivery records up into a single status badge:
   * - failed:     anything failed at send time
   * - bounced:    any recipient bounced (hard delivery error)
   * - complained: any recipient marked as spam
   * - queued:     anything still in flight (queued / sent-not-yet-confirmed)
   * - delivered:  ALL recipients confirmed delivered
   * Returns null when we have no delivery info at all (legacy rows pre-migration).
   */
  const summarizeDelivery = (records: DeliveryRecord[] | null) => {
    if (!records || records.length === 0) return null;
    const counts = { delivered: 0, sent: 0, queued: 0, bounced: 0, complained: 0, failed: 0 };
    for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1;
    let overall: keyof typeof counts;
    if (counts.failed > 0) overall = "failed";
    else if (counts.bounced > 0) overall = "bounced";
    else if (counts.complained > 0) overall = "complained";
    else if (counts.queued > 0 || counts.sent > 0) overall = counts.queued > 0 ? "queued" : "sent";
    else overall = "delivered";
    return { overall, counts, total: records.length };
  };

  const deliveryBadgeStyle = (status: string) => {
    switch (status) {
      case "delivered":
        return { Icon: MailCheck, cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", label: "Delivered" };
      case "sent":
        return { Icon: Send, cls: "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10", label: "Sent" };
      case "queued":
        return { Icon: Clock, cls: "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10", label: "Queued" };
      case "bounced":
        return { Icon: AlertOctagon, cls: "border-destructive/40 text-destructive bg-destructive/10", label: "Bounced" };
      case "complained":
        return { Icon: AlertTriangle, cls: "border-amber-600/40 text-amber-700 dark:text-amber-300 bg-amber-600/10", label: "Complained" };
      case "failed":
        return { Icon: XCircle, cls: "border-destructive/40 text-destructive bg-destructive/10", label: "Failed" };
      default:
        return { Icon: HelpCircle, cls: "border-muted text-muted-foreground", label: status };
    }
  };

  const refreshDelivery = async (runId: string) => {
    setRefreshingDelivery(runId);
    try {
      const { data, error } = await supabase.functions.invoke("check-export-delivery", {
        body: { runId },
      });
      if (error) throw error;
      const updated = (data as { deliveries?: DeliveryRecord[] })?.deliveries;
      if (updated) {
        setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, delivery_status: updated } : r)));
        toast({ title: "Delivery status updated" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to refresh status";
      toast({ title: "Couldn't refresh delivery status", description: msg, variant: "destructive" });
    } finally {
      setRefreshingDelivery(null);
    }
  };

  /**
   * One-click retry for the failed/bounced recipients of a prior run.
   * Hands the prior run's id to run-export-schedule, which loads its
   * delivery_status, picks only the failed/bounced addresses (preserving
   * each one's original To/Cc/Bcc role to keep header invariants intact),
   * and creates a new run targeted at exactly those recipients.
   */
  const retryFailedRecipients = async (run: RunRow) => {
    const failedCount = (run.delivery_status ?? []).filter(
      (d) => d.status === "failed" || d.status === "bounced",
    ).length;
    if (failedCount === 0) {
      toast({
        title: "Nothing to retry",
        description: "This run has no failed or bounced recipients.",
      });
      return;
    }
    setRetryingRun(run.id);
    try {
      const { data, error } = await supabase.functions.invoke("run-export-schedule", {
        body: { scheduleId: run.schedule_id, retryFailedRunId: run.id },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; reason?: string; message?: string };
      if (result?.ok === false) {
        toast({
          title: "Retry didn't send",
          description: result.message || result.reason || "No recipients were retried.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Retry sent",
          description: `Re-sent to ${failedCount} previously-failed recipient${failedCount === 1 ? "" : "s"}.`,
        });
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Retry failed";
      toast({ title: "Couldn't retry failed recipients", description: msg, variant: "destructive" });
    } finally {
      setRetryingRun(null);
    }
  };

  const copyMessageId = async (id: string) => {
    try {
      toast({ title: "Message ID copied", description: id });
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  };

  /**
   * Build a CSV of the per-recipient send log for one run and trigger a
   * download in the browser. Columns: role, recipient, status, message_id,
   * error_code, error, sent_at, last_checked_at, attempts. RFC4180-ish:
   * fields containing commas, quotes, or newlines are wrapped in quotes
   * and embedded quotes are doubled.
   */
  const downloadRecipientLogCsv = (run: RunRow) => {
    const records = run.delivery_status ?? [];
    if (records.length === 0) {
      toast({ title: "Nothing to export", description: "This run has no per-recipient log entries." });
      return;
    }
    const cols = [
      "role", "recipient", "status", "message_id",
      "error_code", "error", "sent_at", "last_checked_at", "attempts",
    ] as const;
    const escapeCsv = (raw: unknown): string => {
      if (raw === null || raw === undefined) return "";
      const s = String(raw);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = records.map((d) => {
      // Mask BCC addresses to keep parity with the on-screen view — same
      // privacy guarantee that the inline panel makes.
      const recipient = d.role === "bcc" ? "(bcc recipient — hidden)" : d.recipient;
      return [
        d.role,
        recipient,
        d.status,
        d.messageId ?? "",
        d.errorCode ?? "",
        d.error ?? "",
        d.sentAt ?? "",
        d.lastCheckedAt ?? "",
        (d as unknown as { attempts?: number }).attempts ?? "",
      ].map(escapeCsv).join(",");
    });
    const csv = [cols.join(","), ...rows].join("\r\n") + "\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date(run.created_at).toISOString().replace(/[:T]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `export-run-${run.id.slice(0, 8)}-recipients-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Recipient log exported", description: `${records.length} row${records.length === 1 ? "" : "s"} downloaded.` });
  };

  const renderDeliveryPanel = (records: DeliveryRecord[], runAudits: SuppressionAudit[] = [], run?: RunRow) => {
    // Apply the active recipient-status filter inside the per-recipient panel
    // so the expanded view matches the toolbar selection.
    const visible = recipientStatusFilter === "all"
      ? records
      : records.filter((d) => d.status === recipientStatusFilter);

    // Index audits by canonicalized recipient string for O(1) lookup per row.
    // We match on lowercase-trim — the audit row stores the same raw address
    // string the edge function used as the delivery recipient.
    const auditByRecipient = new Map<string, SuppressionAudit>();
    for (const a of runAudits) {
      auditByRecipient.set(a.bcc_recipient.trim().toLowerCase(), a);
    }

    // "Find by Resend message ID" — paste any id (or substring of recipient
    // email for non-bcc rows) to instantly highlight the matching row. Matching
    // is case-insensitive and trims whitespace so a copied id with stray spaces
    // still resolves. BCC addresses are never matched by email — they remain
    // masked in the UI; operators must paste the message id to find them.
    const rawQuery = run ? recipientSearch[run.id] ?? "" : "";
    const query = rawQuery.trim().toLowerCase();
    const isMatch = (d: DeliveryRecord) => {
      if (!query) return false;
      if (d.messageId && d.messageId.toLowerCase().includes(query)) return true;
      if (d.role !== "bcc" && d.recipient.toLowerCase().includes(query)) return true;
      return false;
    };
    const matchCount = query ? visible.filter(isMatch).length : 0;

    return (
    <div className="mt-2 rounded-md border bg-muted/30 p-2.5 text-[11px] space-y-1.5">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Mail className="size-3 text-primary" />
        Per-recipient delivery
        <span className="text-muted-foreground font-normal">
          ({visible.length}{visible.length !== records.length ? ` / ${records.length}` : ""})
        </span>
        <div className="ml-auto flex items-center gap-2">
          {run && (() => {
            const failedCount = records.filter(
              (d) => d.status === "failed" || d.status === "bounced",
            ).length;
            if (failedCount === 0) return null;
            return (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1 border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => retryFailedRecipients(run)}
                disabled={retryingRun === run.id}
                title="Re-send only to recipients whose previous delivery failed or bounced. Each address keeps its original To/Cc/Bcc role and a new run is created so statuses are tracked again."
              >
                <RotateCcw className={`size-3 ${retryingRun === run.id ? "animate-spin" : ""}`} />
                {retryingRun === run.id ? "Retrying…" : `Retry failed · ${failedCount}`}
              </Button>
            );
          })()}
          {run && records.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => downloadRecipientLogCsv(run)}
              title="Download per-recipient send log as CSV (role, recipient, status, message ID, error)"
            >
              <FileCheck2 className="size-3" />
              Export CSV
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground font-normal">via Resend</span>
        </div>
      </div>

      {/* Find-by-id search. Pasting a Resend message ID (or recipient email
          fragment) instantly highlights matching rows below and reports the
          match count so operators can confirm a paste resolved to a row. */}
      {run && records.length > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <div className="relative flex-1">
            <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={rawQuery}
              onChange={(e) =>
                setRecipientSearch((prev) => ({ ...prev, [run.id]: e.target.value }))
              }
              placeholder="Paste Resend message ID to find a recipient…"
              className="h-7 pl-7 pr-7 text-[11px] font-mono"
              spellCheck={false}
              autoComplete="off"
            />
            {rawQuery && (
              <button
                type="button"
                onClick={() =>
                  setRecipientSearch((prev) => ({ ...prev, [run.id]: "" }))
                }
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          {query && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                matchCount > 0
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {matchCount} match{matchCount === 1 ? "" : "es"}
            </span>
          )}
        </div>
      )}

      {/* Top-level header-invariant banner: surfaces *that* an invariant fired
          on this run, so users notice it even when the offending recipient is
          a Bcc whose address row is masked below. */}
      {runAudits.length > 0 && (
        <div className="rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-destructive">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldAlert className="size-3" />
            Header invariant triggered
            <span className="font-normal opacity-80">
              · {runAudits.length} recipient{runAudits.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] opacity-90">
            X-Original-To / X-Original-Cc were suppressed for the affected
            deliveries to prevent a Bcc leak. See per-recipient details below.
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <div className="text-muted-foreground italic px-1 py-2">
          No recipients match the active status filter.
        </div>
      )}
      <div className="space-y-1">
        {visible.map((d, i) => {
          const style = deliveryBadgeStyle(d.status);
          const Icon = style.Icon;
          // Mask BCC addresses in the breakdown — show role only.
          const display = d.role === "bcc"
            ? <span className="italic text-muted-foreground">bcc recipient (hidden)</span>
            : <span className="font-mono break-all">{d.recipient}</span>;
          const audit = auditByRecipient.get(d.recipient.trim().toLowerCase());
          // When a search query is active, dim non-matches and highlight (with
          // a ring + auto-scroll) the rows whose message id or recipient matches.
          const matched = isMatch(d);
          const dimmed = query.length > 0 && !matched;
          return (
            <div
              key={i}
              ref={(el) => {
                // Auto-scroll the first matching row into view so a paste
                // immediately reveals the recipient even in a long log.
                if (el && matched && i === visible.findIndex(isMatch)) {
                  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }
              }}
              className={`flex items-start justify-between gap-2 rounded border bg-background px-2 py-1 transition-all ${
                matched ? "ring-2 ring-primary border-primary/50 bg-primary/5" : ""
              } ${dimmed ? "opacity-40" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase tracking-wide">
                    {d.role}
                  </Badge>
                  {display}
                  {audit && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 gap-0.5 border-destructive/40 text-destructive bg-destructive/10"
                      title={`Header invariant: ${audit.invariant}`}
                    >
                      <ShieldAlert className="size-2.5" />
                      headers suppressed
                    </Badge>
                  )}
                </div>
                {d.messageId && (
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="opacity-70">id:</span>
                    <span className="font-mono break-all">{d.messageId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 px-1 ml-0.5"
                      onClick={() => copyMessageId(d.messageId!)}
                      title="Copy Resend message ID"
                    >
                      <Copy className="size-2.5" />
                    </Button>
                  </div>
                )}
                {d.error && (
                  <div className="text-destructive text-[10px] break-words">{d.error}</div>
                )}
                {/* Exact header-invariant error message for this recipient.
                    Shown verbatim (the same `reason` string the edge function
                    persisted), plus the offending To/Cc collisions and the
                    invariant identifier so it's actionable. */}
                {audit && (
                  <div className="mt-1 rounded border border-destructive/30 bg-destructive/5 px-1.5 py-1 text-[10px] text-destructive space-y-0.5">
                    <div className="flex items-center gap-1 font-medium">
                      <ShieldAlert className="size-2.5" />
                      Header invariant
                      <code className="font-mono opacity-80">{audit.invariant}</code>
                    </div>
                    <div className="break-words">{audit.reason}</div>
                    {audit.conflicting_addresses.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        <span className="opacity-70">conflicts:</span>
                        {audit.conflicting_addresses.map((c, j) => (
                          <code key={j} className="font-mono rounded bg-background/60 px-1">
                            {c}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {d.lastCheckedAt && (
                  <div className="text-muted-foreground text-[10px]">
                    checked {formatDistanceToNow(new Date(d.lastCheckedAt), { addSuffix: true })}
                  </div>
                )}
              </div>
              <Badge variant="outline" className={`text-[10px] gap-1 shrink-0 ${style.cls}`}>
                <Icon className="size-2.5" />
                {style.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
    );
  };

  /**
   * Per-run classification debug view. Shows exactly how each recipient on the
   * run was classified into To, CC, or BCC by the edge function — so the
   * operator can verify that CC delivery happened and that no BCC address was
   * accidentally promoted to a visible header.
   *
   * Privacy contract:
   *  - To and CC addresses are shown verbatim (they're already visible to all
   *    other To/CC recipients in the email itself).
   *  - BCC addresses are NEVER displayed. We render a stable, non-reversible
   *    short fingerprint (first 8 hex chars of a per-session hash) so the
   *    operator can tell *that* there are N hidden recipients and recognize
   *    when the same BCC repeats across runs, without revealing the address.
   */
  /**
   * Per-recipient timeline of status transitions. We don't persist a full
   * event stream (sent → delivered → bounced); the source of truth is the
   * latest snapshot returned by the email provider. The timeline is derived:
   *
   *   1. Queued at `sentAt` — always present (the moment we accepted the send).
   *   2. Current status observed at `lastCheckedAt` (or `sentAt` if we never
   *      polled — i.e. the run hasn't been refreshed yet).
   *
   * That's enough to show "queued at 10:00 → bounced (last seen at 10:04)"
   * without inventing data we don't have. Hitting the Refresh button on the
   * run updates `lastCheckedAt` for every record, which surfaces here as the
   * "Last provider sync" line at the top.
   */
  const renderTimelinePanel = (records: DeliveryRecord[]) => {
    // Most-recent provider sync across all recipients = the run's overall
    // "last synced with email provider" timestamp.
    const lastSyncIso = records
      .map((d) => d.lastCheckedAt)
      .filter((t): t is string => Boolean(t))
      .sort()
      .pop();

    const fmt = (iso?: string) => {
      if (!iso) return "—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return format(d, "MMM d, HH:mm:ss");
    };
    const rel = (iso?: string) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return formatDistanceToNow(d, { addSuffix: true });
    };
    const elapsed = (fromIso: string, toIso?: string) => {
      const from = new Date(fromIso).getTime();
      const to = toIso ? new Date(toIso).getTime() : Date.now();
      const ms = Math.max(0, to - from);
      if (ms < 1000) return `${ms}ms`;
      const s = Math.round(ms / 1000);
      if (s < 60) return `${s}s`;
      const m = Math.floor(s / 60);
      const rs = s % 60;
      if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return rm ? `${h}h ${rm}m` : `${h}h`;
    };

    // Display-side privacy: BCC addresses are masked the same way the
    // delivery panel masks them.
    const display = (d: DeliveryRecord) =>
      d.role === "bcc"
        ? <span className="italic text-muted-foreground">bcc recipient (hidden)</span>
        : <span className="font-mono break-all">{d.recipient}</span>;

    // Style helpers reused for the terminal-event dot.
    const dotFor = (status: DeliveryRecord["status"]) => {
      switch (status) {
        case "delivered": return "bg-emerald-500";
        case "sent": return "bg-blue-500";
        case "bounced": return "bg-destructive";
        case "complained": return "bg-amber-500";
        case "failed": return "bg-destructive";
        case "queued":
        default: return "bg-muted-foreground";
      }
    };
    const labelFor = (status: DeliveryRecord["status"]) => {
      switch (status) {
        case "delivered": return "Delivered";
        case "sent": return "Sent (in transit)";
        case "bounced": return "Bounced";
        case "complained": return "Marked as spam";
        case "failed": return "Failed";
        case "queued":
        default: return "Queued (awaiting provider update)";
      }
    };

    return (
      <div className="mt-2 rounded-md border bg-muted/30 p-2.5 text-[11px] space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Activity className="size-3 text-primary" />
          Delivery timeline
          <span className="text-muted-foreground font-normal">({records.length})</span>
          <span className="ml-auto text-[10px] text-muted-foreground font-normal flex items-center gap-1">
            <Clock className="size-2.5" />
            Last provider sync:{" "}
            <span className="text-foreground" title={lastSyncIso ?? "never refreshed"}>
              {lastSyncIso ? `${fmt(lastSyncIso)} (${rel(lastSyncIso)})` : "never refreshed"}
            </span>
          </span>
        </div>

        <div className="space-y-2">
          {records.map((d, i) => {
            const stillQueued = d.status === "queued";
            const terminalIso = stillQueued ? undefined : (d.lastCheckedAt ?? d.sentAt);
            return (
              <div key={i} className="rounded border bg-background px-2 py-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase tracking-wide">
                    {d.role}
                  </Badge>
                  {display(d)}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {elapsed(d.sentAt, terminalIso)} {stillQueued ? "in queue" : "to terminal"}
                  </span>
                </div>
                {/* Two-step timeline rail */}
                <div className="mt-1.5 pl-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-muted-foreground inline-block" />
                    <span className="text-foreground">Queued</span>
                    <span className="text-muted-foreground" title={d.sentAt}>
                      · {fmt(d.sentAt)} ({rel(d.sentAt)})
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className={`size-1.5 rounded-full inline-block mt-1 ${dotFor(d.status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground">
                        {labelFor(d.status)}
                        {!stillQueued && terminalIso && (
                          <span className="text-muted-foreground" title={terminalIso}>
                            {" "}· last seen {fmt(terminalIso)} ({rel(terminalIso)})
                          </span>
                        )}
                        {stillQueued && (
                          <span className="text-muted-foreground">
                            {" "}— hit Refresh to re-poll the email provider
                          </span>
                        )}
                      </div>
                      {d.error && (
                        <div className="mt-0.5 text-destructive break-all">{d.error}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Transition times shown are derived from the latest provider snapshot.
          Use Refresh on the run to pull the most recent status from the email
          provider.
        </div>
      </div>
    );
  };

  const renderClassificationPanel = (records: DeliveryRecord[]) => {
    const toList = records.filter((d) => d.role === "to");
    const ccList = records.filter((d) => d.role === "cc");
    const bccList = records.filter((d) => d.role === "bcc");

    // Cheap, deterministic, non-cryptographic fingerprint. We're not trying to
    // resist offline brute force — the goal is just "two BCC entries with the
    // same address render the same chip", purely for visual cross-checking.
    const fingerprint = (s: string) => {
      const norm = s.trim().toLowerCase();
      let h = 0x811c9dc5;
      for (let i = 0; i < norm.length; i++) {
        h ^= norm.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return h.toString(16).padStart(8, "0").slice(0, 8);
    };

    const Section = ({
      label, color, items, redact,
    }: {
      label: string;
      color: string;
      items: DeliveryRecord[];
      redact: boolean;
    }) => (
      <div className="rounded border bg-background px-2 py-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide">
          <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${color}`}>
            {label}
          </Badge>
          <span className="text-muted-foreground">{items.length} recipient{items.length === 1 ? "" : "s"}</span>
          {redact && items.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] text-muted-foreground font-normal normal-case tracking-normal">
              <EyeOff className="size-2.5" />
              addresses redacted
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <div className="mt-1 text-[10px] italic text-muted-foreground">none</div>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1">
            {items.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
                title={redact ? "BCC address hidden — fingerprint shown for cross-run matching only" : d.recipient}
              >
                {redact ? (
                  <>
                    <EyeOff className="size-2.5 opacity-60" />
                    <span className="opacity-80">bcc·</span>
                    <span>{fingerprint(d.recipient)}</span>
                  </>
                ) : (
                  <span className="break-all">{d.recipient}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div className="mt-2 rounded-md border bg-muted/30 p-2.5 text-[11px] space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <ListTree className="size-3 text-primary" />
          Recipient classification
          <span className="text-muted-foreground font-normal">
            (To {toList.length} · Cc {ccList.length} · Bcc {bccList.length})
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground leading-snug">
          How each recipient on this run was placed into the outgoing email's
          To, Cc, or Bcc header. Use this to verify Cc delivery without ever
          exposing Bcc addresses — Bcc rows show a stable fingerprint instead
          of the email so you can still tell repeats apart across runs.
        </div>
        <Section
          label="To"
          color="border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-500/10"
          items={toList}
          redact={false}
        />
        <Section
          label="Cc"
          color="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
          items={ccList}
          redact={false}
        />
        <Section
          label="Bcc · hidden"
          color="border-dashed border-muted-foreground/40 text-muted-foreground bg-muted/30"
          items={bccList}
          redact={true}
        />
      </div>
    );
  };

  const renderSnapshotPanel = (snap: PreviewSnapshot) => {
    const f = snap.filters || {};
    const chips: { label: string; value: string }[] = [];
    if (f.selectionMode) chips.push({ label: "selection", value: String(f.selectionMode) });
    if (f.folderId) chips.push({ label: "folder", value: f.folderId.slice(0, 8) });
    if (f.rangeMode === "rolling" && f.daysBack != null) chips.push({ label: "window", value: `last ${f.daysBack}d` });
    if (f.rangeMode === "custom") chips.push({ label: "range", value: `${f.dateFrom ?? "?"} → ${f.dateTo ?? "?"}` });
    if (f.tagIds?.length) chips.push({ label: "tags", value: String(f.tagIds.length) });
    if (f.statuses?.length) chips.push({ label: "statuses", value: f.statuses.join(", ") });
    if (f.searchQuery) chips.push({ label: "search", value: `"${f.searchQuery}"` });
    if (f.contactIdCount != null) chips.push({ label: "hand-picked", value: String(f.contactIdCount) });

    return (
      <div className="mt-2 rounded-md border bg-muted/30 p-2.5 text-[11px] space-y-1.5">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Camera className="size-3 text-primary" />
          Preview snapshot
          <span className="text-muted-foreground font-normal">
            captured {formatDistanceToNow(new Date(snap.capturedAt), { addSuffix: true })}
          </span>
        </div>
        <div className="text-muted-foreground">
          Baseline rows: <span className="font-mono text-foreground">{snap.rowCount ?? "—"}</span>
          {" · "}
          Columns: <span className="font-mono text-foreground">{snap.columns.length}</span>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5">
                <span className="text-muted-foreground">{c.label}:</span>
                <span className="font-mono">{c.value}</span>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
          {snap.columns.map((c, i) => (
            <span key={c} className="inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 font-mono">
              <span className="text-muted-foreground">{i + 1}.</span>{c}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h3 className="font-semibold">Export History</h3>
          <Badge variant="secondary" className="text-xs">{runs.length} runs</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All ({runs.length})
          </Button>
          <Button
            variant={filter === "success" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("success")}
          >
            <CheckCircle2 className="size-3.5 mr-1" /> Success ({successCount})
          </Button>
          <Button
            variant={filter === "failure" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("failure")}
          >
            <XCircle className="size-3.5 mr-1" /> Failed ({failureCount})
          </Button>
          <select
            value={recipientStatusFilter}
            onChange={(e) => setRecipientStatusFilter(e.target.value as RecipientStatusFilter)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            title="Filter runs and recipients by delivery status"
          >
            <option value="all">All statuses</option>
            <option value="delivered">Delivered</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued</option>
            <option value="bounced">Bounced</option>
            <option value="complained">Complained</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={deliveryModeFilter}
            onChange={(e) => setDeliveryModeFilter(e.target.value as DeliveryModeFilter)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            title="Filter runs by delivery mode (CSV attachment vs inline link)"
          >
            <option value="all">All modes</option>
            <option value="attachment">CSV attached</option>
            <option value="inline">Download link</option>
          </select>
          <select
            value={errorCodeFilter}
            onChange={(e) => setErrorCodeFilter(e.target.value as "all" | ExportErrorCode)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            title="Filter runs by structured error code (e.g. BCC_LEAK_TO_AND_CC, MISSING_TO_LIST, SEND_FAILED)"
          >
            <option value="all">All error codes</option>
            {EXPORT_ERROR_CODES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(recipientStatusFilter !== "all" || deliveryModeFilter !== "all" || errorCodeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setRecipientStatusFilter("all"); setDeliveryModeFilter("all"); setErrorCodeFilter("all"); }}
              title="Clear status, delivery-mode & error-code filters"
            >
              Clear
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title={loading ? "Loading…" : "No export runs yet"}
          description="Once your scheduled exports execute, their status will appear here."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const ok = r.status === "success" || r.status === "completed";
            const meta = schedules[r.schedule_id];
            const snapshotOpen = expandedSnapshot === r.id;
            const deliveryOpen = expandedDelivery === r.id;
            const classificationOpen = expandedClassification === r.id;
            const timelineOpen = expandedTimeline === r.id;
            const summary = summarizeDelivery(r.delivery_status);
            const runAudits = audits[r.id] ?? [];
            const refreshing = refreshingDelivery === r.id;
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${ok ? "text-emerald-500" : "text-destructive"}`}>
                    {ok ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {meta?.name || "Deleted schedule"}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${ok
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-destructive/10 text-destructive"
                          }`}
                      >
                        {r.status}
                      </Badge>
                      {r.manual && (
                        <Badge variant="outline" className="text-[10px]">manual</Badge>
                      )}
                      {r.range_label && (
                        <Badge variant="outline" className="text-[10px]">{r.range_label}</Badge>
                      )}
                      {(() => {
                        const v = validations[r.id];
                        const configured = meta?.deliveryMode ?? "inline";
                        // Effective mode: attachment only when configured AND validation passed.
                        // Failed validation triggers an automatic inline fallback in run-export-schedule.
                        const effective: "attachment" | "inline" =
                          configured === "attachment" && (!v || v.outcome === "passed")
                            ? "attachment"
                            : "inline";
                        const fellBack = configured === "attachment" && effective === "inline";
                        const Icon = effective === "attachment" ? Paperclip : Link2;
                        const cls = fellBack
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                          : effective === "attachment"
                            ? "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/5"
                            : "border-muted text-muted-foreground";
                        const label = effective === "attachment" ? "CSV attached" : "Download link";
                        const tooltip = fellBack
                          ? `Configured as attachment, fell back to inline link (${v?.failure_reason ?? "validation failed"})`
                          : `Delivery mode: ${effective}`;
                        return (
                          <Badge variant="outline" className={`text-[10px] gap-1 ${cls}`} title={tooltip}>
                            <Icon className="size-2.5" />
                            {label}
                            {fellBack && <span className="opacity-70">· fallback</span>}
                          </Badge>
                        );
                      })()}
                      {ok && driftBadge(meta?.snapshot ?? null, r.contact_count)}
                      {(() => {
                        const v = validations[r.id];
                        if (!v) return null;
                        const sizeKb = Math.max(1, Math.round(v.size_bytes / 1024));
                        const failedChecks = v.checks.filter((c) => !c.passed).map((c) => c.name).join(", ");
                        const tooltip =
                          `Attachment validation: ${v.outcome.toUpperCase()}\n` +
                          `File: ${v.file_name}\n` +
                          `MIME: ${v.mime_type}\n` +
                          `Size: ${sizeKb} KB\n` +
                          (v.failure_reason ? `Reason: ${v.failure_reason}\n` : "") +
                          (failedChecks ? `Failed checks: ${failedChecks}` : "All checks passed");
                        if (v.outcome === "passed") {
                          return (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                              title={tooltip}
                            >
                              <FileCheck2 className="size-2.5" />
                              CSV verified · {sizeKb} KB
                            </Badge>
                          );
                        }
                        if (v.outcome === "failed") {
                          return (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              title={tooltip}
                            >
                              <FileWarning className="size-2.5" />
                              CSV check failed
                            </Badge>
                          );
                        }
                        return (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 text-muted-foreground"
                            title={tooltip}
                          >
                            <FileCheck2 className="size-2.5" />
                            CSV check skipped (inline)
                          </Badge>
                        );
                      })()}
                      {summary && (() => {
                        const style = deliveryBadgeStyle(summary.overall);
                        const Icon = style.Icon;
                        const tooltipParts = Object.entries(summary.counts)
                          .filter(([, n]) => n > 0)
                          .map(([k, n]) => `${k}: ${n}`)
                          .join(" · ");
                        return (
                          <Badge
                            variant="outline"
                            className={`text-[10px] gap-1 ${style.cls}`}
                            title={`Delivery breakdown — ${tooltipParts}`}
                          >
                            <Icon className="size-2.5" />
                            {style.label}
                            {summary.total > 1 && (
                              <span className="opacity-70">· {summary.counts[summary.overall]}/{summary.total}</span>
                            )}
                          </Badge>
                        );
                      })()}
                      {runAudits.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 border-destructive/40 text-destructive bg-destructive/10 cursor-pointer"
                          title={
                            runAudits
                              .map((a) => `${a.invariant}: ${a.reason}`)
                              .join("\n")
                          }
                          onClick={() => setExpandedDelivery(deliveryOpen ? null : r.id)}
                        >
                          <ShieldAlert className="size-2.5" />
                          Header invariant · {runAudits.length}
                        </Badge>
                      )}
                      {(() => {
                        // Surface structured error codes as filterable badges.
                        // Click a badge to filter the run list to that code.
                        const runCodes = parseRunErrorCodes(r.error_message);
                        const recCodes = Array.from(new Set(
                          (r.delivery_status ?? [])
                            .map((d) => d.errorCode)
                            .filter((c): c is ExportErrorCode => !!c),
                        ));
                        const allCodes = Array.from(new Set([...runCodes, ...recCodes]));
                        if (allCodes.length === 0) return null;
                        return allCodes.map((code) => (
                          <Badge
                            key={code}
                            variant="outline"
                            className="text-[10px] gap-1 border-destructive/40 text-destructive bg-destructive/5 cursor-pointer font-mono"
                            title={`${code} — click to filter runs by this code`}
                            onClick={() => setErrorCodeFilter(code)}
                          >
                            {code}
                            <span className="opacity-70 font-sans">· {ERROR_CODE_LABELS[code]}</span>
                          </Badge>
                        ));
                      })()}
                      {summary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] gap-1"
                          onClick={() => setExpandedDelivery(deliveryOpen ? null : r.id)}
                          title="Show per-recipient delivery status"
                        >
                          <Mail className="size-2.5" />
                          {deliveryOpen ? "Hide delivery" : "Delivery details"}
                        </Button>
                      )}
                      {r.delivery_status && r.delivery_status.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] gap-1"
                          onClick={() => setExpandedClassification(classificationOpen ? null : r.id)}
                          title="Show how each recipient was classified into To, Cc, or hidden Bcc — Bcc addresses are redacted"
                        >
                          <ListTree className="size-2.5" />
                          {classificationOpen ? "Hide classification" : "Recipient classification"}
                        </Button>
                      )}
                      {r.delivery_status && r.delivery_status.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] gap-1"
                          onClick={() => setExpandedTimeline(timelineOpen ? null : r.id)}
                          title="Show when each recipient transitioned from queued to delivered/bounced/complained, plus the last provider sync time"
                        >
                          <Activity className="size-2.5" />
                          {timelineOpen ? "Hide timeline" : "Delivery timeline"}
                        </Button>
                      )}
                      {summary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] gap-1"
                          onClick={() => refreshDelivery(r.id)}
                          disabled={refreshing}
                          title="Re-check the email provider for the latest delivery status"
                        >
                          <RefreshCw className={`size-2.5 ${refreshing ? "animate-spin" : ""}`} />
                          {refreshing ? "Checking…" : "Refresh"}
                        </Button>
                      )}
                      {summary && (summary.counts.failed > 0 || summary.counts.bounced > 0) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] gap-1 text-destructive hover:text-destructive"
                          onClick={() => retryFailedRecipients(r)}
                          disabled={retryingRun === r.id}
                          title="Re-send only to recipients whose previous delivery failed or bounced. Each address keeps its original To/Cc/Bcc role."
                        >
                          <RotateCcw className={`size-2.5 ${retryingRun === r.id ? "animate-spin" : ""}`} />
                          {retryingRun === r.id
                            ? "Retrying…"
                            : `Retry failed · ${(summary.counts.failed ?? 0) + (summary.counts.bounced ?? 0)}`}
                        </Button>
                      )}
                      {meta?.snapshot && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] gap-1"
                          onClick={() => setExpandedSnapshot(snapshotOpen ? null : r.id)}
                          title="Compare against the preview snapshot saved when this schedule was created"
                        >
                          <Camera className="size-2.5" />
                          {snapshotOpen ? "Hide snapshot" : "Compare to preview"}
                        </Button>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {format(new Date(r.created_at), "MMM d, yyyy 'at' HH:mm")}
                        <span className="opacity-70">
                          ({formatDistanceToNow(new Date(r.created_at), { addSuffix: true })})
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />{r.contact_count} contacts
                      </span>
                      <span className="flex items-center gap-1.5" title="Recipient role breakdown for this schedule. Bcc addresses are intentionally hidden — only the count is shown.">
                        <Mail className="size-3" />
                        <span className="inline-flex items-center gap-1">
                          {meta && meta.toCount > 0 && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5 font-normal">
                              To: {meta.toCount}
                            </Badge>
                          )}
                          {meta && meta.ccCount > 0 && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5 font-normal">
                              Cc: {meta.ccCount}
                            </Badge>
                          )}
                          {meta && meta.bccCount > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 h-4 px-1.5 font-normal gap-0.5 border-dashed"
                              title="Bcc recipient addresses are not displayed to protect their privacy"
                            >
                              <EyeOff className="size-2.5" />
                              Bcc: {meta.bccCount}
                            </Badge>
                          )}
                          {(!meta || meta.toCount + meta.ccCount + meta.bccCount === 0) && (
                            <span>{r.recipient_count} recipient{r.recipient_count === 1 ? "" : "s"}</span>
                          )}
                        </span>
                      </span>
                    </div>
                    {(() => {
                      // Affirmative recipient-handling audit. Renders on
                      // EVERY run (success or failure) so operators can
                      // confirm at a glance that CC/BCC counts matched
                      // configuration AND that no BCC address leaked into
                      // a visible header for the chosen delivery mode.
                      // Failures here become an amber/red banner with the
                      // exact mismatch; success becomes a single-line
                      // emerald confirmation.
                      const ds = r.delivery_status ?? [];
                      if (ds.length === 0) return null;
                      const sentCcCount = ds.filter((d) => d.role === "cc").length;
                      const sentBccCount = ds.filter((d) => d.role === "bcc").length;
                      const sentToCount = ds.filter((d) => d.role === "to").length;
                      const ccFailed = ds.filter((d) => d.role === "cc" && d.status === "failed").length;
                      const bccFailed = ds.filter((d) => d.role === "bcc" && d.status === "failed").length;
                      const codes = parseRunErrorCodes(r.error_message);
                      const leakCodes: ExportErrorCode[] = [
                        "BCC_LEAK_TO",
                        "BCC_LEAK_CC",
                        "BCC_LEAK_TO_AND_CC",
                      ];
                      const hadLeak = codes.some((c) => leakCodes.includes(c)) || runAudits.length > 0;
                      const expectedCc = meta?.ccCount ?? sentCcCount;
                      const expectedBcc = meta?.bccCount ?? sentBccCount;
                      const expectedTo = meta?.toCount ?? sentToCount;
                      const ccMismatch = sentCcCount !== expectedCc;
                      const bccMismatch = sentBccCount !== expectedBcc;
                      const toMismatch = sentToCount !== expectedTo;
                      const issues: string[] = [];
                      if (toMismatch) issues.push(`To: sent to ${sentToCount}/${expectedTo}`);
                      if (ccMismatch) issues.push(`CC: sent to ${sentCcCount}/${expectedCc}`);
                      if (bccMismatch) issues.push(`BCC: sent to ${sentBccCount}/${expectedBcc}`);
                      if (ccFailed > 0) issues.push(`CC failures: ${ccFailed}`);
                      if (bccFailed > 0) issues.push(`BCC failures: ${bccFailed}`);
                      if (hadLeak) issues.push(`BCC header leak suppressed (${runAudits.length || codes.filter((c) => leakCodes.includes(c)).length})`);
                      // No CC and no BCC configured → audit isn't useful.
                      if (expectedCc === 0 && expectedBcc === 0 && !hadLeak) return null;
                      const ok = issues.length === 0;
                      const cls = ok
                        ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400";
                      const Icon = ok ? ShieldCheck : ShieldAlert;
                      const summary = ok
                        ? `CC ${sentCcCount}/${expectedCc} · BCC ${sentBccCount}/${expectedBcc} delivered with headers correctly scoped — no BCC leaked into To/Cc.`
                        : `CC/BCC handling issues: ${issues.join(" · ")}.`;
                      const tooltip = [
                        `Delivery mode: ${meta?.deliveryMode ?? "inline"}`,
                        `To: ${sentToCount}/${expectedTo} sent`,
                        `CC: ${sentCcCount}/${expectedCc} sent` + (ccFailed > 0 ? ` (${ccFailed} failed)` : ""),
                        `BCC: ${sentBccCount}/${expectedBcc} sent` + (bccFailed > 0 ? ` (${bccFailed} failed)` : ""),
                        hadLeak
                          ? `BCC header leak — visible headers were suppressed for ${runAudits.length || "?"} delivery to prevent address exposure.`
                          : `No BCC address appeared in any visible To/Cc header.`,
                      ].join("\n");
                      return (
                        <div
                          className={`mt-2 flex items-start gap-2 rounded-md border p-2 text-xs ${cls}`}
                          title={tooltip}
                        >
                          <Icon className="size-3.5 mt-0.5 shrink-0" />
                          <span className="break-words">
                            <span className="font-medium">Recipient handling audit:</span>{" "}
                            {summary}
                          </span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const human = stripCodePrefix(r.error_message);
                      if (!human) return null;
                      // The edge function joins `fallbackReason · lastError`.
                      // Split them apart so degraded-but-successful runs show
                      // an informational amber notice instead of a scary red
                      // error box. Codes parsed from the prefix tell us
                      // whether a fallback actually happened.
                      const codes = parseRunErrorCodes(r.error_message);
                      const fallbackCodes: ExportErrorCode[] = [
                        "ATTACHMENT_TOO_LARGE",
                        "ATTACHMENT_UPLOAD_FAILED",
                        "ATTACHMENT_SIGNED_URL_FAILED",
                        "ATTACHMENT_FILENAME_INVALID",
                        "ATTACHMENT_EMPTY",
                        "ATTACHMENT_ZIP_FAILED",
                      ];
                      const hasFallback = codes.some((c) => fallbackCodes.includes(c));
                      // Split on the joiner used in run-export-schedule
                      // (`fallbackReason · lastError`). When no joiner is
                      // present, the whole string is either a fallback or
                      // a send error depending on which codes are set.
                      const parts = human.split(" · ");
                      const sendFailed = codes.includes("SEND_FAILED");
                      let fallbackText: string | null = null;
                      let errorText: string | null = null;
                      if (hasFallback && sendFailed && parts.length >= 2) {
                        // First chunk is the fallback reason, the rest is
                        // the actual provider error.
                        fallbackText = parts[0];
                        errorText = parts.slice(1).join(" · ");
                      } else if (hasFallback) {
                        fallbackText = human;
                      } else {
                        errorText = human;
                      }
                      return (
                        <div className="mt-2 space-y-1.5">
                          {fallbackText && (
                            <div
                              className="flex items-start gap-2 rounded-md bg-amber-500/5 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-400"
                              title="Attachment delivery degraded — recipients still got the data via inline / download link."
                            >
                              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                              <span className="break-words">
                                <span className="font-medium">Attachment fell back to inline:</span>{" "}
                                {fallbackText}
                              </span>
                            </div>
                          )}
                          {errorText && (
                            <div className="flex items-start gap-2 rounded-md bg-destructive/5 border border-destructive/20 p-2 text-xs text-destructive">
                              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                              <span className="break-words">{errorText}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {snapshotOpen && meta?.snapshot && renderSnapshotPanel(meta.snapshot)}
                    {deliveryOpen && r.delivery_status && r.delivery_status.length > 0 &&
                      renderDeliveryPanel(r.delivery_status, runAudits, r)}
                    {classificationOpen && r.delivery_status && r.delivery_status.length > 0 &&
                      renderClassificationPanel(r.delivery_status)}
                    {timelineOpen && r.delivery_status && r.delivery_status.length > 0 &&
                      renderTimelinePanel(r.delivery_status)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
