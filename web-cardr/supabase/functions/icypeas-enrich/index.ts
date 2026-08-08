// icypeas-enrich
//
// Secure server-side contact enrichment waterfall.
//
// Step 1 — Icypeas: verified work email, phone, LinkedIn profile
// Step 2 — AI company research: industry, size, location, website, description,
//           LinkedIn page, founding year (free, via Rork AI proxy)
// Step 3 — Smart merge: never overwrites user-typed fields
//
// Plan limits enforced server-side:
//   Starter  → 10 lifetime enrichments
//   Pro      → 150/month
//   Business → unlimited
//   Teams    → unlimited
//
// Auth: caller's JWT is validated; the user_id is extracted and used for
// both plan-limit checks and DB writes. Deploy with verify_jwt=false — the
// function does its own JWT validation.
//
// Required secrets:
//   ICYPEAS_API_KEY           — Icypeas API key
//   SUPABASE_URL              — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key (RLS-independent DB access)
//   SUPABASE_ANON_KEY         — anon key (for JWT verification)
//   TOOLKIT_URL               — Rork AI proxy URL
//   RORK_TOOLKIT_SECRET_KEY   — Rork AI proxy auth
//
// deno-lint-ignore-file no-explicit-any

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContactInput {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  linkedin?: string;
  website?: string;
}

interface EnrichmentResult {
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

interface WaterfallResponse {
  enriched: EnrichmentResult | null;
  searched: boolean;
  steps: {
    icypeas: boolean;
    companyResearch: boolean;
  };
  limitReached?: boolean;
  plan?: string;
  remaining?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ICYPEAS_BASE = "https://app.icypeas.com/api";
const AI_MODEL = "google/gemini-3.5-flash";
const MAX_CONTACTS_TO_ENRICH = 10; // safety cap per call

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

const PLAN_ENRICHMENT_LIMITS: Record<string, { count: number; monthly: boolean }> = {
  starter: { count: 10, monthly: false },
  pro: { count: 150, monthly: true },
  business: { count: -1, monthly: false },
  teams: { count: -1, monthly: false },
};

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

function deriveDomainOrCompany(input: ContactInput): string | null {
  const emailDomain = input.email?.split("@")[1]?.trim();
  if (emailDomain && !["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"].includes(emailDomain.toLowerCase())) {
    return emailDomain;
  }
  if (input.website) {
    try {
      const url = input.website.startsWith("http") ? input.website : `https://${input.website}`;
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host) return host;
    } catch { /* fall through */ }
  }
  if (input.company?.trim()) return input.company.trim();
  return null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function normalisePlan(raw: string | null | undefined): string {
  if (!raw) return "starter";
  const lower = raw.toLowerCase();
  if (lower === "free") return "starter";
  if (lower === "pro_plus") return "business";
  if (PLAN_ENRICHMENT_LIMITS[lower]) return lower;
  return "starter";
}

// ---------------------------------------------------------------------------
// Auth + plan limit checking
// ---------------------------------------------------------------------------

async function identifyUser(req: Request): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === anonKey) return null;

  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  const user = await resp.json().catch(() => null);
  return typeof user?.id === "string" ? user.id : null;
}

