/**
 * Structured logger for the "Restore purchases" flow.
 *
 * Goals:
 * - Tag every log line with `[restore]` so it's easy to grep in device logs
 *   (Xcode console, Safari Web Inspector, Sentry breadcrumbs).
 * - Group all events from a single user-initiated restore under one
 *   `attemptId` and surface elapsed time per step.
 * - Never throw — logging must not break the restore flow.
 *
 * Events:
 *  - attempt        user pressed the button, request starting
 *  - storekit       native StoreKit restore step finished
 *  - server         /check-subscription edge function responded
 *  - outcome        final UX outcome shown to the user (success/info/error/offline)
 *  - failed         unexpected exception bubbled out of the try/catch
 */

export type RestoreOutcome = "success" | "info" | "error" | "offline" | "failed";

export interface RestoreAttempt {
  id: string;
  startedAt: number;
  log: (event: string, data?: Record<string, unknown>) => void;
  finish: (outcome: RestoreOutcome, data?: Record<string, unknown>) => void;
}

const newId = (): string => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2, 10);
};

const safeLog = (
  level: "log" | "warn" | "error",
  attemptId: string,
  event: string,
  payload: Record<string, unknown>,
) => {
  try {
    // Single-line tagged log so it's trivially filterable in device consoles.
    // eslint-disable-next-line no-console
    console[level](`[restore][${attemptId}] ${event}`, payload);
  } catch {
    /* ignore — logging must never throw */
  }
};

export const startRestoreAttempt = (
  context: Record<string, unknown> = {},
): RestoreAttempt => {
  const id = newId();
  const startedAt = Date.now();
  safeLog("log", id, "attempt", { ...context, startedAt });

  return {
    id,
    startedAt,
    log(event, data) {
      safeLog("log", id, event, { elapsedMs: Date.now() - startedAt, ...(data ?? {}) });
    },
    finish(outcome, data) {
      const level: "log" | "warn" | "error" =
        outcome === "error" || outcome === "failed" ? "error" : "log";
      safeLog(level, id, `outcome:${outcome}`, {
        elapsedMs: Date.now() - startedAt,
        ...(data ?? {}),
      });
    },
  };
};
