/**
 * Lightweight client-side event tracker.
 *
 * Goals:
 * - Zero infra: no edge function or DB table required for v1.
 * - Captures product-analytics-style events ({name, props, ts}) into a
 *   bounded rolling buffer in localStorage so we can inspect recent
 *   activity from device logs / support sessions.
 * - Mirrors every event to console with a `[track]` tag so events show
 *   up alongside other restore logs in Xcode/Safari Web Inspector.
 *
 * If/when a server-side analytics sink (PostHog, Supabase table, etc.)
 * is added, change `trackEvent` in one place — every caller stays the same.
 */

const STORAGE_KEY = "cardr.events.buffer";
const MAX_EVENTS = 100;

export interface TrackedEvent {
  name: string;
  ts: number;
  props?: Record<string, unknown>;
}

const safeRead = (): TrackedEvent[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeWrite = (events: TrackedEvent[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* quota / disabled storage — ignore */
  }
};

export const trackEvent = (
  name: string,
  props?: Record<string, unknown>,
): void => {
  const event: TrackedEvent = { name, ts: Date.now(), props };
  try {
    // eslint-disable-next-line no-console
    console.log(`[track] ${name}`, props ?? {});
  } catch {
    /* ignore */
  }
  const buf = safeRead();
  buf.push(event);
  if (buf.length > MAX_EVENTS) buf.splice(0, buf.length - MAX_EVENTS);
  safeWrite(buf);
};

/** Returns the rolling buffer (most-recent last). Useful for support tools. */
export const getTrackedEvents = (): TrackedEvent[] => safeRead();

/** Wipes the local event buffer. */
export const clearTrackedEvents = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
