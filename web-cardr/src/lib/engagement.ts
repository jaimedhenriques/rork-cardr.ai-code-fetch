import { differenceInDays } from "date-fns";

export type EngagementTier = "A" | "B" | "C";

export interface EngagementScore {
  tier: EngagementTier;
  label: string;
  color: string;
  bgColor: string;
  daysSinceActivity: number | null;
}

/**
 * Calculate engagement tier based on most recent activity across:
 * - next_action_date (upcoming = active)
 * - follow_up_date
 * - last activity timestamp
 * - scanned_at (fallback)
 *
 * A = Hot (activity within 7 days)
 * B = Warm (8–30 days)
 * C = Cold (31+ days or no activity)
 */
export function getEngagementScore(contact: {
  scannedAt?: string;
  followUpDate?: string;
  nextActionDate?: string;
  enrichedAt?: string;
}, lastActivityDate?: string | null): EngagementScore {
  const now = new Date();
  const dates: Date[] = [];

  // Collect all relevant dates
  if (lastActivityDate) dates.push(new Date(lastActivityDate));
  if (contact.enrichedAt) dates.push(new Date(contact.enrichedAt));
  if (contact.scannedAt) dates.push(new Date(contact.scannedAt));

  // Upcoming next action date counts as very active
  if (contact.nextActionDate) {
    const nad = new Date(contact.nextActionDate);
    if (nad >= now) {
      // Future action date = hot
      return { tier: "A", label: "Hot", color: "text-emerald-400", bgColor: "bg-emerald-400/10", daysSinceActivity: 0 };
    }
    dates.push(nad);
  }

  if (contact.followUpDate) {
    const fd = new Date(contact.followUpDate);
    if (fd >= now) {
      return { tier: "A", label: "Hot", color: "text-emerald-400", bgColor: "bg-emerald-400/10", daysSinceActivity: 0 };
    }
    dates.push(fd);
  }

  if (dates.length === 0) {
    return { tier: "C", label: "Cold", color: "text-zinc-400", bgColor: "bg-zinc-400/10", daysSinceActivity: null };
  }

  const mostRecent = new Date(Math.max(...dates.map((d) => d.getTime())));
  const days = differenceInDays(now, mostRecent);

  if (days <= 7) {
    return { tier: "A", label: "Hot", color: "text-emerald-400", bgColor: "bg-emerald-400/10", daysSinceActivity: days };
  }
  if (days <= 30) {
    return { tier: "B", label: "Warm", color: "text-amber-400", bgColor: "bg-amber-400/10", daysSinceActivity: days };
  }
  return { tier: "C", label: "Cold", color: "text-zinc-400", bgColor: "bg-zinc-400/10", daysSinceActivity: days };
}
