import { useCallback, useEffect, useState } from "react";
import { Activity, Calendar as CalIcon, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useSubscription, type PlanType } from "@/hooks/useSubscription";
import { hidePaidSurfaces, isIosPlatform } from "@/lib/iosCompliance";

/**
 * iOS Subscription Status & Debug Panel.
 *
 * Read-only diagnostic surface for renewal issues. Shows:
 *   - Current plan + status (from `subscriptions`)
 *   - Period end / renewal date + auto-renew + StoreKit environment
 *   - Latest validation attempt from `ios_receipt_validations`
 *     (Apple status code, source, timestamp)
 *
 * Mounted only on native iOS where `hidePaidSurfaces()` is true. Renders
 * NO purchase or upgrade CTAs — strictly informational.
 *
 * Auto-refreshes when the global `subscription:refresh` event fires (after
 * a purchase, renewal, or restore validate call), and exposes a manual
 * "Re-check" button that re-reads the latest validation row.
 */

interface ValidationRow {
  id: string;
  status: number | null;
  environment: string | null;
  source: string | null;
  product_id: string | null;
  expires_at: string | null;
  auto_renew_status: boolean | null;
  is_trial: boolean | null;
  created_at: string;
}

const PLAN_LABEL: Record<PlanType, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  teams: "Teams",
};

// Apple status code → human label. Truncated to the codes most useful for
// diagnosing renewal issues (full list: developer.apple.com /docs/.../status).
const APPLE_STATUS: Record<number, string> = {
  0: "Valid",
  21000: "Bad request to Apple",
  21002: "Receipt malformed",
  21003: "Receipt not authenticated",
  21004: "Shared secret mismatch",
  21005: "Apple service unavailable",
  21006: "Receipt valid, subscription expired",
  21007: "Sandbox receipt sent to production",
  21008: "Production receipt sent to sandbox",
  21010: "Receipt could not be authorized",
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const formatRelative = (iso: string | null | undefined) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (Math.abs(sec) < 60) return "just now";
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-2 py-1.5">
    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">
      {label}
    </span>
    <span className="text-[12px] font-medium text-foreground text-right break-all">
      {value}
    </span>
  </div>
);

const IosSubscriptionStatusPanel = ({ className = "" }: { className?: string }) => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [latest, setLatest] = useState<ValidationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLatest(null);
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: qErr } = await supabase
      .from("ios_receipt_validations")
      .select("id, status, environment, source, product_id, expires_at, auto_renew_status, is_trial, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (qErr) {
      setError(qErr.message);
      setLatest(null);
    } else {
      setLatest((data as ValidationRow | null) ?? null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  // Reload when the receipt sync hook dispatches a refresh event (purchase,
  // renewal, restore). Keeps the panel in lockstep with subscription state.
  useEffect(() => {
    const onRefresh = () => { void load(); };
    window.addEventListener("subscription:refresh", onRefresh);
    return () => window.removeEventListener("subscription:refresh", onRefresh);
  }, [load]);

  // Render guard: only show on native iOS surfaces (mirrors IosPlanStatusCard).
  if (!hidePaidSurfaces() && !isIosPlatform()) return null;

  const planLabel = PLAN_LABEL[subscription.plan] ?? "Starter";
  const isPaid = subscription.plan !== "starter";
  const statusOk = latest?.status === 0;
  const statusLabel =
    latest?.status === null || latest?.status === undefined
      ? "No validation yet"
      : `${latest.status} — ${APPLE_STATUS[latest.status] ?? "Unknown"}`;

  const handleRefresh = () => {
    setRefreshing(true);
    void load();
  };

  return (
    <div
      className={`rounded-2xl border border-border bg-card/60 p-4 ${className}`}
      role="region"
      aria-label="iOS subscription status (debug)"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isPaid ? "bg-primary/15" : "bg-secondary/80"
            }`}
          >
            {isPaid ? (
              <Crown size={15} className="text-primary" />
            ) : (
              <Sparkles size={15} className="text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Subscription status
            </p>
            <p className="text-sm font-display font-bold text-foreground truncate">
              {planLabel}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-border bg-secondary/60 hover:bg-secondary disabled:opacity-50 transition-colors"
          aria-label="Re-check subscription status"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Checking…" : "Re-check"}
        </button>
      </div>

      {/* Top-line summary */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Status
          </p>
          <span
            className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
              subscription.status === "active" ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            <Activity size={11} />
            {subscription.status}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}
          </p>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground">
            <CalIcon size={11} className="text-muted-foreground" />
            {subscription.currentPeriodEnd
              ? formatDateTime(subscription.currentPeriodEnd)
              : "—"}
          </span>
        </div>
      </div>

      {/* Latest validation summary */}
      <div
        className={`rounded-lg border p-2.5 ${
          loading
            ? "border-border bg-secondary/40"
            : statusOk
            ? "border-emerald-500/30 bg-emerald-500/10"
            : latest
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-border bg-secondary/40"
        }`}
      >
        <div className="flex items-start gap-2">
          {loading ? (
            <RefreshCw size={13} className="text-muted-foreground animate-spin mt-0.5" />
          ) : statusOk ? (
            <CheckCircle2 size={13} className="text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle size={13} className={latest ? "text-amber-400 mt-0.5" : "text-muted-foreground mt-0.5"} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Last validation
            </p>
            <p className="text-[12px] font-semibold text-foreground">
              {loading ? "Loading…" : statusLabel}
            </p>
            {error && (
              <p className="text-[11px] text-destructive mt-0.5">{error}</p>
            )}
            {latest && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatRelative(latest.created_at)} · {latest.source ?? "unknown"}
                {latest.environment ? ` · ${latest.environment}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Expandable raw fields — useful when filing a support ticket */}
      {latest && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground py-1.5"
            aria-expanded={expanded}
          >
            <span>Validation details</span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {expanded && (
            <div className="mt-1 px-2 py-1 rounded-md bg-background/40 border border-border divide-y divide-border/60">
              <Field label="Product" value={latest.product_id ?? "—"} />
              <Field label="Environment" value={latest.environment ?? "—"} />
              <Field label="Auto-renew" value={
                latest.auto_renew_status === null
                  ? "—"
                  : latest.auto_renew_status ? "On" : "Off"
              } />
              <Field label="Trial" value={latest.is_trial ? "Yes" : "No"} />
              <Field label="Receipt expires" value={formatDateTime(latest.expires_at)} />
              <Field label="Checked at" value={formatDateTime(latest.created_at)} />
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3 leading-snug">
        This panel is for diagnosing renewal issues. Manage your plan at cardr.ai.
      </p>
    </div>
  );
};

export default IosSubscriptionStatusPanel;
