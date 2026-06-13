import { describe, it, expect } from "vitest";
import {
  resolveWizardTimezone,
  buildRollingRangeISO,
} from "./wizardTimezone";

/**
 * These tests pin down the wizard's timezone-resolution contract:
 *
 * 1. Profile default wins when no per-schedule override is persisted.
 * 2. Browser timezone is the fallback when no profile default is set.
 * 3. A persisted per-schedule override (useMyDefault=false) is restored
 *    on reopen, even if the profile default exists.
 * 4. The rolling-range preview query is anchored to *local* days in the
 *    chosen timezone, not UTC.
 */

describe("resolveWizardTimezone", () => {
  it("loads the profile default when no override is persisted", () => {
    const result = resolveWizardTimezone({
      persisted: null,
      profileDefaultTz: "Europe/Paris",
      browserTz: "America/Los_Angeles",
    });
    expect(result).toEqual({
      timezone: "Europe/Paris",
      useMyDefault: true,
      source: "profile",
    });
  });

  it("falls back to browser tz when profile default is unset", () => {
    const result = resolveWizardTimezone({
      persisted: null,
      profileDefaultTz: null,
      browserTz: "Asia/Tokyo",
    });
    expect(result).toEqual({
      timezone: "Asia/Tokyo",
      useMyDefault: true,
      source: "browser",
    });
  });

  it("falls back to UTC if browser tz is empty", () => {
    const result = resolveWizardTimezone({
      persisted: null,
      profileDefaultTz: null,
      browserTz: "",
    });
    expect(result.timezone).toBe("UTC");
    expect(result.source).toBe("browser");
  });

  it("ignores a persisted tz when useMyDefault is true (synced to profile)", () => {
    // useMyDefault stayed ON last time → next open should re-track the
    // profile default, not pin the previously-shown value.
    const result = resolveWizardTimezone({
      persisted: { timezone: "Europe/Paris", useMyDefault: true },
      profileDefaultTz: "Asia/Singapore",
      browserTz: "America/Los_Angeles",
    });
    expect(result.timezone).toBe("Asia/Singapore");
    expect(result.useMyDefault).toBe(true);
    expect(result.source).toBe("profile");
  });

  it("restores an explicit per-schedule override when reopening", () => {
    const result = resolveWizardTimezone({
      persisted: { timezone: "Pacific/Auckland", useMyDefault: false },
      profileDefaultTz: "Europe/Paris",
      browserTz: "America/Los_Angeles",
    });
    expect(result).toEqual({
      timezone: "Pacific/Auckland",
      useMyDefault: false,
      source: "persisted",
    });
  });

  it("ignores an override flagged useMyDefault=false but missing a tz string", () => {
    const result = resolveWizardTimezone({
      persisted: { timezone: null, useMyDefault: false },
      profileDefaultTz: "Europe/Paris",
      browserTz: "America/Los_Angeles",
    });
    // Falls through to profile default.
    expect(result.timezone).toBe("Europe/Paris");
    expect(result.source).toBe("profile");
  });
});

describe("buildRollingRangeISO — timezone applied to preview query", () => {
  // Anchor "now" to a fixed instant so tests are deterministic across
  // CI machines. This instant is 2025-04-26T15:30:00Z, which is:
  //   - 2025-04-26 in UTC
  //   - 2025-04-27 00:30 in Asia/Tokyo (JST, +09:00, no DST)
  //   - 2025-04-26 17:30 in Europe/Paris (CEST, +02:00)
  //   - 2025-04-26 08:30 in America/Los_Angeles (PDT, -07:00)
  const NOW = new Date("2025-04-26T15:30:00Z");

  it("anchors end-of-day to the chosen timezone, not UTC", () => {
    const utc = buildRollingRangeISO({ daysBack: 7, timezone: "UTC", now: NOW });
    const tokyo = buildRollingRangeISO({ daysBack: 7, timezone: "Asia/Tokyo", now: NOW });

    // UTC end-of-today is 2025-04-26 23:59:59.999 UTC.
    expect(utc.toISO).toBe("2025-04-26T23:59:59.999Z");

    // In Tokyo "today" is already 2025-04-27, so end-of-day is
    // 2025-04-27 23:59:59.999 +09:00 → 2025-04-27 14:59:59.999 UTC.
    expect(tokyo.toISO).toBe("2025-04-27T14:59:59.999Z");
  });

  it("computes the start of the window from local midnight in the chosen tz", () => {
    const paris = buildRollingRangeISO({ daysBack: 7, timezone: "Europe/Paris", now: NOW });
    // Paris "today" = 2025-04-26 (CEST). Minus 7 days = 2025-04-19.
    // Local 00:00 Paris (+02:00) → 2025-04-18 22:00:00.000Z.
    expect(paris.fromISO).toBe("2025-04-18T22:00:00.000Z");
  });

  it("supports daysBack=0 → today only, in the chosen tz", () => {
    const la = buildRollingRangeISO({ daysBack: 0, timezone: "America/Los_Angeles", now: NOW });
    // LA "today" = 2025-04-26 (PDT, -07:00).
    // From: 2025-04-26 00:00 LA → 2025-04-26 07:00:00.000Z.
    // To:   2025-04-26 23:59:59.999 LA → 2025-04-27 06:59:59.999Z.
    expect(la.fromISO).toBe("2025-04-26T07:00:00.000Z");
    expect(la.toISO).toBe("2025-04-27T06:59:59.999Z");
  });

  it("produces the same calendar day in UTC as a UTC schedule for daysBack=0", () => {
    const utc = buildRollingRangeISO({ daysBack: 0, timezone: "UTC", now: NOW });
    expect(utc.fromISO).toBe("2025-04-26T00:00:00.000Z");
    expect(utc.toISO).toBe("2025-04-26T23:59:59.999Z");
  });

  it("produces a from < to window for any positive daysBack", () => {
    for (const tz of ["UTC", "Europe/Paris", "Asia/Tokyo", "America/Los_Angeles"]) {
      const r = buildRollingRangeISO({ daysBack: 30, timezone: tz, now: NOW });
      expect(new Date(r.fromISO).getTime()).toBeLessThan(new Date(r.toISO).getTime());
    }
  });
});
