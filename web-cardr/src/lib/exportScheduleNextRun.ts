/**
 * Compute the next firing instant for an export schedule.
 *
 * The schedule fires at `hourUtc:00` *local wall time* in the given IANA
 * `timezone` — despite the column name `hour_utc`, the value is interpreted as
 * the local hour in the schedule's timezone. This matches the behaviour the
 * UI advertises ("Runs at 09:00 in Europe/Lisbon") and keeps firing at the
 * same wall-clock hour across DST transitions.
 *
 * Strategy: probe candidate calendar dates (today, tomorrow, …) and ask
 * `Intl.DateTimeFormat` what the wall-clock representation of each candidate
 * UTC instant looks like in the target timezone. Binary-search isn't needed:
 * a small linear probe (≤ 8 days for weekly) is plenty and DST-correct
 * because we let the platform's tz database resolve the offset.
 */

export type ScheduleFrequency = "daily" | "weekly";

export interface ScheduleLike {
  frequency: ScheduleFrequency;
  /** Local hour-of-day (0-23) in `timezone`. Misnamed in the DB. */
  hour_utc: number;
  /** 0 = Sunday … 6 = Saturday. Required for weekly. */
  day_of_week?: number | null;
  /** IANA timezone, e.g. "Europe/Lisbon". Falls back to UTC. */
  timezone: string | null;
}

interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun..6=Sat
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function partsInTz(date: Date, timeZone: string): TzParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: out.hour === "24" ? 0 : Number(out.hour),
    minute: Number(out.minute),
    weekday: WEEKDAY_INDEX[out.weekday] ?? 0,
  };
}

/**
 * Find the UTC instant whose wall-clock projection in `timeZone` is
 * (year, month, day, hour, 0). Resolves the local-time → UTC ambiguity by
 * iterating: estimate offset, correct, repeat. Converges in ≤ 2 iterations
 * for every IANA zone we care about (DST shifts are ≤ 1h).
 *
 * For non-existent local times (spring-forward gap) it returns the first
 * valid instant *after* the gap — i.e. the schedule "skips forward" through
 * the lost hour, which is the standard cron behaviour users expect.
 */
function utcForWallTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  // Initial guess: pretend the wall time is UTC.
  let guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  for (let i = 0; i < 4; i++) {
    const parts = partsInTz(new Date(guess), timeZone);
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const target = Date.UTC(year, month - 1, day, hour, 0, 0);
    const diff = target - actual;
    if (diff === 0) return new Date(guess);
    guess += diff;
  }
  return new Date(guess);
}

export function nextRunFor(schedule: ScheduleLike, now: Date = new Date()): Date {
  const tz = schedule.timezone || "UTC";
  const hour = Math.max(0, Math.min(23, Math.floor(schedule.hour_utc)));

  // Walk forward day-by-day starting at "today in tz" and pick the first
  // candidate that is (a) in the future and (b) on the correct weekday for
  // weekly schedules.
  const todayParts = partsInTz(now, tz);
  for (let offset = 0; offset < 14; offset++) {
    // Compute the candidate calendar date by adding `offset` days to today
    // *in the target timezone*. Use UTC math on a noon anchor to avoid DST
    // edge cases when incrementing the day counter.
    const anchor = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, 12, 0, 0));
    anchor.setUTCDate(anchor.getUTCDate() + offset);
    const cand = partsInTz(anchor, tz);

    if (schedule.frequency === "weekly") {
      const dow = schedule.day_of_week ?? 1;
      if (cand.weekday !== dow) continue;
    }

    const fireAt = utcForWallTime(cand.year, cand.month, cand.day, hour, tz);
    if (fireAt.getTime() > now.getTime()) return fireAt;
  }
  // Should be unreachable for valid inputs.
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
