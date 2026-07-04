// draft-email
//
// Drafts a personalized outreach email for a contact using a language model
// via the Rork AI proxy (Vercel AI Gateway).
//
// Request:  { contact: { name, company?, title?, email?, notes? },
//             senderName?, senderCompany?, tone?, purpose? }
// Response: { draft: { subject: string, body: string } }
//
// Deploy with verify_jwt=false (clients authorize with the publishable key).
// Required secrets: TOOLKIT_URL, RORK_TOOLKIT_SECRET_KEY

// deno-lint-ignore-file no-explicit-any
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-3.5-flash";

const SYSTEM_PROMPT = `You are an expert business email writer. Draft one email and return ONLY a JSON object (no markdown fences, no commentary):
{ "subject": "...", "body": "..." }

Rules:
- Write in the requested tone. Keep it under 180 words unless the purpose demands more.
- Personalize with the recipient's name, role, company, and any notes provided — but never invent facts, meetings, or shared history that aren't in the input.
- The body is plain text (no HTML, no markdown), with normal paragraphs and a greeting + sign-off using the sender's name.
- No placeholders like [Company] — if information is missing, write around it naturally.
- Subject line: short, specific, no clickbait, no emojis.`;

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "AI drafting is not configured yet." }, 500);
    }

    const body = await req.json().catch(() => null);
    const contact = body?.contact ?? {};
    const name = str(contact.name, 200);
    if (!name) return jsonResponse({ error: "Contact name is required" }, 400);

    const prompt = [
      `Recipient: ${name}`,
      contact.title ? `Recipient title: ${str(contact.title, 200)}` : "",
      contact.company ? `Recipient company: ${str(contact.company, 200)}` : "",
      contact.email ? `Recipient email: ${str(contact.email, 200)}` : "",
      contact.notes ? `Notes about them: ${str(contact.notes)}` : "",
      `Sender: ${str(body?.senderName, 200) || "the user"}`,
      body?.senderCompany ? `Sender company: ${str(body.senderCompany, 200)}` : "",
      `Tone: ${str(body?.tone, 50) || "friendly"}`,
      `Purpose: ${str(body?.purpose, 500) || "Follow-up after meeting"}`,
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
          max_tokens: 1200,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("draft-email upstream error", resp.status, detail.slice(0, 300));
      if (resp.status === 429) return jsonResponse({ error: "AI is busy — try again in a moment." }, 429);
      return jsonResponse({ error: "Could not draft the email. Please try again." }, 500);
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed?.subject || !parsed?.body) {
      console.error("draft-email: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not draft the email. Please try again." }, 500);
    }

    return jsonResponse({
      draft: { subject: String(parsed.subject), body: String(parsed.body) },
      model: MODEL,
    });
  } catch (err) {
    console.error("draft-email failed", err);
    return jsonResponse({ error: "Failed to draft email" }, 500);
  }
});
