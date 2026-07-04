// translate-ui
//
// Translates a batch of UI strings for the in-app language switcher. The
// client sends batches of ~80 key/value pairs and merges the results.
//
// Request:  { strings: Record<string,string>, targetLang: string }
// Response: { translations: Record<string,string> }
//
// Keys are preserved exactly; {{placeholders}} inside values must survive
// translation untouched. Missing keys fall back to the English source so a
// partial model response never breaks the UI.
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
const MAX_KEYS = 120;

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
    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "Translation is not configured yet." }, 500);
    }

    const body = await req.json().catch(() => null);
    const targetLang = typeof body?.targetLang === "string" ? body.targetLang.trim().slice(0, 40) : "";
    const rawStrings = body?.strings;
    if (!targetLang || !rawStrings || typeof rawStrings !== "object") {
      return jsonResponse({ error: "strings and targetLang are required" }, 400);
    }

    // Sanitize input: string values only, capped batch size.
    const source: Record<string, string> = {};
    let count = 0;
    for (const [k, v] of Object.entries(rawStrings)) {
      if (typeof v !== "string" || typeof k !== "string") continue;
      source[k.slice(0, 200)] = v.slice(0, 1000);
      if (++count >= MAX_KEYS) break;
    }
    if (count === 0) return jsonResponse({ translations: {} });

    // English passthrough — nothing to do.
    if (/^en(-|$)/i.test(targetLang) || targetLang.toLowerCase() === "english") {
      return jsonResponse({ translations: source });
    }

    const systemPrompt = `You are a professional app localizer. Translate the VALUES of the given JSON object into the target language. Return ONLY a JSON object with the EXACT same keys and translated values — no markdown fences, no commentary.

Rules:
- Keep every key byte-for-byte identical.
- Preserve placeholders like {{name}}, {count}, %s, and emoji exactly as-is.
- Keep brand names ("Cardr", "Zapier", "LinkedIn", etc.) untranslated.
- Match UI register: short, natural, native-sounding labels — not literal word-for-word translations.
- Keep roughly the same length as the source where possible (these are buttons and labels).`;

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
          temperature: 0.2,
          max_tokens: 8000,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Target language: ${targetLang}\n\nJSON to translate:\n${JSON.stringify(source)}`,
            },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("translate-ui upstream error", resp.status, detail.slice(0, 300));
      if (resp.status === 429) return jsonResponse({ error: "Translation service is busy — try again shortly." }, 429);
      return jsonResponse({ error: "Could not translate right now." }, 500);
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed || typeof parsed !== "object") {
      console.error("translate-ui: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not translate right now." }, 500);
    }

    // Only accept known keys; fall back to English for anything missing.
    const translations: Record<string, string> = {};
    for (const key of Object.keys(source)) {
      const t = parsed[key];
      translations[key] = typeof t === "string" && t.trim() ? t : source[key];
    }

    return jsonResponse({ translations });
  } catch (err) {
    console.error("translate-ui failed", err);
    return jsonResponse({ error: "Translation failed" }, 500);
  }
});
