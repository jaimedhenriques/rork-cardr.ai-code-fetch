// generate-proposal
//
// AI-generates a client proposal for the Agents "Proposal Builder": pulls the
// contact + sender profile server-side, asks the model for structured content,
// renders a clean standalone HTML document, and saves a row in `proposals`.
//
// Request:  { agent_id?, contact_id?, project_type, budget?, timeline?, notes? }
//           (caller must be signed in — the proposal row is owned by them)
// Response: { proposal_id: string } | { error: string }
//
// Deploy with verify_jwt=false — the function validates the JWT itself.
// Required secrets: TOOLKIT_URL, RORK_TOOLKIT_SECRET_KEY

// deno-lint-ignore-file no-explicit-any
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-3.5-flash";

const SYSTEM_PROMPT = `You write persuasive, professional client proposals. Return ONLY a JSON object (no markdown fences, no commentary):
{
  "title": "proposal title",
  "executive_summary": "2-3 sentence overview",
  "sections": [ { "heading": "...", "body": "plain text, may contain \\n\\n paragraphs" } ],
  "pricing": [ { "item": "...", "price": "..." } ],
  "next_steps": ["...", "..."]
}

Rules:
- 3 to 5 sections covering scope, approach/deliverables, and timeline.
- Ground everything in the provided details; never invent client facts, prior meetings, or specific commitments that weren't given.
- If budget was provided, pricing must fit inside it; otherwise give sensible line items with realistic prices.
- Professional, confident tone. No placeholders like [Client Name] — write around missing info naturally.`;

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

