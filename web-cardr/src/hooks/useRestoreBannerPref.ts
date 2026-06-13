import { useEffect, useState } from "react";

/**
 * iOS-only user preference: should the inline "Restore purchases" status
 * banner auto-dismiss after a few seconds, or stay until manually dismissed?
 *
 * Persisted in localStorage. Synced across tabs/instances via the `storage`
 * event so updating it in Settings is immediately reflected wherever the
 * Restore button is mounted (e.g. UpgradePrompt modal).
 */
const STORAGE_KEY = "cardr.restoreBanner.autoDismiss";
const DEFAULT_AUTO_DISMISS = true;
export const RESTORE_BANNER_AUTO_DISMISS_MS = 6000;
/** Fired whenever any mounted Restore banner should reset to its empty state. */
export const RESTORE_BANNER_CLEAR_EVENT = "cardr:restore-banner-clear";

const read = (): boolean => {
  if (typeof window === "undefined") return DEFAULT_AUTO_DISMISS;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === null) return DEFAULT_AUTO_DISMISS;
    return v === "1";
  } catch {
    return DEFAULT_AUTO_DISMISS;
  }
};

export const useRestoreBannerPref = () => {
  const [autoDismiss, setAutoDismissState] = useState<boolean>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setAutoDismissState(read());
    };
    const onCustom = () => setAutoDismissState(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("cardr:restore-banner-pref", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cardr:restore-banner-pref", onCustom);
    };
  }, []);

  const setAutoDismiss = (next: boolean) => {
    const prev = read();
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
    setAutoDismissState(next);
    // Notify other components mounted in the same tab.
    window.dispatchEvent(new Event("cardr:restore-banner-pref"));
    // When the preference actually flips, immediately clear any visible
    // restore banners so the new behaviour starts from a clean slate.
    // When the user turns auto-dismiss BACK ON, immediately clear any
    // visible (and persisted) restore banner so the new behaviour starts
    // from a clean slate — otherwise a banner that was already on screen
    // when auto-dismiss was off would linger forever.
    // When turning auto-dismiss OFF we deliberately do NOT clear: the user
    // just opted in to keeping banners visible until they dismiss them.
    // The auto-dismiss timer in RestorePurchasesButton already reacts to
    // the pref change (its effect deps include `effectiveAutoDismissMs`)
    // and will cancel any pending dismissal automatically.
    if (prev !== next && next === true) {
      window.dispatchEvent(new Event(RESTORE_BANNER_CLEAR_EVENT));
    }
  };

  return { autoDismiss, setAutoDismiss };
};
