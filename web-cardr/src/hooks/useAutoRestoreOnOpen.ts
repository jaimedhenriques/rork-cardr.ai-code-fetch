import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isIosPlatform } from "@/lib/iosCompliance";
import { useIosReceiptSync } from "@/hooks/useIosReceiptSync";
import { hasStoreKitBridge, fetchStoreKitReceipt } from "@/lib/storekit";
import { recordRestore } from "@/hooks/useLastRestoreAt";

/**
 * Silently re-checks the user's plan with the server when an iOS surface
 * that benefits from up-to-date subscription state opens (Settings plan
 * section, Upgrade prompt, etc.).
 *
 * - No UI: never shows toasts, banners, or errors. The visible "Restore
 *   purchases" button is the user-initiated path; this is the passive path.
 * - Throttled per browser tab AND per device (10 min via localStorage) so
 *   opening Settings repeatedly doesn't hammer Apple/Stripe.
 * - Pulls the cached StoreKit receipt without prompting (getReceipt, not
 *   restorePurchases) so there's no native modal.
 * - Updates the same `lastRestoreAt` timestamp the manual button uses, so
 *   the "Last checked" line stays accurate.
 */
const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
const KEY = "ios.lastAutoRestoreAt";

const lastRunRef: { current: number } = { current: 0 };

const readPersistedLastRun = (): number => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
};

const writePersistedLastRun = (ts: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(ts));
};

export const useAutoRestoreOnOpen = (open: boolean) => {
  const { validate } = useIosReceiptSync();
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!open || !isIosPlatform()) return;
    if (inFlightRef.current) return;

    const now = Date.now();
    const lastRun = Math.max(lastRunRef.current, readPersistedLastRun());
    if (now - lastRun < THROTTLE_MS) return;

    inFlightRef.current = true;
    lastRunRef.current = now;
    writePersistedLastRun(now);

    (async () => {
      try {
        let serverChecked = false;

        // Path A: silent receipt re-validation if StoreKit is wired up.
        if (hasStoreKitBridge()) {
          const receipt = await fetchStoreKitReceipt();
          if (receipt) {
            const result = await validate(receipt, "refresh");
            if (result.ok) serverChecked = true;
          }
        }

        // Path B: always also call check-subscription so web-purchased
        // plans get reflected. Cheap and idempotent.
        const { error } = await supabase.functions.invoke("check-subscription");
        if (!error) serverChecked = true;

        if (serverChecked) recordRestore();
      } catch (err) {
        // Silent — the user-initiated Restore button surfaces errors.
        console.warn("[auto-restore] silent check failed", err);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [open, validate]);
};
