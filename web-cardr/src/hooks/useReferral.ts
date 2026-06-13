import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getReferralLogMode } from "@/hooks/useReferralLogMode";

interface ReferralStats {
  referral_code: string;
  referral_link: string;
  total_clicks: number;
  total_signups: number;
  active_subscribers: number;
  total_credits_earned_cents: number;
  available_credits_cents: number;
  applied_credits_cents: number;
  credit_history: { amount_cents: number; applied_at: string }[];
}

/**
 * Detect a 401 / "Not authenticated" response from a `supabase.functions.invoke`
 * error. Supabase wraps non-2xx responses in `FunctionsHttpError` whose
 * `context.response` exposes the HTTP status — but that surface isn't part of
 * the public type and varies by SDK version, so we inspect a few shapes and
 * fall back to a string-match on the message.
 */
const isAuthError = (err: unknown): boolean => {
  if (!err) return false;
  const anyErr = err as {
    status?: number;
    context?: { status?: number; response?: { status?: number }; body?: unknown };
    message?: string;
    name?: string;
    code?: string;
  };
  const status =
    anyErr.status ??
    anyErr.context?.status ??
    anyErr.context?.response?.status;
  if (status === 401 || status === 403) return true;
  // Stable, user-safe error codes from the referral-stats edge function
  // (e.g. AUTH_MISSING_HEADER, AUTH_TOKEN_EXPIRED). These are the most
  // reliable signal because they don't depend on HTTP status forwarding.
  const code = anyErr.code ?? (anyErr.context as { body?: { code?: string } } | undefined)?.body?.code;
  if (typeof code === "string" && code.startsWith("AUTH_")) return true;
  const msg = (anyErr.message ?? "").toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("not authenticated") ||
    msg.includes("unauthorized") ||
    anyErr.name === "AuthSessionMissingError"
  );
};

export function useReferral() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  /**
   * Centralized handler for "your session is no longer valid" responses
   * coming from the referral edge functions. Clears local auth, surfaces a
   * single toast, and bounces the user to /auth so they can sign in again.
   * `silent` skips the toast (useful for the initial background fetch so we
   * don't double-notify on a fresh page load).
   */
  const handleAuthFailure = useCallback(
    async (silent = false) => {
      setAuthError(true);
      setStats(null);
      if (!silent) {
        toast.error("Your session has expired", {
          description: "Please sign in again to view your referral stats.",
          action: { label: "Sign in", onClick: () => navigate("/auth") },
        });
      }
      try {
        await signOut();
      } catch {
        /* ignore — we're navigating away anyway */
      }
      navigate("/auth", { replace: true });
    },
    [navigate, signOut],
  );

  const fetchStats = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!user) return;
      setLoading(true);
      setAuthError(false);
      try {
        const { data, error } = await supabase.functions.invoke("referral-stats", {
          // Forward the user's per-device log-verbosity preference so the
          // edge function can adjust without redeploying. Header is read by
          // referral-stats and falls back to its env default if absent.
          headers: { "x-referral-stats-log-mode": getReferralLogMode() },
        });
        if (error) throw error;
        setStats(data);
      } catch (e) {
        console.error("Failed to fetch referral stats:", e);
        if (isAuthError(e)) {
          await handleAuthFailure(opts.silent);
        }
      } finally {
        setLoading(false);
      }
    },
    [user, handleAuthFailure],
  );

  useEffect(() => {
    // Initial background fetch — suppress the toast so a fresh load with an
    // expired session redirects without a flash of "session expired" noise.
    fetchStats({ silent: true });
  }, [fetchStats]);

  const trackClick = useCallback(async (referralCode: string) => {
    try {
      await supabase.functions.invoke("track-referral-click", {
        body: { referral_code: referralCode },
      });
    } catch (e) {
      console.error("Failed to track referral click:", e);
    }
  }, []);

  const applyReferral = useCallback(
    async (referralCode: string) => {
      try {
        const { data, error } = await supabase.functions.invoke("apply-referral", {
          body: { referral_code: referralCode },
        });
        if (error) throw error;
        return data;
      } catch (e) {
        console.error("Failed to apply referral:", e);
        if (isAuthError(e)) {
          await handleAuthFailure();
          return { error: "Not authenticated" };
        }
        return { error: "Failed to apply referral" };
      }
    },
    [handleAuthFailure],
  );

  const validateCoupon = useCallback(
    async (code: string, plan?: string) => {
      try {
        const { data, error } = await supabase.functions.invoke("validate-coupon", {
          body: { code, plan },
        });
        if (error) throw error;
        return data;
      } catch (e) {
        console.error("Failed to validate coupon:", e);
        if (isAuthError(e)) {
          await handleAuthFailure();
          return { valid: false, error: "Not authenticated" };
        }
        return { valid: false, error: "Failed to validate coupon" };
      }
    },
    [handleAuthFailure],
  );

  return {
    stats,
    loading,
    authError,
    fetchStats,
    trackClick,
    applyReferral,
    validateCoupon,
  };
}
