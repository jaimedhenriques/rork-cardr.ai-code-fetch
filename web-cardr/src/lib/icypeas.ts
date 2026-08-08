// Icypeas data-enrichment service.
//
// All enrichment runs server-side via the `icypeas-enrich` Supabase Edge
// Function. The function implements a 3-step waterfall:
//   1. Icypeas — verified email/phone/LinkedIn
//   2. AI company research — industry, size, location, description
//   3. Smart merge — never overwrites user-typed data
//
// Plan limits are enforced server-side (10 lifetime Starter, 150/month Pro).
// The function returns `limitReached: true` when the caller has hit their cap.

import { supabase } from "@/integrations/supabase/client";

/**
 * Result of an enrichment waterfall, shaped to match the rest of the app's
 * enrichment consumers. Icypeas populates verified email/phone/LinkedIn;
 * AI company research fills industry, size, location, and company metadata.
 */
export interface IcypeasEnrichment {
  email?: string;
  phone?: string;
  mobilePhone?: string;
  workPhone?: string;
  linkedin?: string;
  linkedin_profile_url?: string;
  website?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  title?: string;
  avatar?: string;
  companyDescription?: string;
  companyLinkedin?: string;
  companyAddress?: string;
  companyEmail?: string;
  foundingYear?: string | number;
  annualRevenue?: string;
  companyType?: string;
}

/** Minimal contact shape we need to drive an enrichment search. */
export interface IcypeasContactInput {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  linkedin?: string;
  website?: string;
}

interface EnrichmentFunctionResponse {
  enriched?: IcypeasEnrichment | null;
  searched?: boolean;
  steps?: {
    icypeas: boolean;
    companyResearch: boolean;
  };
  limitReached?: boolean;
  plan?: string;
  remaining?: number;
  error?: string;
}

/** Whether server-side enrichment is enabled. Always true now — the edge
 *  function handles auth, plan limits, and the full waterfall. */
export const isIcypeasConfigured = (): boolean => true;

export interface EnrichmentResult {
  enriched: IcypeasEnrichment;
  /** How many enrichments the user has remaining in their plan (-1 = unlimited). */
  remaining?: number;
  /** The plan the user is on. */
  plan?: string;
}

export interface EnrichmentLimitError {
  limitReached: true;
  plan?: string;
  remaining: number;
}

/**
 * Enrich a contact through the Supabase Edge Function waterfall. Returns
 * verified email/phone/LinkedIn plus company metadata when found.
 *
 * Throws an object with `limitReached: true` when the caller has exhausted
 * their plan's enrichment quota.
 */
export async function enrichContactViaIcypeas(
  contact: IcypeasContactInput,
): Promise<EnrichmentResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke<EnrichmentFunctionResponse>(
      "icypeas-enrich",
      { body: contact },
    );

    if (error) {
      console.warn("Enrichment function failed:", error.message);
      return null;
    }

    // Plan limit reached — throw so callers can show an upgrade prompt
    if (data?.limitReached) {
      throw {
        limitReached: true,
        plan: data.plan,
        remaining: data.remaining ?? 0,
      } satisfies EnrichmentLimitError;
    }

    if (!data?.enriched) return null;
    return {
      enriched: data.enriched,
      remaining: data.remaining,
      plan: data.plan,
    };
  } catch (err) {
    // Re-throw limit errors so callers can handle them
    if (err && typeof err === "object" && "limitReached" in err) {
      throw err;
    }
    console.warn("Enrichment failed:", err);
    return null;
  }
}