const str = (v: unknown, max = 2000): string =>
  typeof v === "string" ? v.slice(0, max) : "";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function renderHtml(input: {
  title: string;
  executive_summary: string;
  sections: { heading: string; body: string }[];
  pricing: { item: string; price: string }[];
  next_steps: string[];
  senderName: string;
  senderCompany: string;
  clientName: string;
  clientCompany: string;
}): string {
  const pricingRows = input.pricing
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.item)}</td><td class="price">${escapeHtml(p.price)}</td></tr>`,
    )
    .join("");
  const sections = input.sections
    .map((s) => `<section><h2>${escapeHtml(s.heading)}</h2>${paragraphs(s.body)}</section>`)
    .join("");
  const steps = input.next_steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  const preparedFor = [input.clientName, input.clientCompany].filter(Boolean).join(" · ");
  const preparedBy = [input.senderName, input.senderCompany].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(input.title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #f6f7f9; color: #17202a; }
  .page { max-width: 760px; margin: 0 auto; background: #fff; padding: 56px 56px 64px; }
  header { border-bottom: 3px solid #17202a; padding-bottom: 24px; margin-bottom: 32px; }
  h1 { font-size: 30px; margin: 0 0 12px; letter-spacing: -0.02em; }
  .meta { font-size: 13px; color: #5d6d7e; line-height: 1.7; }
  .summary { background: #f0f4f8; border-left: 4px solid #17202a; padding: 16px 20px; margin: 0 0 32px; font-size: 15px; line-height: 1.65; }
  h2 { font-size: 18px; margin: 32px 0 10px; letter-spacing: -0.01em; }
  p { font-size: 14.5px; line-height: 1.7; margin: 0 0 12px; color: #2c3e50; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 8px; }
  td { padding: 10px 12px; border-bottom: 1px solid #e6eaee; font-size: 14px; }
  td.price { text-align: right; font-weight: 600; white-space: nowrap; }
  ol { padding-left: 20px; }
  li { font-size: 14.5px; line-height: 1.8; color: #2c3e50; }
  footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e6eaee; font-size: 12px; color: #8395a7; }
  @media print { body { background: #fff; } .page { padding: 24px; } }
</style>
</head>
<body>
<div class="page">
  <header>
    <h1>${escapeHtml(input.title)}</h1>
    <div class="meta">
      ${preparedFor ? `Prepared for: <strong>${escapeHtml(preparedFor)}</strong><br/>` : ""}
      ${preparedBy ? `Prepared by: <strong>${escapeHtml(preparedBy)}</strong><br/>` : ""}
      Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
    </div>
  </header>
  <div class="summary">${escapeHtml(input.executive_summary)}</div>
  ${sections}
  ${pricingRows ? `<section><h2>Investment</h2><table>${pricingRows}</table></section>` : ""}
  ${steps ? `<section><h2>Next steps</h2><ol>${steps}</ol></section>` : ""}
  <footer>This proposal was prepared with Cardr.</footer>
</div>
</body>
</html>`;
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
      return jsonResponse({ error: "Proposal generation is not configured yet." }, 500);
    }

    // --- Authenticate ---------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt || jwt === anonKey) return jsonResponse({ error: "Not authenticated" }, 401);
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userResp.ok) return jsonResponse({ error: "Not authenticated" }, 401);
    const user = await userResp.json().catch(() => null);
    const userId = typeof user?.id === "string" ? user.id : "";
    if (!userId) return jsonResponse({ error: "Not authenticated" }, 401);

    // --- Input ------------------------------------------------------------------
    const body = await req.json().catch(() => null);
    const projectType = str(body?.project_type, 120);
    if (!projectType) return jsonResponse({ error: "Project type is required" }, 400);
    const budget = str(body?.budget, 120);
    const timeline = str(body?.timeline, 120);
    const notes = str(body?.notes, 3000);
    const contactId = typeof body?.contact_id === "string" ? body.contact_id : "";

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // --- Load contact (owned by caller) + sender profile ------------------------
    let contact: any = null;
    if (contactId && /^[0-9a-f-]{36}$/i.test(contactId)) {
      const cResp = await fetch(
        `${supabaseUrl}/rest/v1/contacts?id=eq.${contactId}&user_id=eq.${userId}&select=id,name,company,title,industry,notes&limit=1`,
        { headers: svc },
      );
      if (cResp.ok) contact = ((await cResp.json()) as any[])[0] ?? null;
    }
    const pResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=name,company,title&limit=1`,
      { headers: svc },
    );
    const profile: any = pResp.ok ? ((await pResp.json()) as any[])[0] ?? {} : {};

    // --- Ask the model ------------------------------------------------------------
    const prompt = [
      `Project type: ${projectType}`,
      budget ? `Budget range: ${budget}` : "",
      timeline ? `Timeline: ${timeline}` : "",
      contact?.name ? `Client: ${str(contact.name, 200)}` : "",
      contact?.company ? `Client company: ${str(contact.company, 200)}` : "",
      contact?.title ? `Client title: ${str(contact.title, 200)}` : "",
      contact?.industry ? `Client industry: ${str(contact.industry, 200)}` : "",
      contact?.notes ? `Notes about the client: ${str(contact.notes, 1000)}` : "",
      profile?.name ? `Sender: ${str(profile.name, 200)}` : "",
      profile?.company ? `Sender company: ${str(profile.company, 200)}` : "",
      notes ? `Extra instructions from the sender: ${notes}` : "",
    ].filter(Boolean).join("\n");

    const aiResp = await fetch(
      `${toolkitUrl.replace(/\/$/, "")}/v2/vercel/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${toolkitKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.6,
          max_tokens: 3500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!aiResp.ok) {
      const detail = await aiResp.text().catch(() => "");
      console.error("generate-proposal upstream error", aiResp.status, detail.slice(0, 300));
      if (aiResp.status === 429) return jsonResponse({ error: "AI is busy — try again in a moment." }, 429);
      return jsonResponse({ error: "Could not generate the proposal. Please try again." }, 500);
    }

    const data = await aiResp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed?.title || !Array.isArray(parsed?.sections)) {
      console.error("generate-proposal: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not generate the proposal. Please try again." }, 500);
    }

    const structured = {
      title: str(parsed.title, 200),
      executive_summary: str(parsed.executive_summary, 1500),
      sections: parsed.sections
        .slice(0, 8)
        .map((s: any) => ({ heading: str(s?.heading, 120), body: str(s?.body, 5000) }))
        .filter((s: any) => s.heading && s.body),
      pricing: Array.isArray(parsed.pricing)
        ? parsed.pricing
            .slice(0, 12)
            .map((p: any) => ({ item: str(p?.item, 200), price: str(p?.price, 60) }))
            .filter((p: any) => p.item)
        : [],
      next_steps: Array.isArray(parsed.next_steps)
        ? parsed.next_steps.slice(0, 8).map((s: any) => str(s, 300)).filter(Boolean)
        : [],
    };

    const html = renderHtml({
      ...structured,
      senderName: str(profile?.name, 200),
      senderCompany: str(profile?.company, 200),
      clientName: str(contact?.name, 200),
      clientCompany: str(contact?.company, 200),
    });

    // --- Save --------------------------------------------------------------------
    const insertResp = await fetch(`${supabaseUrl}/rest/v1/proposals`, {
      method: "POST",
      headers: {
        ...svc,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        contact_id: contact?.id ?? null,
        project_type: projectType,
        budget_range: budget || null,
        timeline: timeline || null,
        title: structured.title,
        html_content: html,
        structured_content: structured,
        status: "draft",
        share_token: crypto.randomUUID().replace(/-/g, ""),
      }),
    });
    if (!insertResp.ok) {
      console.error(
        "generate-proposal: insert failed",
        insertResp.status,
        await insertResp.text().catch(() => ""),
      );
      return jsonResponse({ error: "Could not save the proposal" }, 500);
    }
    const rows = (await insertResp.json()) as { id: string }[];
    const proposalId = rows?.[0]?.id;
    if (!proposalId) return jsonResponse({ error: "Could not save the proposal" }, 500);

    return jsonResponse({ proposal_id: proposalId });
  } catch (err) {
    console.error("generate-proposal failed", err);
    return jsonResponse({ error: "Failed to generate proposal" }, 500);
  }
});