async function getPlanAndUsage(
  userId: string,
): Promise<{ plan: string; used: number; limit: number; monthly: boolean }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { plan: "starter", used: 0, limit: 10, monthly: false };
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  // Fetch subscription
  const subResp = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&select=plan,status&order=updated_at.desc&limit=1`,
    { headers },
  );
  let plan = "starter";
  if (subResp.ok) {
    const subData = await subResp.json().catch(() => []);
    if (Array.isArray(subData) && subData.length > 0) {
      const status = subData[0]?.status;
      if (status === "active" || status === "trialing") {
        plan = normalisePlan(subData[0]?.plan);
      }
    }
  }

  const limitConfig = PLAN_ENRICHMENT_LIMITS[plan] ?? PLAN_ENRICHMENT_LIMITS.starter;
  const limit = limitConfig.count;
  const monthly = limitConfig.monthly;

  if (limit === -1) {
    return { plan, used: 0, limit: -1, monthly };
  }

  // Count usage
  if (monthly) {
    // Count enrichments this month from usage_tracking
    const periodStart = new Date().toISOString().slice(0, 7) + "-01";
    const usageResp = await fetch(
      `${supabaseUrl}/rest/v1/usage_tracking?user_id=eq.${userId}&period_start=eq.${periodStart}&select=enrichments_used`,
      { headers },
    );
    if (usageResp.ok) {
      const usageData = await usageResp.json().catch(() => []);
      const tracked = Array.isArray(usageData) && usageData.length > 0
        ? Number(usageData[0]?.enrichments_used ?? 0)
        : 0;
      // Also count enriched contacts this month as a floor
      const enrichedResp = await fetch(
        `${supabaseUrl}/rest/v1/contacts?user_id=eq.${userId}&enriched=eq.true&select=id&enriched_at=gte.${periodStart}`,
        { headers: { ...headers, "Prefer": "count=exact" } },
      );
      let liveCount = tracked;
      const countHeader = enrichedResp.headers.get("content-range");
      if (countHeader) {
        const match = countHeader.match(/\/(\d+)$/);
        if (match) liveCount = Math.max(tracked, parseInt(match[1], 10));
      }
      return { plan, used: liveCount, limit, monthly };
    }
  } else {
    // Lifetime count: enriched contacts
    const enrichedResp = await fetch(
      `${supabaseUrl}/rest/v1/contacts?user_id=eq.${userId}&enriched=eq.true&select=id`,
      { headers: { ...headers, "Prefer": "count=exact" } },
    );
    const countHeader = enrichedResp.headers.get("content-range");
    if (countHeader) {
      const match = countHeader.match(/\/(\d+)$/);
      if (match) return { plan, used: parseInt(match[1], 10), limit, monthly };
    }
  }

  return { plan, used: 0, limit, monthly };
}

async function incrementUsage(userId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const periodStart = new Date().toISOString().slice(0, 7) + "-01";

  // Try to increment existing row
  const existingResp = await fetch(
    `${supabaseUrl}/rest/v1/usage_tracking?user_id=eq.${userId}&period_start=eq.${periodStart}&select=id,enrichments_used`,
    { headers },
  );
  if (existingResp.ok) {
    const existing = await existingResp.json().catch(() => []);
    if (Array.isArray(existing) && existing.length > 0) {
      const row = existing[0];
      const currentVal = Number(row.enrichments_used ?? 0);
      await fetch(`${supabaseUrl}/rest/v1/usage_tracking?id=eq.${row.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          enrichments_used: currentVal + 1,
          updated_at: new Date().toISOString(),
        }),
      });
      return;
    }
  }
  // Insert new row
  await fetch(`${supabaseUrl}/rest/v1/usage_tracking`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: userId,
      period_start: periodStart,
      enrichments_used: 1,
    }),
  });
}

// ---------------------------------------------------------------------------
// Step 1: Icypeas email/phone/LinkedIn search
// ---------------------------------------------------------------------------

