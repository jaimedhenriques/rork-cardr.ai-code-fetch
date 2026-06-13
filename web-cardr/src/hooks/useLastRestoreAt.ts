import { useEffect, useState } from "react";

/**
 * Tracks the last time the user successfully ran "Restore purchases".
 * Persisted to localStorage so it survives reloads / app relaunches.
 *
 * Use `recordRestore()` after any restore attempt that reached the server
 * (success OR "nothing to restore" — both prove the server was checked).
 * Errors should NOT call this.
 */
const KEY = "ios.lastRestoreAt";
const EVENT = "ios:last-restore-changed";

const read = (): number | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const recordRestore = (ts: number = Date.now()) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(ts));
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: ts }));
};

export const useLastRestoreAt = () => {
  const [ts, setTs] = useState<number | null>(() => read());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      setTs(typeof detail === "number" ? detail : read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setTs(read());
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return ts;
};

/* -----------------------------------------------------------------------
 * Persisted last-restore *result* (banner kind/title/description).
 * Lets the inline status banner survive a screen change so the user
 * sees the same outcome when they navigate back to the Restore button.
 * Cleared explicitly on dismiss or via the global "clear" event.
 * --------------------------------------------------------------------- */

export type PersistedRestoreStatusKind = "success" | "info" | "error" | "offline";

export interface PersistedRestoreStatus {
  kind: PersistedRestoreStatusKind;
  title: string;
  description: string;
  /** When this status was produced — used to age it out of the UI. */
  at: number;
}

const STATUS_KEY = "ios.lastRestoreStatus";
const STATUS_EVENT = "ios:last-restore-status-changed";
/** Stale window: banners older than this don't re-hydrate on mount. */
const STATUS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const readStatus = (): PersistedRestoreStatus | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STATUS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedRestoreStatus;
    if (
      !parsed ||
      typeof parsed.at !== "number" ||
      typeof parsed.title !== "string" ||
      typeof parsed.description !== "string"
    ) return null;
    if (Date.now() - parsed.at > STATUS_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const persistRestoreStatus = (status: Omit<PersistedRestoreStatus, "at"> | null) => {
  if (typeof window === "undefined") return;
  if (status === null) {
    window.localStorage.removeItem(STATUS_KEY);
    window.dispatchEvent(new CustomEvent<PersistedRestoreStatus | null>(STATUS_EVENT, { detail: null }));
    return;
  }
  const full: PersistedRestoreStatus = { ...status, at: Date.now() };
  window.localStorage.setItem(STATUS_KEY, JSON.stringify(full));
  window.dispatchEvent(new CustomEvent<PersistedRestoreStatus>(STATUS_EVENT, { detail: full }));
};

export const useLastRestoreStatus = () => {
  const [status, setStatus] = useState<PersistedRestoreStatus | null>(() => readStatus());
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<PersistedRestoreStatus | null>).detail;
      setStatus(detail ?? readStatus());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatus(readStatus());
    };
    window.addEventListener(STATUS_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STATUS_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return status;
};

/** Human-friendly relative time ("just now", "3 min ago", "2 h ago", "yesterday"). */
export const formatRelativeTime = (ts: number, now: number = Date.now()): string => {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return `${day} days ago`;
  }
};
