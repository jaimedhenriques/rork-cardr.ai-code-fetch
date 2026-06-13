// StoreKit restore bridge.
//
// Wraps the native restore-purchases call. Today we proxy through a
// `window.StoreKit` shim that the iOS layer (Capacitor plugin or
// RevenueCat) injects; if it isn't present we resolve `null` so callers
// fall back to the server-side Stripe restore path.
//
// Returns the latest base64 receipt blob, or null if no receipt is
// available / StoreKit isn't wired into this build.
import { isIosPlatform } from "@/lib/iosCompliance";

/**
 * Source of a StoreKit transaction event surfaced to JS. The native layer
 * fires the same callback for fresh purchases, auto-renewals, and the
 * transactions emitted at the end of a Restore Purchases flow — we forward
 * the trigger so audit logs and UI can distinguish them.
 */
export type StoreKitTxnSource = "purchase" | "renewal" | "restore";

export interface StoreKitTxnEvent {
  /** Latest base64 app receipt blob (always re-fetched after the txn). */
  receipt: string | null;
  /** What triggered the native callback. */
  source: StoreKitTxnSource;
  /** Optional product id for analytics / observability. */
  productId?: string | null;
}

type StoreKitTxnListener = (evt: StoreKitTxnEvent) => void;

interface StoreKitBridge {
  /** Triggers the native "Restore Purchases" flow and returns the receipt. */
  restorePurchases: () => Promise<{ receipt: string | null }>;
  /** Reads the current receipt without prompting (foreground refresh). */
  getReceipt?: () => Promise<{ receipt: string | null }>;
  /**
   * Subscribe to StoreKit transaction updates (purchases + renewals).
   * The native layer is expected to call the listener whenever
   * `SKPaymentTransactionObserver` (or StoreKit 2 `Transaction.updates`)
   * fires with a `purchased` / `restored` state. Returns an unsubscribe fn.
   */
  addTransactionListener?: (listener: StoreKitTxnListener) => () => void;
}

declare global {
  interface Window {
    StoreKit?: StoreKitBridge;
  }
}

export const hasStoreKitBridge = (): boolean =>
  isIosPlatform() && typeof window !== "undefined" && !!window.StoreKit;

export const restoreStoreKitPurchases = async (): Promise<string | null> => {
  if (!hasStoreKitBridge()) return null;
  try {
    const res = await window.StoreKit!.restorePurchases();
    return res?.receipt ?? null;
  } catch (e) {
    console.error("[storekit] restorePurchases failed", e);
    return null;
  }
};

export const fetchStoreKitReceipt = async (): Promise<string | null> => {
  if (!hasStoreKitBridge() || !window.StoreKit!.getReceipt) return null;
  try {
    const res = await window.StoreKit!.getReceipt();
    return res?.receipt ?? null;
  } catch (e) {
    console.error("[storekit] getReceipt failed", e);
    return null;
  }
};

/**
 * Subscribe to StoreKit purchase + renewal events. Returns a no-op
 * unsubscribe when the bridge isn't injected so callers can wire this up
 * unconditionally without platform branching.
 */
export const addStoreKitTransactionListener = (
  listener: StoreKitTxnListener,
): (() => void) => {
  if (!hasStoreKitBridge() || !window.StoreKit!.addTransactionListener) {
    return () => {};
  }
  try {
    return window.StoreKit!.addTransactionListener!(listener);
  } catch (e) {
    console.error("[storekit] addTransactionListener failed", e);
    return () => {};
  }
};
