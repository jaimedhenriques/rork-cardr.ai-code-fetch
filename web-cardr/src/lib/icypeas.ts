// Icypeas data-enrichment service.
//
// Security rule: Icypeas credentials must never be shipped in the browser bundle.
// The browser may only call a server-side Supabase Edge Function that owns the
// ICYPEAS_API_KEY secret. The feature is disabled unless explicitly enabled with
// VITE_ENABLE_SERVER_ICYPEAS_ENRICHMENT=true after the Edge Function is deployed.

import { supabase } from "@/integrations/supabase/client";

const SERVER_ENRICHMENT_ENABLED =
  import.meta.env.VITE_ENABLE_SERVER_ICYPEAS_ENRICHMENT === "true";

/**
 * Result of an Icypeas enrichment, shaped to match the rest of the app's
 * enrichment consumers. Icypeas only populates the verified email/phone/LinkedIn
 * fields; the remaining optional fields exist so existing call sites that also
 * read company metadata keep compiling.
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

/** Minimal contact shape we need to drive an Icypeas search. */
export interface IcypeasContactInput {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  linkedin?: string;
  website?: string;
}

interface IcypeasFunctionResponse {
  enriched?: IcypeasEnrichment | null;
  error?: string;
}

/** Whether server-side Icypeas enrichment is enabled for this build. */
export const isIcypeasConfigured = (): boolean => SERVER_ENRICHMENT_ENABLED;

/**
 * Enrich a contact through the Supabase Edge Function. Returns verified
 * email/phone/LinkedIn when found, or `null` when enrichment is unavailable,
 * unconfigured, missing input, or no result is found.
 */
export async function enrichContactViaIcypeas(
  contact: IcypeasContactInput,
): Promise<{ enriched: IcypeasEnrichment } | null> {
  if (!SERVER_ENRICHMENT_ENABLED) return null;

  try {
    const { data, error } = await supabase.functions.invoke<IcypeasFunctionResponse>(
      "icypeas-enrich",
      { body: contact },
    );

    if (error) {
      console.warn("Icypeas enrichment function failed:", error.message);
      return null;
    }

    if (!data?.enriched) return null;
    return { enriched: data.enriched };
  } catch (err) {
    console.warn("Icypeas enrichment failed:", err);
    return null;
  }
}
