import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isFeatureEnabled, notifyComingSoon } from "@/lib/featureFlags";

export interface StartConnectOptions {
  appSlug: string;
  appName: string;
  /** Called after a new account is detected and persisted. */
  onConnected?: (account: { id: string; app_slug?: string; app_name?: string }) => void;
  /** Called when the popup is closed without a new account or polling times out. */
  onCancelled?: () => void;
  /** Called on any error before the popup is opened or during polling. */
  onError?: (message: string) => void;
  /** Override polling cadence (ms). Default 2000. */
  pollIntervalMs?: number;
  /** Override max attempts. Default 150 (≈ 5 minutes at 2s). */
  maxAttempts?: number;
  /** Suppress the built-in success/error toasts. Default false. */
  silent?: boolean;
}

export interface UsePipedreamConnectResult {
  /** Slug currently being connected, or null. */
  connecting: string | null;
  /** Begin OAuth via Pipedream Connect Link and resolve when polling ends. */
  startConnect: (opts: StartConnectOptions) => Promise<{ accountId: string } | null>;
}

/**
 * Reusable client action for launching a Pipedream Connect Link flow for any
 * app slug. Opens the popup, polls `pipedream-list-accounts` until a new
 * account_id appears (or the popup closes / times out), and surfaces lifecycle
 * callbacks so the caller can refresh its UI.
 *
 * Connection records are persisted server-side by `pipedream-list-accounts`
 * (it upserts into `pipedream_connections`), so callers only need to refetch.
 */
export function usePipedreamConnect(): UsePipedreamConnectResult {
  const [connecting, setConnecting] = useState<string | null>(null);

  const startConnect = useCallback<UsePipedreamConnectResult["startConnect"]>(
    async ({
      appSlug,
      appName,
      onConnected,
      onCancelled,
      onError,
      pollIntervalMs = 2000,
      maxAttempts = 150,
      silent = false,
    }) => {
      if (!isFeatureEnabled("pipedreamIntegrations")) {
        notifyComingSoon("Long-tail integrations are coming to mobile soon.");
        onCancelled?.();
        return null;
      }
      setConnecting(appSlug);

      const fail = (msg: string) => {
        if (!silent) toast.error(msg);
        onError?.(msg);
      };

      try {
        const { data, error } = await supabase.functions.invoke("pipedream-token", {
          body: { app: appSlug, allowed_origins: [window.location.origin] },
        });
        if (error || !data?.token) {
          const msg =
            (data as { error?: string } | null)?.error ??
            error?.message ??
            "Failed to start Pipedream connection";
          fail(msg);
          setConnecting(null);
          return null;
        }

        // Snapshot existing account IDs for this app so we detect a *new* one.
        const { data: existing } = await supabase
          .from("pipedream_connections")
          .select("pipedream_account_id")
          .eq("app_slug", appSlug);
        const knownIds = new Set(
          (existing ?? []).map((r) => r.pipedream_account_id as string),
        );

        const connectUrl = `${data.connect_link_url}?app=${encodeURIComponent(appSlug)}&token=${encodeURIComponent(data.token)}`;
        const popup = window.open(
          connectUrl,
          "pipedream-connect",
          "width=600,height=750",
        );

        return await new Promise<{ accountId: string } | null>((resolve) => {
          let attempts = 0;
          let resolved = false;

          const finish = (
            value: { accountId: string } | null,
            reason: "connected" | "cancelled" | "timeout",
          ) => {
            if (resolved) return;
            resolved = true;
            window.clearInterval(poll);
            popup?.close();
            setConnecting(null);
            if (value) {
              if (!silent) toast.success(`${appName} connected`);
              onConnected?.({ id: value.accountId, app_slug: appSlug, app_name: appName });
            } else if (reason === "timeout") {
              fail("Connection timed out. Please try again.");
            } else {
              if (!silent) toast.message("Connection cancelled.");
              onCancelled?.();
            }
            resolve(value);
          };

          const checkOnce = async (): Promise<string | null> => {
            const { data: listData, error: listErr } = await supabase.functions.invoke(
              "pipedream-list-accounts",
              { body: { app_slug: appSlug, app_name: appName, persist: true } },
            );
            if (listErr) {
              console.error("[usePipedreamConnect] list-accounts error", listErr);
              return null;
            }
            const accounts =
              (listData as { accounts?: Array<{ id: string }> } | null)?.accounts ?? [];
            const fresh = accounts.find((a) => a.id && !knownIds.has(a.id));
            return fresh?.id ?? null;
          };

          const poll = window.setInterval(async () => {
            if (resolved) return;
            attempts += 1;
            const popupClosed = !!popup && popup.closed;

            const accountId = await checkOnce();
            if (accountId) {
              finish({ accountId }, "connected");
              return;
            }
            if (attempts >= maxAttempts) {
              finish(null, "timeout");
              return;
            }
            if (popupClosed) {
              finish(null, "cancelled");
            }
          }, pollIntervalMs);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        fail(msg);
        setConnecting(null);
        return null;
      }
    },
    [],
  );

  return { connecting, startConnect };
}
