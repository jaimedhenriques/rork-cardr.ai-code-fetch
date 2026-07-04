// enrich-event
//
// AI-fills event details from a conference/trade-show name for the Events
// "Enrich with AI" button.
//
// Request:  { title: string, website?: string|null, year?: string }
// Response: { description, location, start_date, end_date, event_type, website }
//           (all fields nullable — the client only fills empty form fields)
//
// The model is instructed to return null for anything it isn't confident
// about, so we never fabricate dates or venues.
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

const SYSTEM_PROMPT = `You identify professional events (conferences, trade shows, summits, meetups) from their name. Return ONLY a JSON object (no markdown fences, no commentary):
{
  "description": "1-2 sentence factual description of the event, or null",
  "location": "City, Country (or venue, city) or null",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "event_type": "conference" | "trade_show" | "summit" | "meetup" | "networking" | "workshop" | "other",
  "website": "official https:// URL or null"
}

Rules:
- Only fill a field when you are confident about the real event; otherwise use null.
- Dates must be for the requested year's edition. If you don't know that edition's exact dates, set both dates to null — NEVER guess dates.
- Do not invent websites; null is better than a wrong URL.`;

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

const str = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s && s.toLowerCase() !== "null" ? s : null;
};

const isoDate = (v: unknown): string | null => {
  const s = str(v, 20);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "AI enrichment is not configured yet." }, 500);
    }

    const body = await req.json().catch(() => null);
    const title = str(body?.title, 200);
    if (!title || title.length < 3) return jsonResponse({ error: "Event title is required" }, 400);
    const website = str(body?.website, 300);
    const year = /^\d{4}$/.test(String(body?.year ?? ""))
      ? String(body.year)
      : String(new Date().getFullYear());

    const prompt = [
      `Event name: ${title}`,
      `Edition year: ${year}`,
      website ? `Known website: ${website}` : "",
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
          temperature: 0.2,
          max_tokens: 800,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("enrich-event upstream error", resp.status, detail.slice(0, 300));
      if (resp.status === 429) return jsonResponse({ error: "AI is busy — try again in a moment." }, 429);
      return jsonResponse({ error: "Could not enrich the event. Please try again." }, 500);
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed) {
      console.error("enrich-event: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not enrich the event. Please try again." }, 500);
    }

    const site = str(parsed.website, 300);
    return jsonResponse({
      description: str(parsed.description, 800),
      location: str(parsed.location, 200),
      start_date: isoDate(parsed.start_date),
      end_date: isoDate(parsed.end_date),
      event_type: str(parsed.event_type, 40),
      website: site && site.startsWith("http") ? site : website,
    });
  } catch (err) {
    console.error("enrich-event failed", err);
    return jsonResponse({ error: "Failed to enrich event" }, 500);
  }
});
