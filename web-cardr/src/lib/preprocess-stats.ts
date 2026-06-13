/**
 * Local-only performance stats for the scan preprocessing pipeline.
 *
 * Persisted in localStorage so the user can inspect how their device is
 * performing across sessions without us shipping the data anywhere.
 *
 * Tracked:
 *   - totalRuns         — every call to preprocessScanImage we recorded
 *   - skippedRuns       — runs where the pipeline bailed out (any guard != "none")
 *   - completedRuns     — runs where the pipeline actually preprocessed
 *   - totalDurationMs   — cumulative wall-clock duration of completed runs only
 *                         (so the "average" is meaningful — skipped runs are
 *                         near-instant and would skew it toward zero)
 *   - guardCounts       — per-guard breakdown for debugging
 *   - lastUpdated       — ISO timestamp of the last recorded run
 *
 * This module is pure browser code — no network, no Supabase.
 */

const STORAGE_KEY = "scan.preprocess.stats.v1";
const EVENT_NAME = "scan-preprocess-stats:updated";

export type PreprocessGuardLabel =
  | "none"
  | "slow-device"
  | "timeout"
  | "max-pixels"
  | "too-small"
  | "error"
  | "canvas-unavailable";

export interface PreprocessStats {
  totalRuns: number;
  skippedRuns: number;
  completedRuns: number;
  totalDurationMs: number;
  guardCounts: Record<string, number>;
  lastUpdated: string | null;
}

const EMPTY: PreprocessStats = {
  totalRuns: 0,
  skippedRuns: 0,
  completedRuns: 0,
  totalDurationMs: 0,
  guardCounts: {},
  lastUpdated: null,
};

function safeRead(): PreprocessStats {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return {
      totalRuns: Number(parsed?.totalRuns) || 0,
      skippedRuns: Number(parsed?.skippedRuns) || 0,
      completedRuns: Number(parsed?.completedRuns) || 0,
      totalDurationMs: Number(parsed?.totalDurationMs) || 0,
      guardCounts:
        parsed?.guardCounts && typeof parsed.guardCounts === "object"
          ? { ...parsed.guardCounts }
          : {},
      lastUpdated: typeof parsed?.lastUpdated === "string" ? parsed.lastUpdated : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

function safeWrite(stats: PreprocessStats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function getPreprocessStats(): PreprocessStats {
  return safeRead();
}

export function recordPreprocessRun(input: {
  durationMs: number;
  skipped: boolean;
  guard: string;
}) {
  const stats = safeRead();
  stats.totalRuns += 1;
  if (input.skipped) {
    stats.skippedRuns += 1;
  } else {
    stats.completedRuns += 1;
    stats.totalDurationMs += Math.max(0, Math.round(input.durationMs));
  }
  const guard = input.guard || "unknown";
  stats.guardCounts[guard] = (stats.guardCounts[guard] ?? 0) + 1;
  stats.lastUpdated = new Date().toISOString();
  safeWrite(stats);
}

export function clearPreprocessStats() {
  safeWrite({ ...EMPTY, guardCounts: {} });
}

export function subscribePreprocessStats(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  // Also catch updates from other tabs.
  const storage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", storage);
  };
}

export function getAverageDurationMs(stats: PreprocessStats): number {
  if (stats.completedRuns <= 0) return 0;
  return stats.totalDurationMs / stats.completedRuns;
}

export function getSkippedPercent(stats: PreprocessStats): number {
  if (stats.totalRuns <= 0) return 0;
  return (stats.skippedRuns / stats.totalRuns) * 100;
}
