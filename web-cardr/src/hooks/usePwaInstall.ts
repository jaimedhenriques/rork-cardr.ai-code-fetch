import { useCallback, useEffect, useState } from "react";

/**
 * Lightweight "Add to Home Screen" install helper.
 *
 * - On Android/desktop Chrome/Edge it captures the `beforeinstallprompt`
 *   event so we can trigger the native install dialog from any UI.
 * - On iOS Safari there is no API, so we expose `isIos`/`canPromptIos`
 *   for components to render manual instructions
 *   (Share → Add to Home Screen).
 * - Tracks `isInstalled` (running standalone) and persists dismissal so
 *   we don't keep nagging users who said no.
 *
 * NO service worker is registered — intentional, to keep the Lovable
 * preview iframe fast and avoid stale caches.
 */

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
};

const DISMISS_KEY = "cardr_pwa_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // @ts-expect-error iOS-only field
  if (window.navigator?.standalone === true) return true;
  return false;
};

const detectIos = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document;
  return isIosDevice || isIpadOs;
};

const detectIosSafari = (): boolean => {
  if (!detectIos()) return false;
  const ua = navigator.userAgent || "";
  return !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
};

const isInIframe = (): boolean => {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
};

const wasRecentlyDismissed = (): boolean => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number.parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
};

export interface UsePwaInstallResult {
  isInstalled: boolean;
  canPrompt: boolean;
  isIos: boolean;
  canPromptIos: boolean;
  recentlyDismissed: boolean;
  inIframe: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismiss: () => void;
}

export function usePwaInstall(): UsePwaInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [recentlyDismissed, setRecentlyDismissed] = useState<boolean>(() => wasRecentlyDismissed());

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = () => setInstalled(isStandalone());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mq?.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "dismissed") {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
        setRecentlyDismissed(true);
      }
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setRecentlyDismissed(true);
  }, []);

  return {
    isInstalled: installed,
    canPrompt: !!deferredPrompt,
    isIos: detectIos(),
    canPromptIos: detectIosSafari(),
    recentlyDismissed,
    inIframe: isInIframe(),
    promptInstall,
    dismiss,
  };
}
