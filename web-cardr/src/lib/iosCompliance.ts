// Native-build compliance helpers for the App Store / Play Store.
//
// Phase 1: ship a free-tier-only native build with NO external purchase CTAs.
// That means no Stripe checkout link, no "Upgrade", no prices, no referral
// incentives, and no link to the web pricing page.
//
// We treat iOS and Android the same so the two store builds stay in sync and
// review-safe. Web and PWA are unaffected.
import { isNative } from "@/lib/native";
import { Capacitor } from "@capacitor/core";

/**
 * True on any native build (iOS or Android). Use this everywhere for
 * Phase-1 compliance gating. Kept as `isIosNative` for backward compatibility
 * with existing call sites — semantics now cover both stores.
 */
export const isIosNative = (): boolean => isNative();

/** Clearer alias preferred for new code. */
export const hidePaidSurfaces = (): boolean => isNative();

/**
 * True only on iOS native (Capacitor). Narrower than `hidePaidSurfaces()` —
 * use this when an action is forbidden by Apple specifically (e.g. external
 * Stripe checkout) but is fine on Android/web.
 */
export const isIosPlatform = (): boolean =>
  isNative() && Capacitor.getPlatform() === "ios";

/**
 * Canonical guard for "should the Stripe upgrade button be disabled?".
 * Returns true on iOS native; web and Android remain enabled.
 */
export const disableStripeUpgrades = (): boolean => isIosPlatform();

// Plain, non-clickable wording shown wherever an upgrade CTA used to live.
export const COMPLIANCE_TITLE = "Plans are managed on cardr.ai";
export const COMPLIANCE_BODY =
  "To upgrade, change, or cancel your subscription, sign in to cardr.ai from any browser. Your plan will sync back to this app automatically.";
export const COMPLIANCE_DOMAIN = "cardr.ai";

// Backwards-compatible aliases — do not remove until every importer is migrated.
export const IOS_COMPLIANCE_TITLE = COMPLIANCE_TITLE;
export const IOS_COMPLIANCE_BODY = COMPLIANCE_BODY;
