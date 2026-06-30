// Icypeas data-enrichment service.
// Finds a verified professional email (and phone / LinkedIn when available)
// from a person's name + company/domain, calling the Icypeas API directly.
// Docs: https://api-doc.icypeas.com/getting-started
//
// The flow is asynchronous: we submit a single email-search, get back an `_id`,
// then poll the read endpoint until the search reaches a terminal status.

const ICYPEAS_API_KEY = import.meta.env.VITE_ICYPEAS_API_KEY as string | undefined;
const BASE_URL = "https://app.icypeas.com/api";

/**
 * Result of an Icypeas enrichment, shaped to match the rest of the app's
 * enrichment consumers. Icypeas only populates the verified email/phone/LinkedIn
 * fields; the remaining optional fields exist so existing call sites that also
 * read company metadata keep compiling (they simply stay undefined).
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

/** Whether Icypeas is configured (API key present). */
export const isIcypeasConfigured = (): boolean => Boolean(ICYPEAS_API_KEY);

/** Statuses that mean the search has finished (successfully or not). */
const TERMINAL_STATUSES = new Set([
  "FOUND",
  "DEBITED",
  "COMPLETED",
  "NOT_FOUND",
  "DEBITED_NOT_FOUND",
  "BAD_INPUT",
  "INSUFFICIENT_FUNDS",
  "ABORTED",
]);

function splitName(name?: string): { firstname: string; lastname: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstname: "", lastname: "" };
  if (parts.length === 1) return { firstname: parts[0], lastname: "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

/** Derive the company domain (or company name) Icypeas needs to scope a search. */
function deriveDomainOrCompany(input: IcypeasContactInput): string | null {
  const emailDomain = input.email?.split("@")[1]?.trim();
  if (emailDomain) return emailDomain;
  if (input.website) {
    try {
      const url = input.website.startsWith("http") ? input.website : `https://${input.website}`;
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host) return host;
    } catch {
      // fall through to company name
    }
  }
  if (input.company?.trim()) return input.company.trim();
  return null;
}

async function icypeasFetch(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: ICYPEAS_API_KEY ?? "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Icypeas request failed (${res.status})`);
  }
  return res.json();
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enrich a contact via Icypeas. Returns verified email/phone/LinkedIn when found,
 * or `null` when nothing could be resolved (missing input, no result, or error).
 * Best-effort and safe to fire-and-forget — never throws.
 */
export async function enrichContactViaIcypeas(
  contact: IcypeasContactInput,
): Promise<{ enriched: IcypeasEnrichment } | null> {
  if (!ICYPEAS_API_KEY) return null;

  const { firstname, lastname } = splitName(contact.name);
  const domainOrCompany = deriveDomainOrCompany(contact);
  // Icypeas needs at least a last name (or first name) plus a company/domain.
  if (!domainOrCompany || (!firstname && !lastname)) return null;

  try {
    const submit = await icypeasFetch("/email-search", {
      firstname,
      lastname,
      domainOrCompany,
    });
    const searchId: string | undefined = submit?.item?._id;
    if (!submit?.success || !searchId) return null;

    // Poll for the result (up to ~24s).
    let item: any = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      await sleep(2000);
      const read = await icypeasFetch("/bulk-single-searchs/read", { id: searchId });
      const candidate = read?.items?.[0];
      if (candidate && TERMINAL_STATUSES.has(candidate.status)) {
        item = candidate;
        break;
      }
    }
    if (!item) return null;

    const results = item.results ?? {};
    const enriched: IcypeasEnrichment = {};

    const bestEmail: string | undefined = Array.isArray(results.emails)
      ? results.emails.find((e: any) => e?.email)?.email
      : undefined;
    if (bestEmail) enriched.email = bestEmail;

    if (Array.isArray(results.phones) && results.phones.length > 0) {
      const phoneValue = typeof results.phones[0] === "string"
        ? results.phones[0]
        : results.phones[0]?.phone ?? results.phones[0]?.number;
      if (phoneValue) enriched.mobilePhone = phoneValue;
    }

    if (typeof results.li === "string" && results.li.trim()) {
      enriched.linkedin = results.li.trim();
    }

    if (!enriched.email && !enriched.mobilePhone && !enriched.linkedin) return null;
    return { enriched };
  } catch (err) {
    console.warn("Icypeas enrichment failed:", err);
    return null;
  }
}
