/**
 * Pure helpers for the export-schedule wizard's timezone behaviour.
 *
 * The wizard resolves its initial timezone using a 3-tier fallback:
 *   1. A persisted per-wizard override (localStorage)
 *   2. The user's profile default (`profiles.default_export_timezone`)
 *   3. The browser's IANA timezone
 *
 * These helpers are extracted so they can be unit-tested without mounting
 * the (large) wizard component.
 */

export type PersistedWizardTz = {
  /** The timezone the user picked last time, or null if never overridden. */
  timezone: string | null;
  /** Whether "Use my default" was on last time. Defaults to true. */
  useMyDefault: boolean;
};

export type ResolvedWizardTz = {
  /** The timezone that should populate the picker on mount. */
  timezone: string;
  /** Initial state of the "Use my default" toggle. */
  useMyDefault: boolean;
  /** Where the value came from, useful for UI badges and tests. */
  source: "persisted" | "profile" | "browser";
};

/**
 * Resolve which timezone the wizard should start with.
 *
 * Priority:
 *  - If `persisted.timezone` is a non-empty string AND the user previously
 *    turned off "Use my default", honour it (explicit per-schedule override).
 *  - Else if a profile default is set, use it (with `useMyDefault = true`).
 *  - Else fall back to the browser tz.
 */
export function resolveWizardTimezone(args: {
  persisted: PersistedWizardTz | null;
  profileDefaultTz: string | null;
  browserTz: string;
}): ResolvedWizardTz {
  const { persisted, profileDefaultTz, browserTz } = args;
  const browser = browserTz || "UTC";

  if (persisted && persisted.useMyDefault === false && persisted.timezone) {
    return { timezone: persisted.timezone, useMyDefault: false, source: "persisted" };
  }
  if (profileDefaultTz) {
    return { timezone: profileDefaultTz, useMyDefault: true, source: "profile" };
  }
  return { timezone: browser, useMyDefault: true, source: "browser" };
}

/**
 * Build the ISO timestamp boundaries for a rolling "last N days" range,
 * anchored to midnight in the chosen timezone (not UTC).
 *
 * Used by the live "matching contacts" preview so that, e.g., picking
 * "last 7 days" in `Asia/Tokyo` doesn't accidentally include yesterday's
 * Tokyo contacts when run from a US machine.
 *
 * Returns `{ fromISO, toISO }` as RFC 3339 instants suitable for Postgres
 * `timestamptz` comparisons. `toISO` is the end-of-today in `tz`.
 */
export function buildRollingRangeISO(args: {
  daysBack: number;
  timezone: string;
  /** Optional anchor for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}): { fromISO: string; toISO: string } {
  const now = args.now ?? new Date();
  const tz = args.timezone || "UTC";
  const days = Math.max(0, Math.floor(args.daysBack));

  // Get yyyy-MM-dd for "today" in `tz`.
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const todayLocal = dtf.format(now); // en-CA gives "yyyy-MM-dd"

  // Anchor end-of-day: 23:59:59.999 on the local day, expressed as the
  // UTC instant that corresponds to that local wall time.
  const toISO = wallTimeToISO(`${todayLocal}T23:59:59.999`, tz);

  // From = start of day (00:00:00) `days` days earlier, local wall time.
  const fromDate = subtractLocalDays(todayLocal, days);
  const fromISO = wallTimeToISO(`${fromDate}T00:00:00.000`, tz);

  return { fromISO, toISO };
}

/** "yyyy-MM-dd" minus N calendar days (local-day arithmetic, no DST risk). */
function subtractLocalDays(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  // Use UTC math purely as a calendar — we only care about the date label.
  const anchor = Date.UTC(y, m - 1, d) - days * 86400_000;
  const out = new Date(anchor);
  const yy = out.getUTCFullYear();
  const mm = String(out.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(out.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Convert a naive local wall-time string (e.g. "2025-04-26T00:00:00.000")
 * in IANA `tz` to an ISO instant (UTC).
 *
 * Approach: the offset between "this wall time interpreted as UTC" and
 * "the same wall time formatted in `tz`" gives us the zone offset to
 * subtract.
 */
function wallTimeToISO(localIso: string, tz: string): string {
  // Use a stable noon-UTC anchor on the same calendar date to determine the
  // zone offset — this avoids edge cases where the candidate instant lands
  // on the "wrong side" of midnight after the first round-trip.
  const datePart = localIso.slice(0, 10); // yyyy-MM-dd
  const anchor = new Date(datePart + "T12:00:00Z");
  const offsetMs = tzOffsetMs(anchor, tz);
  // Treat the input as if it were UTC, then subtract the zone offset to
  // get the real UTC instant.
  const candidate = new Date(localIso + "Z");
  return new Date(candidate.getTime() - offsetMs).toISOString();
}

function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtcMs = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour),
    Number(parts.minute), Number(parts.second),
  );
  return asUtcMs - date.getTime();
}
