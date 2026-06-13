/**
 * Returns the canonical PUBLIC origin to use when building user-shareable
 * URLs (digital business card links, referral links, etc.).
 *
 * Why this exists: when a user opens the app in the Lovable preview/sandbox
 * (e.g. `id-preview--<id>.lovable.app` or `<id>.lovableproject.com`), the
 * raw `window.location.origin` points at the Lovable preview host. Sharing
 * that URL is broken in two ways:
 *   1. The preview host has no /card route → recipients get "Card Not Found".
 *   2. iMessage/WhatsApp/etc. fetch OG metadata from the preview host, which
 *      returns Lovable's own branding instead of the user's card preview.
 *
 * The fix: detect non-production hosts and rewrite to the published custom
 * domain. Local dev (localhost) keeps using the current origin so devs can
 * still test against their dev server.
 */
const PRODUCTION_ORIGIN = "https://cardr.ai";

export function getPublicOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  const host = window.location.hostname;
  // Local development hosts — let the dev keep their current origin.
  if (/^(localhost|127\.|\[?::1)/.test(host)) return window.location.origin;
  // Already on a real production custom domain — keep it (covers cardr.ai,
  // www.cardr.ai, cardscan.pro, www.cardscan.pro).
  if (/(^|\.)cardr\.ai$/.test(host) || /(^|\.)cardscan\.pro$/.test(host)) {
    return window.location.origin;
  }
  // Lovable preview / sandbox / any other host — fall back to the canonical
  // production origin so OG previews resolve and the /card route exists.
  return PRODUCTION_ORIGIN;
}

export function buildCardLink(slug: string): string {
  return `${getPublicOrigin()}/card/${slug}`;
}
