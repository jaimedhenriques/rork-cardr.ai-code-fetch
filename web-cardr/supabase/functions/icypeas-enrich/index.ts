// icypeas-enrich
//
// Server-side Icypeas enrichment proxy. Deploy with verify_jwt enabled unless a
// separate auth check is added. Required secret: ICYPEAS_API_KEY.

// deno-lint-ignore-file no-explicit-any

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASE_URL = "https://app.icypeas.com/api";

interface IcypeasContactInput {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  linkedin?: string;
  website?: string;
}

interface IcypeasEnrichment {
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const str = (v: unknown, max = 500): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
};

function splitName(name?: string): { firstname: string; lastname: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstname: "", lastname: "" };
  if (parts.length === 1) return { firstname: parts[0], lastname: "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function icypeasFetch(apiKey: string, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Icypeas request failed (${res.status})`);
  }
  return res.json();
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("ICYPEAS_API_KEY");
    if (!apiKey) return jsonResponse({ error: "Icypeas is not configured." }, 503);

    const raw = await req.json().catch(() => null);
    const contact: IcypeasContactInput = {
      name: str(raw?.name, 200),
      company: str(raw?.company, 200),
      title: str(raw?.title, 200),
      email: str(raw?.email, 300),
      linkedin: str(raw?.linkedin, 500),
      website: str(raw?.website, 500),
    };

    const { firstname, lastname } = splitName(contact.name);
    const domainOrCompany = deriveDomainOrCompany(contact);
    if (!domainOrCompany || (!firstname && !lastname)) return jsonResponse({ enriched: null });

    const submit = await icypeasFetch(apiKey, "/email-search", {
      firstname,
      lastname,
      domainOrCompany,
    });
    const searchId: string | undefined = submit?.item?._id;
    if (!submit?.success || !searchId) return jsonResponse({ enriched: null });

    let item: any = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      await sleep(2000);
      const read = await icypeasFetch(apiKey, "/bulk-single-searchs/read", { id: searchId });
      const candidate = read?.items?.[0];
      if (candidate && TERMINAL_STATUSES.has(candidate.status)) {
        item = candidate;
        break;
      }
    }
    if (!item) return jsonResponse({ enriched: null });

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

    if (!enriched.email && !enriched.mobilePhone && !enriched.linkedin) {
      return jsonResponse({ enriched: null });
    }

    return jsonResponse({ enriched });
  } catch (err) {
    console.error("icypeas-enrich failed", err);
    return jsonResponse({ error: "Could not enrich this contact." }, 500);
  }
});
