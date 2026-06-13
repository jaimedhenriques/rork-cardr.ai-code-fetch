// StoreKit receipt validation + subscription sync hook.
//
// Call `validate(receipt, source)` after every purchase, renewal, restore, and
// on app foreground. The edge function validates with Apple, upserts the
// `subscriptions` row, and appends an audit entry to `ios_receipt_validations`
// so `useSubscription` reflects the current plan automatically.
//
// Routes through the canonical `restore-purchases` Edge Function, which
// performs real Apple `verifyReceipt` (with sandbox fallback) and writes the
// resolved tier + period back to Supabase.
import { useCallback, useEffect, useRef } from "react";
import { App, type AppState } from "@capacitor/app";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { isIosPlatform } from "@/lib/iosCompliance";
import {
  addStoreKitTransactionListener,
  fetchStoreKitReceipt,
} from "@/lib/storekit";

export type ReceiptSource = "purchase" | "renewal" | "restore" | "refresh";

export interface ReceiptSyncResult {
  ok: boolean;
  plan?: string;
  active?: boolean;
  expiresAt?: string | null;
  autoRenew?: boolean | null;
  environment?: string;
  productId?: string | null;
  status?: string;
  error?: string;
  /**
   * Stable machine-readable error code from the edge function. Lets the UI
   * branch on specific failure modes (e.g. show a "server not configured"
   * banner when Apple receipt validation can't run).
   */
  errorCode?: string;
}

interface RestoreFnResponse {
  ok?: boolean;
  source?: string;
  environment?: string;
  subscribed?: boolean;
  plan?: string;
  status?: string;
  product_id?: string | null;
  subscription_end?: string | null;
  auto_renew?: boolean;
  apple_status?: number;
  error?: string;
  error_code?: string;
}

export const useIosReceiptSync = () => {
  const { user } = useAuth();
  const lastReceiptRef = useRef<string | null>(null);

  const validate = useCallback(
    async (receipt: string, source: ReceiptSource = "refresh"): Promise<ReceiptSyncResult> => {
      if (!isIosPlatform() || !user) return { ok: false, error: "not-ios-or-unauth" };
      if (!receipt) return { ok: false, error: "missing-receipt" };
      lastReceiptRef.current = receipt;

      const { data, error } = await supabase.functions.invoke<RestoreFnResponse>(
        "restore-purchases",
        {
          body: {
            receipt,
            platform: "ios",
            // Pass the trigger so the server-side audit log shows whether
            // this came from a purchase, renewal, manual restore, or
            // foreground refresh.
            app_version: source,
          },
        },
      );

      // Non-2xx responses (e.g. 503 when APPLE_SHARED_SECRET is missing)
      // surface as `error` with the response body stashed on `error.context`.
      // Reach into it so the caller gets the structured `error_code` instead
      // of a generic "Edge Function returned a non-2xx status code".
      if (error) {
        let body: RestoreFnResponse | null = null;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            body = (await ctx.clone().json()) as RestoreFnResponse;
          }
        } catch {
          /* ignore parse failure — fall through to generic message */
        }
        return {
          ok: false,
          error: body?.error ?? error.message,
          errorCode: body?.error_code,
        };
      }
      if (!data || data.ok === false) {
        return {
          ok: false,
          error: data?.error ?? "unknown-error",
          errorCode: data?.error_code,
        };
      }

      const result: ReceiptSyncResult = {
        ok: true,
        plan: data.plan ?? "starter",
        active: !!data.subscribed,
        expiresAt: data.subscription_end ?? null,
        autoRenew: data.auto_renew ?? null,
        environment: data.environment,
        productId: data.product_id ?? null,
        status: data.status,
      };

      // Notify the rest of the app that the subscription row just changed
      // so `useSubscription` (and any other listeners) refetch immediately
      // — this is what makes purchase / renewal / restore screens reflect
      // the new tier without a manual reload.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("subscription:refresh", { detail: { source, ...result } }),
        );
      }

      return result;
    },
    [user],
  );

  // Re-validate the cached receipt whenever the app returns to the foreground —
  // catches background renewals and lapses without requiring a fresh purchase.
  useEffect(() => {
    if (!isIosPlatform() || !user) return;
    const handler = (state: AppState) => {
      if (state.isActive && lastReceiptRef.current) {
        void validate(lastReceiptRef.current, "refresh");
      }
    };
    let remove: (() => void) | undefined;
    App.addListener("appStateChange", handler).then((h) => {
      remove = () => h.remove();
    });
    return () => { remove?.(); };
  }, [user, validate]);

  // StoreKit transaction observer: any purchase or renewal event coming
  // from the native layer is immediately re-verified with Apple and the
  // subscription row is upserted server-side. Screens don't need to wire
  // this up themselves — mounting `useIosReceiptSync` (directly or via
  // `useAutoRestoreOnOpen`) is enough.
  useEffect(() => {
    if (!isIosPlatform() || !user) return;
    const unsub = addStoreKitTransactionListener(async (evt) => {
      const receipt = evt.receipt ?? (await fetchStoreKitReceipt());
      if (!receipt) return;
      const result = await validate(receipt, evt.source);
      // Surface server-misconfiguration errors that would otherwise be
      // silent — the global observer fires without any UI of its own.
      if (!result.ok && result.errorCode === "config-missing-shared-secret") {
        toast.error("Receipt validation unavailable", {
          description:
            "The App Store receipt couldn't be verified because the server isn't fully configured yet. Please contact support.",
          id: "ios-receipt-config-error", // de-dupe across rapid events
        });
      }
    });
    return () => { unsub(); };
  }, [user, validate]);

  return { validate };
};
