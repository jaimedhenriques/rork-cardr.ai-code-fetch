// DST validation helpers for export schedules.
//
// We look ~6 months forward from "now" and detect whether the schedule's
// configured wall-clock time crosses a DST boundary in the chosen timezone.
// If so, the absolute UTC delivery time will shift by ~1 hour at the cutover,
// and downstream "date range" filters that bucket by UTC day can land on a
// different day than the user expects.

export type DstWarning = {
  level: "info" | "warning";
  title: string;
  message: string;
  /** Suggested timezone with no DST that is geographically/politically close. */
  suggestedTz?: string;
};

/** Get the offset (in minutes) of `tz` at instant `date`. */
function tzOffsetMinutes(date: Date, tz: string): number {
  // Format the same instant once as UTC and once in `tz`, then diff.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** Suggest a no-DST sibling timezone for common DST zones. */
const NON_DST_SUGGESTIONS: Record<string, string> = {
  "Europe/London": "UTC",
  "Europe/Paris": "Etc/GMT-1",
  "Europe/Berlin": "Etc/GMT-1",
  "Europe/Madrid": "Etc/GMT-1",
  "Europe/Amsterdam": "Etc/GMT-1",
  "Europe/Stockholm": "Etc/GMT-1",
  "America/New_York": "Etc/GMT+5",
  "America/Chicago": "Etc/GMT+6",
  "America/Denver": "Etc/GMT+7",
  "America/Los_Angeles": "Etc/GMT+8",
  "Australia/Sydney": "Australia/Brisbane",
};

export function checkScheduleDst(opts: {
  timezone: string;
  frequency: "daily" | "weekly";
  /** Look-ahead horizon in days. Defaults to 180 (covers both spring & fall). */
  horizonDays?: number;
}): DstWarning | null {
  const tz = opts.timezone;
  if (!tz || tz === "UTC" || tz.startsWith("Etc/")) return null;

  const horizon = opts.horizonDays ?? 180;
  const now = new Date();
  const start = tzOffsetMinutes(now, tz);

  const transitions: Date[] = [];
  let prev = start;
  // Sample every 12 hours — fine enough to catch DST transitions.
  for (let h = 12; h <= horizon * 24; h += 12) {
    const d = new Date(now.getTime() + h * 3600_000);
    const off = tzOffsetMinutes(d, tz);
    if (off !== prev) {
      transitions.push(d);
      prev = off;
    }
  }

  if (transitions.length === 0) return null;

  const fmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    dateStyle: "medium",
  });
  const dates = transitions.slice(0, 2).map((d) => fmt.format(d)).join(" and ");

  return {
    level: "warning",
    title:
      transitions.length > 1
        ? "Schedule spans multiple DST changes"
        : "Schedule spans a daylight saving change",
    message:
      `${tz} changes its UTC offset around ${dates}. Your ${opts.frequency} export will keep its ` +
      `wall-clock hour, but the absolute send time will shift by ~1 hour, which can move rows into a ` +
      `different UTC day on the cutover. If results look off, switch to a fixed-offset timezone.`,
    suggestedTz: NON_DST_SUGGESTIONS[tz],
  };
}
