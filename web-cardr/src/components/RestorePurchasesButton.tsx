import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, Info, AlertCircle, X, Clock, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { tap, success as hapticSuccess } from "@/lib/native";
import {
  useRestoreBannerPref,
  RESTORE_BANNER_AUTO_DISMISS_MS,
  RESTORE_BANNER_CLEAR_EVENT,
} from "@/hooks/useRestoreBannerPref";
import { useIosReceiptSync } from "@/hooks/useIosReceiptSync";
import { hasStoreKitBridge, restoreStoreKitPurchases } from "@/lib/storekit";
import { isIosPlatform } from "@/lib/iosCompliance";
import {
  useLastRestoreAt,
  recordRestore,
  formatRelativeTime,
  useLastRestoreStatus,
  persistRestoreStatus,
} from "@/hooks/useLastRestoreAt";
import { parseCheckSubscription } from "@/lib/subscriptionValidation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { startRestoreAttempt } from "@/lib/restoreLogger";
import { trackEvent } from "@/lib/eventTracking";

/**
 * Apple-compliant "Restore purchases" control for native iOS.
 *
 * - Does NOT navigate anywhere and does NOT open any external link.
 * - Re-syncs the user's subscription from the backend (Stripe via
 *   `check-subscription`) so a Pro/Business plan purchased on the web
 *   becomes visible again after a fresh install or re-login.
 * - Shows the outcome inline via a banner directly under the button
 *   (and a toast as a secondary cue).
 *
 * When (in a future v1.1) Apple In-App Purchases are added, this same
 * button will additionally call the StoreKit/RevenueCat restore API.
 */
interface Props {
  /** Optional callback fired after a successful restore (e.g. close a modal). */
  onRestored?: (plan: string, subscribed: boolean) => void;
  className?: string;
  variant?: "primary" | "ghost";
  /**
   * Override the inline banner auto-dismiss behaviour.
   * - `number` → dismiss after that many ms.
   * - `false`  → never auto-dismiss (manual ✕ only).
   * - `undefined` (default) → follow the user's iOS setting (Settings →
   *   Plan & Usage → "Auto-dismiss restore status"), which defaults to on.
   */
  autoDismissMs?: number | false;
}

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter (free)",
  pro: "Pro",
  business: "Business",
  teams: "Teams",
};

type Status =
  | { kind: "success"; title: string; description: string }
  | { kind: "info"; title: string; description: string }
  | { kind: "error"; title: string; description: string }
  | { kind: "offline"; title: string; description: string };

const STATUS_STYLES: Record<Status["kind"], { wrap: string; icon: JSX.Element; title: string }> = {
  success: {
    wrap: "border-emerald-500/30 bg-emerald-500/10",
    icon: <CheckCircle2 size={14} className="text-emerald-400" />,
    title: "text-emerald-300",
  },
  info: {
    wrap: "border-border bg-secondary/60",
    icon: <Info size={14} className="text-muted-foreground" />,
    title: "text-foreground",
  },
  error: {
    wrap: "border-destructive/40 bg-destructive/10",
    icon: <AlertCircle size={14} className="text-destructive" />,
    title: "text-destructive",
  },
  offline: {
    wrap: "border-amber-500/30 bg-amber-500/10",
    icon: <WifiOff size={14} className="text-amber-400" />,
    title: "text-amber-300",
  },
};

