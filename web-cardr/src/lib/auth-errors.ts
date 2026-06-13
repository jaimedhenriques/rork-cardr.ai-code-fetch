/**
 * Helpers for detecting "user is not logged in" (HTTP 401 / missing JWT)
 * errors that come back from Supabase edge function invocations or fetches,
 * and turning them into something the UI can render with a clear call to
 * action ("Sign in" + auto-retry).
 */

import { supabase } from "@/integrations/supabase/client";

export interface UnauthorizedInfo {
  /** True when the error looks like a missing/invalid session (HTTP 401). */
  unauthorized: boolean;
  /** Best-effort human readable message. */
  message: string;
  /** Suggested login URL with a `redirect` back to the current page. */
  loginUrl: string;
}

const UNAUTH_HINTS = [
  "401",
  "unauthorized",
  "unauthenticated",
  "jwt",
  "not authenticated",
  "missing authorization",
  "invalid token",
  "no user",
  "auth session missing",
];

/**
 * Inspect an unknown error and decide whether it represents a 401 /
 * unauthenticated state. Works with:
 *   - FunctionsHttpError / FunctionsFetchError from supabase-js
 *   - Plain `Error` objects whose message includes "401" or similar
 *   - `{ status, error }` shaped objects
 *   - Raw `Response` objects
 */
export function detectUnauthorized(err: unknown): UnauthorizedInfo {
  let status: number | undefined;
  let message = "";

  if (err instanceof Response) {
    status = err.status;
  } else if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    const ctx = anyErr.context as { status?: number } | undefined;
    status =
      (typeof anyErr.status === "number" && anyErr.status) ||
      (ctx && typeof ctx.status === "number" ? ctx.status : undefined);
    if (typeof anyErr.message === "string") message = anyErr.message;
    else if (typeof anyErr.error === "string") message = anyErr.error;
  } else if (typeof err === "string") {
    message = err;
  }

  if (!message && err instanceof Error) message = err.message;

  const lower = message.toLowerCase();
  const matchedHint = UNAUTH_HINTS.some((h) => lower.includes(h));
  const unauthorized = status === 401 || matchedHint;

  const redirect =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/";
  const loginUrl = `/auth?redirect=${encodeURIComponent(redirect)}`;

  return {
    unauthorized,
    message: unauthorized
      ? "You're not signed in. Sign in and we'll retry automatically."
      : message || "Unknown error",
    loginUrl,
  };
}

/**
 * Subscribe to auth state changes once and, when the user signs in,
 * call `onSignedIn`. Returns an unsubscribe function. Useful for the
 * "auto retry once you log in" flow.
 */
export function onceSignedIn(onSignedIn: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      onSignedIn();
      data.subscription.unsubscribe();
    }
  });
  return () => data.subscription.unsubscribe();
}
