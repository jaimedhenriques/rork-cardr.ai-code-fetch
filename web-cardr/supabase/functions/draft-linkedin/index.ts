// draft-linkedin
//
// Drafts a LinkedIn connection request note or direct message for a contact
// using a language model via the Rork AI proxy (Vercel AI Gateway).
//
// Request:  { contact: { name, company?, title?, industry?, location?, notes? },
//             senderName?, senderCompany?,
//             type?: "connection_request" | "direct_message",
//             tone?, customContext? }
// Response: { draft: { message: string, characterCount: number } }
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

function systemPrompt(type: string): string {
  const isConnection = type === "connection_request";
  return `You are an expert at LinkedIn outreach. Draft one ${
    isConnection ? "connection request note" : "direct message"
  } and return ONLY a JSON object (no markdown fences, no commentary):
{ "message": "..." }

Rules:
- ${isConnection
    ? "HARD LIMIT: the message must be under 280 characters (LinkedIn caps connection notes at 300). Count carefully."
    : "Keep it under 900 characters — short, scannable paragraphs."}
- Write in the requested tone. Sound like a real person, not a template.
- Personalize with the recipient's role, company, industry, location, and any notes/context provided — never invent shared history or meetings that aren't in the input.
- No placeholders like [Name]. No hashtags. No emojis unless the tone is casual or enthusiastic (max 1).
- Do not include a subject line or signature block — just the message text.`;
}

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

    const type = body?.type === "direct_message" ? "direct_message" : "connection_request";

    const prompt = [
      `Recipient: ${name}`,
      contact.title ? `Recipient title: ${str(contact.title, 200)}` : "",
      contact.company ? `Recipient company: ${str(contact.company, 200)}` : "",
      contact.industry ? `Recipient industry: ${str(contact.industry, 200)}` : "",
      contact.location ? `Recipient location: ${str(contact.location, 200)}` : "",
      contact.notes ? `Notes about them: ${str(contact.notes)}` : "",
      `Sender: ${str(body?.senderName, 200) || "the user"}`,
      body?.senderCompany ? `Sender company: ${str(body.senderCompany, 200)}` : "",
      `Tone: ${str(body?.tone, 50) || "professional"}`,
      body?.customContext ? `Additional context: ${str(body.customContext, 500)}` : "",
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
          max_tokens: 800,
          messages: [
            { role: "system", content: systemPrompt(type) },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("draft-linkedin upstream error", resp.status, detail.slice(0, 300));
      if (resp.status === 429) return jsonResponse({ error: "AI is busy — try again in a moment." }, 429);
      return jsonResponse({ error: "Could not draft the message. Please try again." }, 500);
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed?.message) {
      console.error("draft-linkedin: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not draft the message. Please try again." }, 500);
    }

    // Enforce the LinkedIn connection-note cap server-side as a last resort.
    let message = String(parsed.message).trim();
    if (type === "connection_request" && message.length > 300) {
      message = message.slice(0, 297).trimEnd() + "…";
    }

    return jsonResponse({
      draft: { message, characterCount: message.length },
      model: MODEL,
    });
  } catch (err) {
    console.error("draft-linkedin failed", err);
    return jsonResponse({ error: "Failed to draft LinkedIn message" }, 500);
  }
});
