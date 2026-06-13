import { supabase } from "@/integrations/supabase/client";

/**
 * Card analytics: lightweight event tracking for a user's public digital card.
 *
 * Events are stored in the `card_events` table keyed by the card `slug`, so the
 * public card page can record anonymous views and the owner can read aggregate
 * counts for their own slug. All writes are best-effort — analytics must never
 * disrupt the user-facing flow if the table or network is unavailable.
 */

export type CardEventType = "view" | "share" | "save_contact";

/** Records a single card event. Silently no-ops on any failure. */
export async function trackCardEvent(
  slug: string | null | undefined,
  eventType: CardEventType,
  source?: string,
): Promise<void> {
  const cleanSlug = slug?.trim();
  if (!cleanSlug) return;
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from("card_events").insert({
      slug: cleanSlug,
      event_type: eventType,
      source: source ?? null,
      user_id: data.user?.id ?? null,
    });
  } catch {
    // Best-effort analytics — never surface errors to the user.
  }
}

export interface CardAnalytics {
  views: number;
  shares: number;
  saves: number;
  /** Views per day for the last 7 days, oldest → newest. */
  viewsTrend: number[];
}

/** Fetches aggregate analytics for a card slug, or null if unavailable. */
export async function fetchCardAnalytics(
  slug: string | null | undefined,
): Promise<CardAnalytics | null> {
  const cleanSlug = slug?.trim();
  if (!cleanSlug) return null;
  try {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("card_events")
      .select("event_type, created_at")
      .eq("slug", cleanSlug)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error || !data) return null;

    const result: CardAnalytics = { views: 0, shares: 0, saves: 0, viewsTrend: [0, 0, 0, 0, 0, 0, 0] };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const row of data) {
      if (row.event_type === "view") result.views += 1;
      else if (row.event_type === "share") result.shares += 1;
      else if (row.event_type === "save_contact") result.saves += 1;

      if (row.event_type === "view") {
        const dayDiff = Math.floor(
          (startOfToday.getTime() - new Date(row.created_at).setHours(0, 0, 0, 0)) / 86_400_000,
        );
        if (dayDiff >= 0 && dayDiff < 7) {
          result.viewsTrend[6 - dayDiff] += 1;
        }
      }
    }
    return result;
  } catch {
    return null;
  }
}
