import { describe, it, expect } from "vitest";
import { nextRunFor, type ScheduleLike } from "./exportScheduleNextRun";

/**
 * These tests pin down DST behaviour for the export scheduler. The contract:
 * a schedule set to "09:00 Europe/Lisbon" must fire at 09:00 *local* wall
 * time on every calendar day, even when the UTC offset shifts because of
 * daylight saving. Same for US zones across spring-forward / fall-back.
 *
 * We assert against UTC-equivalent instants because they're unambiguous; the
 * Intl.DateTimeFormat round-trip then confirms the wall-clock display.
 */

function wallTimeIn(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return fmt.format(d); // e.g. "30/03/2025, 09:00"
}

describe("nextRunFor — DST transitions", () => {
  describe("Europe/Lisbon (spring forward 2025-03-30 01:00 → 02:00 WEST)", () => {
    const schedule: ScheduleLike = {
      frequency: "daily",
      hour_utc: 9,
      timezone: "Europe/Lisbon",
    };

    it("fires at 09:00 local the day BEFORE the spring-forward (WET, UTC+0)", () => {
      // 2025-03-29 06:00 UTC, before the schedule that day.
      const now = new Date("2025-03-29T06:00:00Z");
      const next = nextRunFor(schedule, now);
      // 09:00 WET = 09:00 UTC
      expect(next.toISOString()).toBe("2025-03-29T09:00:00.000Z");
      expect(wallTimeIn(next, "Europe/Lisbon")).toMatch(/09:00/);
    });

    it("fires at 09:00 local the day OF the spring-forward (WEST, UTC+1)", () => {
      // After the previous day's run; expect 2025-03-30 09:00 WEST = 08:00 UTC.
      const now = new Date("2025-03-29T10:00:00Z");
      const next = nextRunFor(schedule, now);
      expect(next.toISOString()).toBe("2025-03-30T08:00:00.000Z");
      expect(wallTimeIn(next, "Europe/Lisbon")).toMatch(/09:00/);
    });

    it("keeps firing at 09:00 local the day AFTER the spring-forward", () => {
      const now = new Date("2025-03-30T10:00:00Z");
      const next = nextRunFor(schedule, now);
      expect(next.toISOString()).toBe("2025-03-31T08:00:00.000Z");
      expect(wallTimeIn(next, "Europe/Lisbon")).toMatch(/09:00/);
    });
  });

  describe("Europe/Lisbon (fall back 2025-10-26 02:00 → 01:00 WET)", () => {
    const schedule: ScheduleLike = {
      frequency: "daily",
      hour_utc: 9,
      timezone: "Europe/Lisbon",
    };

    it("fires at 09:00 local the day OF the fall-back (now WET, UTC+0)", () => {
      const now = new Date("2025-10-25T10:00:00Z"); // after Sat 09:00 WEST
      const next = nextRunFor(schedule, now);
      // Sun 26 Oct 09:00 WET = 09:00 UTC (offset has flipped)
      expect(next.toISOString()).toBe("2025-10-26T09:00:00.000Z");
      expect(wallTimeIn(next, "Europe/Lisbon")).toMatch(/09:00/);
    });
  });

  describe("America/New_York (spring forward 2025-03-09)", () => {
    const schedule: ScheduleLike = {
      frequency: "daily",
      hour_utc: 8,
      timezone: "America/New_York",
    };

    it("08:00 EST → 13:00 UTC before DST", () => {
      const now = new Date("2025-03-08T05:00:00Z");
      const next = nextRunFor(schedule, now);
      expect(next.toISOString()).toBe("2025-03-08T13:00:00.000Z");
      expect(wallTimeIn(next, "America/New_York")).toMatch(/08:00/);
    });

    it("08:00 EDT → 12:00 UTC after DST kicks in (offset shifted by 1h)", () => {
      const now = new Date("2025-03-08T14:00:00Z");
      const next = nextRunFor(schedule, now);
      expect(next.toISOString()).toBe("2025-03-09T12:00:00.000Z");
      expect(wallTimeIn(next, "America/New_York")).toMatch(/08:00/);
    });
  });

  describe("Weekly schedule across DST", () => {
    // Mondays at 09:00 Europe/Lisbon. The 2025 spring-forward is Sun Mar 30,
    // so the first Monday after DST is Mar 31.
    const schedule: ScheduleLike = {
      frequency: "weekly",
      hour_utc: 9,
      day_of_week: 1, // Monday
      timezone: "Europe/Lisbon",
    };

    it("fires Monday 09:00 WET before DST", () => {
      const now = new Date("2025-03-22T00:00:00Z"); // Saturday
      const next = nextRunFor(schedule, now);
      // Mon Mar 24 09:00 WET = 09:00 UTC
      expect(next.toISOString()).toBe("2025-03-24T09:00:00.000Z");
    });

    it("fires Monday 09:00 WEST the week of/after DST", () => {
      const now = new Date("2025-03-25T00:00:00Z"); // Tue after the fire
      const next = nextRunFor(schedule, now);
      // Mon Mar 31 09:00 WEST = 08:00 UTC
      expect(next.toISOString()).toBe("2025-03-31T08:00:00.000Z");
      expect(wallTimeIn(next, "Europe/Lisbon")).toMatch(/Mon|31\/03\/2025, 09:00/);
    });
  });

  describe("UTC zone (no DST)", () => {
    it("daily fires at the same UTC hour every day", () => {
      const s: ScheduleLike = { frequency: "daily", hour_utc: 14, timezone: "UTC" };
      const next = nextRunFor(s, new Date("2025-06-01T15:00:00Z"));
      expect(next.toISOString()).toBe("2025-06-02T14:00:00.000Z");
    });
  });
});
