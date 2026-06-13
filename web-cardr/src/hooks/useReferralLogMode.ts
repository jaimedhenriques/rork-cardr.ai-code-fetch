import { useEffect, useState } from "react";

/**
 * User-controllable log verbosity for the `referral-stats` edge function.
 *
 * Persisted in localStorage and sent on every invocation via the
 * `x-referral-stats-log-mode` request header. The edge function honors the
 * header when present, falling back to the `REFERRAL_STATS_LOG_MODE` env var
 * otherwise. Synced across tabs via the `storage` event.
 */
export type ReferralLogMode = "full" | "sampled" | "off";

const STORAGE_KEY = "cardr.referralStats.logMode";
const DEFAULT_MODE: ReferralLogMode = "sampled";
const VALID: readonly ReferralLogMode[] = ["full", "sampled", "off"];

const read = (): ReferralLogMode => {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && (VALID as readonly string[]).includes(v)) return v as ReferralLogMode;
    return DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

/** Read the current mode synchronously — useful for non-React callers
 * (e.g. when building request headers in `useReferral`). */
export const getReferralLogMode = read;

export const useReferralLogMode = () => {
  const [mode, setModeState] = useState<ReferralLogMode>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setModeState(read());
    };
    const onCustom = () => setModeState(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("cardr:referral-log-mode", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cardr:referral-log-mode", onCustom);
    };
  }, []);

  const setMode = (next: ReferralLogMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setModeState(next);
    window.dispatchEvent(new Event("cardr:referral-log-mode"));
  };

  return { mode, setMode };
};
