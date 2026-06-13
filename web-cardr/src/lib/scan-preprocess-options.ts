/**
 * Shared, persisted preprocessing options for the OCR scan pipeline.
 *
 * Why a hook + localStorage rather than React context:
 *   The options are user-tweaked tuning knobs (auto-crop, deskew, JPEG
 *   quality), not app-wide state. Persisting in localStorage means the
 *   operator's last-known-good settings survive reloads and follow them
 *   between the preview dialog and the live capture flow without prop-
 *   drilling through ScanBadge's giant component tree.
 *
 *   The hook subscribes to the `storage` event so two surfaces (e.g. the
 *   dialog and the page header) reading the same options stay in sync if
 *   one updates them.
 */
import { useCallback, useEffect, useState } from "react";
import type { PreprocessOptions } from "@/lib/image-preprocess";

export interface ScanPreprocessOptions {
  autoCrop: boolean;
  deskew: boolean;
  /** 0.5 – 1.0 — higher = larger payload, sharper text. */
  quality: number;
  /** Preprocessing timeout in ms. Lower = snappier scans; higher = more
   *  reliable on under-powered devices. */
  timeoutMs: number;
  /** Skip preprocessing when the source exceeds this pixel count.
   *  null = no limit (process everything). */
  maxPixels: number | null;
}

const STORAGE_KEY = "cardscanpro_scan_preprocess_opts";

export const DEFAULT_PREPROCESS_OPTIONS: ScanPreprocessOptions = {
  autoCrop: true,
  deskew: true,
  quality: 0.9,
  timeoutMs: 1500,
  maxPixels: 24_000_000,
};

function readFromStorage(): ScanPreprocessOptions {
  if (typeof window === "undefined") return DEFAULT_PREPROCESS_OPTIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREPROCESS_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<ScanPreprocessOptions>;
    // Defensive coerce — old stored payloads or hand-edited values shouldn't
    // crash the scan flow; fall back to defaults per-field.
    const quality = typeof parsed.quality === "number"
      ? Math.min(1, Math.max(0.5, parsed.quality))
      : DEFAULT_PREPROCESS_OPTIONS.quality;
    const timeoutMs = typeof parsed.timeoutMs === "number"
      ? Math.min(10_000, Math.max(500, parsed.timeoutMs))
      : DEFAULT_PREPROCESS_OPTIONS.timeoutMs;
    const maxPixels = parsed.maxPixels === null
      ? null
      : typeof parsed.maxPixels === "number"
        ? Math.min(100_000_000, Math.max(1_000_000, parsed.maxPixels))
        : DEFAULT_PREPROCESS_OPTIONS.maxPixels;
    return {
      autoCrop: typeof parsed.autoCrop === "boolean" ? parsed.autoCrop : DEFAULT_PREPROCESS_OPTIONS.autoCrop,
      deskew: typeof parsed.deskew === "boolean" ? parsed.deskew : DEFAULT_PREPROCESS_OPTIONS.deskew,
      quality,
      timeoutMs,
      maxPixels,
    };
  } catch {
    return DEFAULT_PREPROCESS_OPTIONS;
  }
}

/** Translate the user-facing options into the lib's internal flags. */
export function toPreprocessOptions(opts: ScanPreprocessOptions): PreprocessOptions {
  return {
    skipCrop: !opts.autoCrop,
    skipDeskew: !opts.deskew,
    quality: opts.quality,
    timeoutMs: opts.timeoutMs,
    maxPixels: opts.maxPixels ?? undefined,
  };
}

/** Read once, no subscription — for use inside one-shot handlers like processImage. */
export function getScanPreprocessOptions(): ScanPreprocessOptions {
  return readFromStorage();
}

/**
 * Reactive accessor used by UI surfaces. Cross-tab and cross-component
 * updates are picked up via the `storage` event.
 */
export function useScanPreprocessOptions() {
  const [options, setOptions] = useState<ScanPreprocessOptions>(readFromStorage);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setOptions(readFromStorage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const update = useCallback((patch: Partial<ScanPreprocessOptions>) => {
    setOptions((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Quota / private mode — silently fall back to in-memory only.
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    update(DEFAULT_PREPROCESS_OPTIONS);
  }, [update]);

  return { options, update, reset };
}
