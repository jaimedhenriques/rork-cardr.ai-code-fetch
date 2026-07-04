// scan-badge
//
// Reads a business card / conference badge / QR photo and extracts structured
// contact fields using a vision model via the Rork AI proxy (Vercel AI Gateway).
//
// Request:  { imageBase64: "data:image/...;base64,...", preprocessMeta?: {...} }
// Response: {
//   contact: { name, company, title, email, phone, linkedin, website, location } | null,
//   rawText: string,
//   confidence: Record<string, number>,
//   boxes: {},
//   model: string,
//   preprocessGuard: string | null,
// }
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

const MODEL = "google/gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `You read photos of business cards, conference badges, email signatures, and QR codes, and extract contact details.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{
  "rawText": "all visible text, line by line",
  "contact": {
    "name": "person's full name or empty string",
    "company": "", "title": "", "email": "", "phone": "",
    "linkedin": "", "website": "", "location": ""
  },
  "confidence": { "name": 0.0, "company": 0.0, "title": 0.0, "email": 0.0, "phone": 0.0 }
}

Rules:
- If the image contains a QR code with a vCard / MeCard / URL, decode what you can read and map it to the fields.
- phone: keep international format when shown (e.g. +1 415 ...). Pick the mobile/direct number if several.
- linkedin: full URL if printed or clearly implied (linkedin.com/in/...), else empty.
- website: the company or personal site, without mailto/tel prefixes.
- location: city/state/country if printed.
- confidence values are 0..1 per field (0 when the field is empty).
- If the image contains no readable contact info at all, return contact with all empty strings.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Strips markdown fences and parses the first JSON object in the text. */
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "Scanning is not configured yet." }, 500);
    }

    const body = await req.json().catch(() => null);
    const imageBase64 = body?.imageBase64;
    if (typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image")) {
      return jsonResponse({ error: "Missing or invalid imageBase64" }, 400);
    }
    const preprocessGuard = body?.preprocessMeta?.guard ?? null;

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
          temperature: 0,
          max_tokens: 2000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract the contact details from this image." },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("scan-badge upstream error", resp.status, detail.slice(0, 400));
      if (resp.status === 429) return jsonResponse({ error: "Too many scans right now — try again in a moment." }, 429);
      if (resp.status === 402) return jsonResponse({ error: "AI credits exhausted." }, 402);
      return jsonResponse({ error: "Could not read the image. Please try again." }, 500);
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed) {
      console.error("scan-badge: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not understand the card. Please retake the photo." }, 500);
    }

    const c = parsed.contact ?? {};
    const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    const contact = {
      name: clean(c.name),
      company: clean(c.company),
      title: clean(c.title),
      email: clean(c.email),
      phone: clean(c.phone),
      linkedin: clean(c.linkedin),
      website: clean(c.website),
      location: clean(c.location),
    };

    return jsonResponse({
      contact: contact.name || contact.email || contact.phone ? contact : contact,
      rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
      confidence: parsed.confidence && typeof parsed.confidence === "object" ? parsed.confidence : {},
      boxes: {},
      model: MODEL,
      preprocessGuard,
    });
  } catch (err) {
    console.error("scan-badge failed", err);
    return jsonResponse({ error: "Failed to scan image" }, 500);
  }
});