const RestorePurchasesButton = ({
  onRestored,
  className = "",
  variant = "ghost",
  autoDismissMs,
}: Props) => {
  const [loading, setLoading] = useState(false);
  // Hydrate banner from persisted last result so navigating away and back
  // keeps the user's most recent restore outcome visible.
  const persistedStatus = useLastRestoreStatus();
  const [status, setStatusInternal] = useState<Status | null>(
    () => (persistedStatus as Status | null) ?? null,
  );
  const { autoDismiss: prefAutoDismiss } = useRestoreBannerPref();
  const { validate } = useIosReceiptSync();
  const lastRestoreAt = useLastRestoreAt();
  const online = useOnlineStatus();
  /**
   * Dedicated screen-reader announcement channel for banner lifecycle
   * transitions (appeared / auto-dismissed / manually dismissed). The
   * visible banner already announces its title+description on appear via
   * its own aria-live region; this channel adds the *transition* context
   * (e.g. "Restore status dismissed") that sighted users get from the
   * fade-out animation.
   */
  const [announcement, setAnnouncement] = useState<string>("");
  const announce = useCallback((message: string) => {
    // Reset to empty first so screen readers re-announce identical messages.
    setAnnouncement("");
    // Defer slightly so the empty state is observed before the new value.
    window.setTimeout(() => setAnnouncement(message), 30);
  }, []);

  /**
   * Single setter that mirrors every visible status to localStorage so
   * other instances of this button (and remounts) see the same banner.
   * `transient: true` skips persistence — used for the network-event
   * driven offline banner so we don't write a stale banner to disk.
   * `dismissReason` triggers a screen-reader announcement when a banner
   * is being cleared so the transition isn't silent.
   */
  const applyStatus = useCallback(
    (
      next: Status | null | ((prev: Status | null) => Status | null),
      opts: { transient?: boolean; dismissReason?: "manual" | "auto" | "cleared" } = {},
    ) => {
      setStatusInternal((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (!opts.transient) {
          persistRestoreStatus(resolved);
        }
        // Announce dismissals so AT users know the banner went away,
        // and emit a tracking event so we can measure how often banners
        // are auto-dismissed vs manually closed vs cleared by Settings.
        if (prev && !resolved && opts.dismissReason) {
          const verb =
            opts.dismissReason === "manual"
              ? "dismissed"
              : opts.dismissReason === "auto"
              ? "auto-dismissed"
              : "cleared";
          announce(`Restore status ${verb}.`);
          trackEvent("restore_banner_dismissed", {
            reason: opts.dismissReason,
            kind: prev.kind,
          });
        }
        // Announce appearance of a new banner (different from previous).
        if (
          resolved &&
          (!prev || prev.title !== resolved.title || prev.kind !== resolved.kind)
        ) {
          announce(`${resolved.title}. ${resolved.description}`);
        }
        return resolved;
      });
    },
    [announce],
  );

  // Re-hydrate if another instance updates the persisted banner mid-mount.
  useEffect(() => {
    setStatusInternal((prev) => {
      // Don't clobber an in-flight transient (offline) banner that hasn't
      // been persisted — only sync when persistence has a fresher value.
      if (persistedStatus && (!prev || prev.title !== persistedStatus.title)) {
        return persistedStatus as Status;
      }
      if (!persistedStatus && prev && prev.kind !== "offline") {
        return null;
      }
      return prev;
    });
  }, [persistedStatus]);

  // When connection returns, auto-dismiss the offline notice so the user
  // can retry immediately without having to clear the banner manually.
  // When it drops, surface an offline notice proactively (unless we're
  // already showing a more recent success/error).
  useEffect(() => {
    if (online) {
      // Reconnect — clear any offline-only banner. Don't touch persisted
      // success/error/info results.
      applyStatus(
        (prev) => (prev?.kind === "offline" ? null : prev),
        { transient: true },
      );
    } else {
      // Drop — show offline banner transiently. Not persisted: a stored
      // "you're offline" message would be misleading after reconnect.
      applyStatus(
        (prev) =>
          prev && prev.kind !== "offline"
            ? prev
            : {
                kind: "offline",
                title: "You're offline",
                description:
                  "Connect to the internet to restore your purchases. The button will re-enable automatically once you're back online.",
              },
        { transient: true },
      );
    }
  }, [online, applyStatus]);

  // Resolve auto-dismiss: explicit prop wins, otherwise follow user pref.
  const effectiveAutoDismissMs: number | false =
    autoDismissMs !== undefined
      ? autoDismissMs
      : prefAutoDismiss
      ? RESTORE_BANNER_AUTO_DISMISS_MS
      : false;

  // Auto-dismiss the inline banner. Errors stay visible a bit longer so
  // users have time to read them.
  useEffect(() => {
    if (!status || effectiveAutoDismissMs === false || !effectiveAutoDismissMs) return;
    // Offline notice auto-dismisses on reconnect (handled separately) — never time it out.
    if (status.kind === "offline") return;
    const delay = status.kind === "error" ? effectiveAutoDismissMs + 2000 : effectiveAutoDismissMs;
    const t = window.setTimeout(
      () => applyStatus(null, { dismissReason: "auto" }),
      delay,
    );
    return () => window.clearTimeout(t);
  }, [status, effectiveAutoDismissMs]);

  // Listen for global "clear" events (fired when the user toggles the
  // auto-dismiss preference in Settings) and immediately hide any visible
  // banner so the new behaviour starts from a clean slate.
  useEffect(() => {
    const onClear = () => {
      applyStatus(
        (prev) => {
          if (prev) toast("Restore status cleared");
          return null;
        },
        { dismissReason: "cleared" },
      );
    };
    window.addEventListener(RESTORE_BANNER_CLEAR_EVENT, onClear);
    return () => window.removeEventListener(RESTORE_BANNER_CLEAR_EVENT, onClear);
  }, []);

  const handleRestore = async () => {
    // Always log the click — even if we then bail (loading, non-iOS,
    // offline). Lets us measure raw user intent vs. attempts that actually
    // ran to completion.
    trackEvent("restore_clicked", {
      ios: isIosPlatform(),
      hasStoreKit: hasStoreKitBridge(),
      online,
      loading,
    });
    if (loading) {
      trackEvent("restore_skipped", { reason: "in-flight" });
      return;
    }
    // Defensive: refuse to run on non-iOS even if the component is somehow
    // mounted (e.g. test harness, future regression). Mirrors the render guard.
    if (!isIosPlatform()) {
      console.warn("[restore-purchases] handleRestore called on non-iOS build — ignored");
      trackEvent("restore_skipped", { reason: "non-ios" });
      return;
    }
    if (!online) {
      const attempt = startRestoreAttempt({ trigger: "user", online: false });
      trackEvent("restore_started", { path: "offline", ios: true });
      trackEvent("restore_attempted", { ios: isIosPlatform(), online: false });
      const next: Status = {
        kind: "offline",
        title: "You're offline",
        description:
          "Connect to the internet to restore your purchases. We'll re-enable the button as soon as you're back online.",
      };
      applyStatus(next);
      toast(next.title, { description: next.description });
      attempt.finish("offline", { reason: "navigator.offline" });
      trackEvent("restore_outcome", { outcome: "offline", reason: "navigator.offline" });
      return;
    }

    // ── Stub path: Apple IAP not yet integrated ─────────────────────────────
    // On iOS native builds where the StoreKit bridge isn't injected, run a
    // simulated restore so the UI (loading state + result banner) is fully
    // exercisable in TestFlight / dev builds before Apple IAP is wired up.
    // Stripe and real StoreKit paths below are untouched.
    if (isIosPlatform() && !hasStoreKitBridge()) {
      const attempt = startRestoreAttempt({
        trigger: "user",
        ios: true,
        hasStoreKit: false,
        stub: true,
      });
      trackEvent("restore_started", { path: "stub", ios: true, hasStoreKit: false });
      trackEvent("restore_attempted", { ios: true, hasStoreKit: false, stub: true });
      setLoading(true);
      applyStatus(null);
      void tap();
      try {
        // Simulate a realistic round-trip so the loading banner is visible.
        await new Promise((r) => setTimeout(r, 1200));
        // Deterministic placeholder outcome: "info / nothing to restore"
        // with a clear note that real IAP isn't wired up yet. We avoid a
        // fake "success" so users aren't misled into expecting a real plan.
        const next: Status = {
          kind: "info",
          title: "Restore unavailable in this build",
          description:
            "Apple In-App Purchases aren't wired up yet. This is a placeholder — your real purchases will be restored automatically once IAP ships.",
        };
        applyStatus(next);
        toast.info(next.title, { description: next.description });
        attempt.finish("info", { stub: true });
        trackEvent("restore_outcome", { outcome: "info", stub: true });
      } catch (err) {
        // Stub path shouldn't realistically throw, but guard anyway so
        // analytics + UI stay consistent with the real path.
        const message = err instanceof Error ? err.message : String(err);
        console.error("[restore-purchases] stub failed", err);
        const next: Status = {
          kind: "error",
          title: "Restore failed",
          description: "Something went wrong while simulating the restore. Please try again.",
        };
        applyStatus(next);
        toast.error(next.title, { description: next.description });
        attempt.finish("failed", { error: message, stub: true });
        trackEvent("restore_failed", { path: "stub", error: message });
        trackEvent("restore_outcome", { outcome: "failed", stub: true, error: message });
      } finally {
        setLoading(false);
      }
      return;
    }

    const attempt = startRestoreAttempt({
      trigger: "user",
      ios: isIosPlatform(),
      hasStoreKit: hasStoreKitBridge(),
    });
    trackEvent("restore_started", {
      path: "live",
      ios: isIosPlatform(),
      hasStoreKit: hasStoreKitBridge(),
    });
    trackEvent("restore_attempted", {
      ios: isIosPlatform(),
      hasStoreKit: hasStoreKitBridge(),
      online: true,
    });
    setLoading(true);
    applyStatus(null);
    void tap();
    try {
      let plan = "starter";
      let subscribed = false;

      // Step 1: on iOS with StoreKit available, trigger the native restore
      // and re-validate the resulting receipt against Apple via our edge
      // function. This is the canonical path for App Store IAP.
      let configError: { title: string; description: string } | null = null;

      if (isIosPlatform() && hasStoreKitBridge()) {
        attempt.log("storekit:start");
        const receipt = await restoreStoreKitPurchases();
        if (receipt) {
          const result = await validate(receipt, "restore");
          if (!result.ok && result.error) {
            console.warn("[restore-purchases] receipt validation failed", result.error);
            attempt.log("storekit:validate-failed", {
              error: String(result.error),
              code: result.errorCode ?? null,
            });
            // Surface server misconfiguration as a clear, actionable banner
            // instead of silently falling through to the web/Stripe path
            // (which would otherwise show a misleading "no plan found").
            if (result.errorCode === "config-missing-shared-secret") {
              configError = {
                title: "Receipt validation unavailable",
                description:
                  "The App Store receipt couldn't be verified because the server isn't fully configured yet. Please try again later or contact support.",
              };
            }
          }
          plan = result.plan ?? "starter";
          subscribed = !!result.active && plan !== "starter";
          attempt.log("storekit:done", { plan, subscribed, ok: result.ok });
        } else {
          attempt.log("storekit:no-receipt");
        }
      }

      if (configError) {
        const next: Status = { kind: "error", ...configError };
        applyStatus(next);
        toast.error(next.title, { description: next.description });
        attempt.finish("error", { reason: "config-missing-shared-secret" });
        trackEvent("restore_outcome", { outcome: "error", reason: "config-missing-shared-secret" });
        trackEvent("restore_failed", { path: "live", reason: "config-missing-shared-secret" });
        return;
      }

      // Step 2: fall back to Stripe / web restore. Also runs as a second
      // pass on iOS if the user's plan was bought on the web.
      let validationFailed: { message: string; issues?: string[] } | null = null;
      if (!subscribed) {
        attempt.log("server:invoke", { fn: "check-subscription" });
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (error) {
          attempt.log("server:invoke-error", { error: String(error?.message ?? error) });
          throw error;
        }
        const parsed = parseCheckSubscription(data);
        if (!parsed.ok) {
          // Server responded but the payload was malformed/inconsistent —
          // surface a clearer error instead of silently treating as "starter".
          console.error("[restore-purchases] invalid response", {
            issues: parsed.issues,
            raw: data,
          });
          attempt.log("server:invalid-response", { issues: parsed.issues });
          validationFailed = { message: parsed.message ?? "Invalid response", issues: parsed.issues };
        } else {
          plan = parsed.data!.plan;
          subscribed = parsed.data!.subscribed;
          attempt.log("server:ok", { plan, subscribed });
        }
      }

      if (validationFailed) {
        const next: Status = {
          kind: "error",
          title: "Plan info unavailable",
          description: validationFailed.message,
        };
        applyStatus(next);
        toast.error(next.title, { description: next.description });
        attempt.finish("error", { reason: "invalid-response", issues: validationFailed.issues });
        trackEvent("restore_outcome", { outcome: "error", reason: "invalid-response" });
        trackEvent("restore_failed", {
          path: "live",
          reason: "invalid-response",
          error: validationFailed.message,
          issues: validationFailed.issues,
        });
      } else if (subscribed && plan !== "starter") {
        void hapticSuccess();
        const next: Status = {
          kind: "success",
          title: "Purchases restored",
          description: `Your ${PLAN_LABEL[plan] ?? plan} plan is now active on this device.`,
        };
        applyStatus(next);
        toast.success(next.title, { description: next.description });
        attempt.finish("success", { plan });
        trackEvent("restore_outcome", { outcome: "success", plan });
        trackEvent("restore_succeeded", { path: "live", plan });
      } else {
        const next: Status = {
          kind: "info",
          title: "Nothing to restore",
          description:
            "We didn't find an active paid plan for your account. Sign in at cardr.ai to manage your plan.",
        };
        applyStatus(next);
        toast.info(next.title, { description: next.description });
        attempt.finish("info", { plan, subscribed });
        trackEvent("restore_outcome", { outcome: "info", plan, subscribed });
      }
      // Server was successfully reached AND returned a valid response — record
      // the check time. Validation failures and thrown errors skip this so the
      // displayed timestamp always reflects the last good server response.
      if (!validationFailed) recordRestore();
      // Notify any mounted useSubscription() so the tier UI updates immediately
      // (e.g. badges, paywalls, IosPlanStatusCard) without a page reload.
      if (!validationFailed) {
        window.dispatchEvent(new CustomEvent("subscription:refresh"));
      }
      onRestored?.(plan, subscribed);
    } catch (err) {
      console.error("[restore-purchases] failed", err);
      const next: Status = {
        kind: "error",
        title: "Restore failed",
        description: "We couldn't reach our servers. Please check your connection and try again.",
      };
      applyStatus(next);
      toast.error(next.title, { description: next.description });
      attempt.finish("failed", {
        error: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
      });
      trackEvent("restore_outcome", {
        outcome: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
      trackEvent("restore_failed", {
        path: "live",
        reason: "exception",
        error: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const base =
    "w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-xl py-2.5 transition-colors";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "bg-secondary text-foreground hover:bg-secondary/80";

  // Hard render-guard (placed after all hooks to respect Rules of Hooks).
  // "Restore Purchases" is an Apple App Store concept — hide the entire
  // control on web and Android-native builds so it can't confuse users.
  if (!isIosPlatform()) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleRestore}
        disabled={loading || !online}
        aria-disabled={loading || !online}
        title={!online ? "You're offline" : undefined}
        aria-label="Restore purchases"
        className={`${base} ${styles} disabled:opacity-60`}
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Restoring…" : "Restore purchases"}
      </button>

      <LastRestoreLine ts={lastRestoreAt} />

      <AnimatePresence initial={false}>
        {loading && (
          <motion.div
            key="restoring-banner"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-primary/30 bg-primary/10 p-3 flex items-start gap-2">
              <div className="shrink-0 mt-0.5">
                <RefreshCw size={14} className="text-primary animate-spin" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary">Restoring purchases…</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Checking with the App Store and our servers for your latest plan. This usually takes a few seconds.
                </p>
              </div>
            </div>
          </motion.div>
        )}
        {!loading && status && (
          <motion.div
            key={status.kind + status.title}
            role={status.kind === "error" || status.kind === "offline" ? "alert" : "status"}
            aria-live={status.kind === "error" || status.kind === "offline" ? "assertive" : "polite"}
            aria-atomic="true"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className={`mt-2 rounded-xl border p-3 flex items-start gap-2 ${STATUS_STYLES[status.kind].wrap}`}
            >
              <div className="shrink-0 mt-0.5" aria-hidden="true">
                {STATUS_STYLES[status.kind].icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${STATUS_STYLES[status.kind].title}`}>
                  {status.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {status.description}
                </p>
                {(status.kind === "error" || status.kind === "offline") && (
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={loading || (status.kind === "offline" && !online)}
                    aria-label="Try restoring purchases again"
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw size={11} className={loading ? "animate-spin" : ""} aria-hidden="true" />
                    {loading ? "Retrying…" : "Try again"}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => applyStatus(null, { dismissReason: "manual" })}
                aria-label="Dismiss restore status banner"
                className="shrink-0 -m-1 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dedicated SR-only live region for banner lifecycle transitions
          (auto-dismiss, manual dismiss, cleared by Settings toggle).
          The visible banner above announces appearance via its own
          aria-live; this one fills in the moments the banner goes away. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
};

export default RestorePurchasesButton;

/**
 * Tiny "Last checked X min ago" line shown under the Restore button.
 * Self-rerenders every 30s so the relative time stays accurate without
 * a round-trip. Hidden until the user has restored at least once.
 */
const LastRestoreLine = ({ ts }: { ts: number | null }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!ts) return;
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [ts]);

  if (!ts) return null;
  const absolute = new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <p
      className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground"
      title={`Last checked: ${absolute}`}
      aria-label={`Last checked ${absolute}`}
    >
      <Clock size={10} />
      <span>Last checked {formatRelativeTime(ts)}</span>
    </p>
  );
};

