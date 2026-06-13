/**
 * Verify native detection feeds the feature-flag resolver consistently:
 *   - iOS Capacitor build → uses `native` flag state
 *   - Android Capacitor build → uses `native` flag state (same key, no per-OS branching)
 *   - Web build → uses `web` flag state
 *   - When the native flag is enabled (default OR remote override), full
 *     functionality is restored on both iOS and Android.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mocks are hoisted; `currentPlatform` is a getter we flip per-test.
let currentPlatform: "ios" | "android" | "web" = "web";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => currentPlatform !== "web",
    getPlatform: () => currentPlatform,
  },
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: async () => ({ data: [], error: null }),
    }),
  },
}));

async function freshFlags() {
  vi.resetModules();
  // Wipe the localStorage cache so each test starts from static defaults.
  if (typeof localStorage !== "undefined") localStorage.clear();
  return await import("@/lib/featureFlags");
}

describe("featureFlags × native detection", () => {
  beforeEach(() => {
    currentPlatform = "web";
  });

  it("uses the `web` state on web builds (defaults: enabled)", async () => {
    currentPlatform = "web";
    const { isFeatureEnabled } = await freshFlags();
    expect(isFeatureEnabled("twilioDialer")).toBe(true);
    expect(isFeatureEnabled("pipedreamIntegrations")).toBe(true);
  });

  it("applies the single `native` state on iOS builds (defaults: disabled)", async () => {
    currentPlatform = "ios";
    const { isFeatureEnabled, getFeatureReason } = await freshFlags();
    expect(isFeatureEnabled("twilioDialer")).toBe(false);
    expect(isFeatureEnabled("pipedreamIntegrations")).toBe(false);
    expect(getFeatureReason("twilioDialer")).toMatch(/mobile/i);
  });

  it("applies the SAME `native` state on Android builds (no per-OS branching)", async () => {
    currentPlatform = "android";
    const { isFeatureEnabled, getFeatureReason } = await freshFlags();
    expect(isFeatureEnabled("twilioDialer")).toBe(false);
    expect(isFeatureEnabled("pipedreamIntegrations")).toBe(false);
    expect(getFeatureReason("pipedreamIntegrations")).toMatch(/mobile/i);
  });

  it("iOS and Android resolve identically for every flag", async () => {
    const keys = ["twilioDialer", "pipedreamIntegrations"] as const;

    currentPlatform = "ios";
    const ios = await freshFlags();
    const iosResolved = keys.map((k) => ios.isFeatureEnabled(k));

    currentPlatform = "android";
    const android = await freshFlags();
    const androidResolved = keys.map((k) => android.isFeatureEnabled(k));

    expect(androidResolved).toEqual(iosResolved);
  });

  it("remote override that enables `native` restores full functionality on iOS AND Android", async () => {
    // Seed the localStorage cache the way refreshFeatureFlags() would after
    // an admin flips the remote rows to enabled=true for platform='native'.
    const override = {
      twilioDialer: { native: { enabled: true, reason: undefined } },
      pipedreamIntegrations: { native: { enabled: true, reason: undefined } },
    };
    localStorage.setItem("cardr.featureFlags.v1", JSON.stringify(override));

    currentPlatform = "ios";
    vi.resetModules();
    const ios = await import("@/lib/featureFlags");
    expect(ios.isFeatureEnabled("twilioDialer")).toBe(true);
    expect(ios.isFeatureEnabled("pipedreamIntegrations")).toBe(true);

    currentPlatform = "android";
    vi.resetModules();
    const android = await import("@/lib/featureFlags");
    expect(android.isFeatureEnabled("twilioDialer")).toBe(true);
    expect(android.isFeatureEnabled("pipedreamIntegrations")).toBe(true);
  });
});