async function icypeasFetch(apiKey: string, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${ICYPEAS_BASE}${path}`, {
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

async function enrichViaIcypeas(
  apiKey: string,
  contact: ContactInput,
): Promise<EnrichmentResult | null> {
  const { firstname, lastname } = splitName(contact.name);
  const domainOrCompany = deriveDomainOrCompany(contact);
  if (!domainOrCompany || (!firstname && !lastname)) return null;

  const submit = await icypeasFetch(apiKey, "/email-search", {
    firstname,
    lastname,
    domainOrCompany,
  });
  const searchId: string | undefined = submit?.item?._id;
  if (!submit?.success || !searchId) return null;

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
  if (!item) return null;

  const results = item.results ?? {};
  const enriched: EnrichmentResult = {};

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
    return null;
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Step 2: AI company research (free, via Rork AI proxy)
// ---------------------------------------------------------------------------

const COMPANY_RESEARCH_PROMPT = `You are a company research assistant. Given a company name (and optionally a website domain or email domain), return ONLY a JSON object with these fields (omit or use null for anything you don't know — do not guess):
{
  "industry": "e.g. Software, Financial Services, Healthcare",
  "companySize": "e.g. 1-10, 11-50, 51-200, 201-500, 500+",
  "location": "e.g. San Francisco, CA, USA",
  "website": "https://company.com",
  "companyDescription": "1-2 sentence description of what the company does",
  "companyLinkedin": "https://www.linkedin.com/company/company-name",
  "foundingYear": 2015,
  "annualRevenue": "e.g. $1M-$10M",
  "companyType": "e.g. Private, Public, Non-profit"
}
Rules:
- Base everything on publicly available information. If you genuinely don't know a field, use null.
- Keep descriptions to 1-2 sentences maximum.
- Website must be a full URL with https://.
- CompanyLinkedin must be a full LinkedIn company URL.
- Return ONLY the JSON object, no markdown fences, no commentary.`;

function parseModelJSON(text: string): any | null {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function researchCompany(
  contact: ContactInput,
  icypeasResult: EnrichmentResult | null,
): Promise<EnrichmentResult | null> {
  const toolkitUrl = Deno.env.get("TOOLKIT_URL");
  const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
  if (!toolkitUrl || !toolkitKey) return null;

  // Determine the company name / domain to research
  const companyName = contact.company?.trim();
  const emailDomain = contact.email?.split("@")[1]?.trim();
  const icypeasEmailDomain = icypeasResult?.email?.split("@")[1]?.trim();
  const websiteDomain = contact.website?.trim();

  // Skip free email providers
  const freeDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"];
  const domain = [emailDomain, icypeasEmailDomain].find(
    (d) => d && !freeDomains.includes(d.toLowerCase()),
  );

  if (!companyName && !domain && !websiteDomain) return null;

  const parts: string[] = [];
  if (companyName) parts.push(`Company name: ${companyName}`);
  if (domain) parts.push(`Email domain: ${domain}`);
  if (websiteDomain) parts.push(`Website: ${websiteDomain}`);

  const prompt = `${COMPANY_RESEARCH_PROMPT}\n\nResearch this company:\n${parts.join("\n")}`;

  try {
    const resp = await fetch(
      `${toolkitUrl.replace(/\/$/, "")}/v2/vercel/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${toolkitKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0.1,
          max_tokens: 1000,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: parts.join("\n") },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("company research upstream error", resp.status, detail.slice(0, 300));
      return null;
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed) return null;

    const result: EnrichmentResult = {};
    if (typeof parsed.industry === "string" && parsed.industry.trim()) result.industry = parsed.industry.trim();
    if (typeof parsed.companySize === "string" && parsed.companySize.trim()) result.companySize = parsed.companySize.trim();
    if (typeof parsed.location === "string" && parsed.location.trim()) result.location = parsed.location.trim();
    if (typeof parsed.website === "string" && parsed.website.trim()) result.website = parsed.website.trim();
    if (typeof parsed.companyDescription === "string" && parsed.companyDescription.trim()) {
      result.companyDescription = parsed.companyDescription.trim().slice(0, 500);
    }
    if (typeof parsed.companyLinkedin === "string" && parsed.companyLinkedin.trim()) {
      result.companyLinkedin = parsed.companyLinkedin.trim();
    }
    if (parsed.foundingYear != null) result.foundingYear = String(parsed.foundingYear);
    if (typeof parsed.annualRevenue === "string" && parsed.annualRevenue.trim()) result.annualRevenue = parsed.annualRevenue.trim();
    if (typeof parsed.companyType === "string" && parsed.companyType.trim()) result.companyType = parsed.companyType.trim();

    // Only return if we found at least one new field
    const hasData = Object.values(result).some((v) => v != null && v !== "");
    return hasData ? result : null;
  } catch (err) {
    console.error("company research failed", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 3: Smart merge — combine results, never overwrite existing data
// ---------------------------------------------------------------------------

function mergeEnrichment(
  contact: ContactInput,
  icypeasResult: EnrichmentResult | null,
  companyResult: EnrichmentResult | null,
): EnrichmentResult {
  const merged: EnrichmentResult = {};

  // Icypeas provides verified contact info — only fill if missing
  if (icypeasResult) {
    if (icypeasResult.email && !contact.email) merged.email = icypeasResult.email;
    if (icypeasResult.mobilePhone) merged.mobilePhone = icypeasResult.mobilePhone;
    if (icypeasResult.workPhone) merged.workPhone = icypeasResult.workPhone;
    if (icypeasResult.linkedin && !contact.linkedin) merged.linkedin = icypeasResult.linkedin;
  }

  // Company research fills metadata — only fill if missing
  if (companyResult) {
    if (companyResult.industry) merged.industry = companyResult.industry;
    if (companyResult.companySize) merged.companySize = companyResult.companySize;
    if (companyResult.location && !contact.location) merged.location = companyResult.location;
    if (companyResult.website && !contact.website) merged.website = companyResult.website;
    if (companyResult.companyDescription) merged.companyDescription = companyResult.companyDescription;
    if (companyResult.companyLinkedin) merged.companyLinkedin = companyResult.companyLinkedin;
    if (companyResult.foundingYear) merged.foundingYear = companyResult.foundingYear;
    if (companyResult.annualRevenue) merged.annualRevenue = companyResult.annualRevenue;
    if (companyResult.companyType) merged.companyType = companyResult.companyType;
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    // --- Auth ---
    const userId = await identifyUser(req);
    if (!userId) {
      return jsonResponse({ error: "Authentication required for enrichment." }, 401);
    }

    // --- Plan limit check ---
    const { plan, used, limit, monthly } = await getPlanAndUsage(userId);
    if (limit !== -1 && used >= limit) {
      return jsonResponse({
        enriched: null,
        searched: false,
        steps: { icypeas: false, companyResearch: false },
        limitReached: true,
        plan,
        remaining: 0,
      } satisfies WaterfallResponse, 402);
    }

    // --- Parse input ---
    const icypeasKey = Deno.env.get("ICYPEAS_API_KEY");
    if (!icypeasKey) {
      return jsonResponse({ error: "Enrichment is not configured." }, 503);
    }

    const raw = await req.json().catch(() => null);
    const contact: ContactInput = {
      name: str(raw?.name, 200),
      company: str(raw?.company, 200),
      title: str(raw?.title, 200),
      email: str(raw?.email, 300),
      linkedin: str(raw?.linkedin, 500),
      website: str(raw?.website, 500),
    };

    // Also accept wrapped { contact: {...} } format (iOS sends this)
    if (raw?.contact && typeof raw.contact === "object") {
      contact.name = contact.name ?? str(raw.contact.name, 200);
      contact.company = contact.company ?? str(raw.contact.company, 200);
      contact.title = contact.title ?? str(raw.contact.title, 200);
      contact.email = contact.email ?? str(raw.contact.email, 300);
      contact.linkedin = contact.linkedin ?? str(raw.contact.linkedin, 500);
      contact.website = contact.website ?? str(raw.contact.website, 500);
    }

    if (!contact.name && !contact.company) {
      return jsonResponse({
        enriched: null,
        searched: false,
        steps: { icypeas: false, companyResearch: false },
      } satisfies WaterfallResponse);
    }

    // --- Step 1: Icypeas ---
    const icypeasResult = await enrichViaIcypeas(icypeasKey, contact);

    // --- Step 2: AI company research ---
    const companyResult = await researchCompany(contact, icypeasResult);

    // --- Step 3: Smart merge ---
    const merged = mergeEnrichment(contact, icypeasResult, companyResult);
    const hasAnyData = Object.values(merged).some((v) => v != null && v !== "");

    // --- Increment usage (only if we actually searched) ---
    if (icypeasResult || companyResult || contact.name) {
      await incrementUsage(userId);
    }

    const remaining = limit === -1 ? -1 : Math.max(0, limit - used - 1);

    return jsonResponse({
      enriched: hasAnyData ? merged : null,
      searched: true,
      steps: {
        icypeas: icypeasResult != null,
        companyResearch: companyResult != null,
      },
      plan,
      remaining,
    } satisfies WaterfallResponse);
  } catch (err) {
    console.error("icypeas-enrich failed", err);
    return jsonResponse({ error: "Could not enrich this contact." }, 500);
  }
});
