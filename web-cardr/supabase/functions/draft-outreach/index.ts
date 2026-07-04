// draft-outreach
//
// Generates a matched pair of outreach drafts (email + LinkedIn message) for
// one of the caller's contacts, personalized from the contact's CRM record.
//
// Request:  { contact_id: string, tone?: string, purpose?: string }
// Response: { drafts: {
//   email: { subject: string, body: string },
//   linkedin: { message: string },
//   personalization_notes?: string
// } }
//
// The caller must be signed in — the function resolves the user from their
// JWT and only reads contacts belonging to that user.
//
// Deploy with verify_jwt=false (the function validates the JWT itself).
// Required secrets: TOOLKIT_URL, RORK_TOOLKIT_SECRET_KEY

// deno-lint-ignore-file no-explicit-any
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-3.5-flash";

const SYSTEM_PROMPT = `You are an expert at multi-channel B2B outreach. Draft one email AND one LinkedIn message for the same recipient and goal. Return ONLY a JSON object (no markdown fences, no commentary):
{
  "email": { "subject": "...", "body": "..." },
  "linkedin": { "message": "..." },
  "personalization_notes": "one sentence explaining which details you personalized around"
}

Rules:
- Email: requested tone, under 180 words, plain text with greeting and sign-off using the sender's name. Specific subject line, no clickbait.
- LinkedIn message: HARD LIMIT 280 characters (LinkedIn caps at 300). Casual-professional, no signature.
- Personalize with the recipient's role, company, industry, location, lead source, and notes — never invent meetings, shared history, or facts that aren't in the input.
- No placeholders like [Name] — write around missing info naturally. No hashtags.
- The two messages must feel consistent but not identical.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey || !toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "AI outreach is not configured yet." }, 500);
    }

    const body = await req.json().catch(() => null);
    const contactId = typeof body?.contact_id === "string" ? body.contact_id : "";
    if (!contactId) return jsonResponse({ error: "contact_id is required" }, 400);
    const tone = typeof body?.tone === "string" ? body.tone.slice(0, 50) : "friendly";
    const purpose = typeof body?.purpose === "string"
      ? body.purpose.slice(0, 500)
      : "Follow-up after meeting";

    // Resolve the caller from their JWT.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token || token === anonKey) {
      return jsonResponse({ error: "Sign in to generate outreach drafts." }, 401);
    }
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    const user = userResp.ok ? await userResp.json().catch(() => null) : null;
    const userId = typeof user?.id === "string" ? user.id : "";
    if (!userId) {
      return jsonResponse({ error: "Sign in to generate outreach drafts." }, 401);
    }

    // Load the contact (scoped to the caller) and the sender profile.
    const restHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const contactFields =
      "name,title,company,email,industry,location,notes,lead_source,company_description,next_step";
    const [contactResp, profileResp] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/contacts?id=eq.${encodeURIComponent(contactId)}` +
          `&user_id=eq.${userId}&select=${contactFields}&limit=1`,
        { headers: restHeaders },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=name,company,title&limit=1`,
        { headers: restHeaders },
      ),
    ]);

    const contacts = contactResp.ok ? await contactResp.json() : [];
    const contact = Array.isArray(contacts) ? contacts[0] : undefined;
    if (!contact) return jsonResponse({ error: "Contact not found" }, 404);

    const profiles = profileResp.ok ? await profileResp.json() : [];
    const profile = (Array.isArray(profiles) ? profiles[0] : undefined) ?? {};

    const line = (label: string, v: unknown, max = 1500): string =>
      typeof v === "string" && v.trim() ? `${label}: ${v.slice(0, max)}` : "";

    const prompt = [
      line("Recipient", contact.name, 200),
      line("Recipient title", contact.title, 200),
      line("Recipient company", contact.company, 200),
      line("Recipient industry", contact.industry, 200),
      line("Recipient location", contact.location, 200),
      line("Lead source", contact.lead_source, 200),
      line("Company description", contact.company_description),
      line("CRM notes", contact.notes),
      line("Planned next step", contact.next_step, 300),
      line("Sender", profile.name, 200) || "Sender: the user",
      line("Sender title", profile.title, 200),
      line("Sender company", profile.company, 200),
      `Tone: ${tone}`,
      `Purpose: ${purpose}`,
    ].filter(Boolean).join("\n");

    const resp = await fetch(
      `${toolkitUrl.replace(/\/$/, "")}/v2/vercel/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${toolkitKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.7,
          max_tokens: 1600,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("draft-outreach upstream error", resp.status, detail.slice(0, 300));
      if (resp.status === 429) return jsonResponse({ error: "AI is busy — try again in a moment." }, 429);
      return jsonResponse({ error: "Could not generate drafts. Please try again." }, 500);
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed?.email?.subject || !parsed?.email?.body || !parsed?.linkedin?.message) {
      console.error("draft-outreach: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not generate drafts. Please try again." }, 500);
    }

    let linkedinMessage = String(parsed.linkedin.message).trim();
    if (linkedinMessage.length > 300) {
      linkedinMessage = linkedinMessage.slice(0, 297).trimEnd() + "…";
    }

    return jsonResponse({
      drafts: {
        email: {
          subject: String(parsed.email.subject),
          body: String(parsed.email.body),
        },
        linkedin: { message: linkedinMessage },
        personalization_notes:
          typeof parsed.personalization_notes === "string"
            ? parsed.personalization_notes
            : undefined,
      },
      model: MODEL,
    });
  } catch (err) {
    console.error("draft-outreach failed", err);
    return jsonResponse({ error: "Failed to generate outreach drafts" }, 500);
  }
});
