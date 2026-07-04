// generate-sequence
//
// AI-drafts a multi-step outreach sequence for the Automations builder.
//
// Request:  { goal: string, channel: string, tone: string, steps: number,
//             audience?: string }
// Response: { sequence: { name, description,
//             steps: [{ step_order, channel, delay_days,
//                       subject_template, body_template }] } }
//
// Step channels are constrained to: email | linkedin_message |
// linkedin_connection (matching the SequenceStep type on the client).
// Templates may use {{name}}, {{full_name}}, {{company}}, {{title}},
// {{industry}} placeholders which the client fills per-contact.
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
const VALID_CHANNELS = new Set(["email", "linkedin_message", "linkedin_connection"]);

const SYSTEM_PROMPT = `You design B2B outreach sequences. Return ONLY a JSON object (no markdown fences, no commentary):
{
  "name": "short sequence name",
  "description": "one-sentence description",
  "steps": [
    { "step_order": 1, "channel": "email", "delay_days": 0, "subject_template": "...", "body_template": "..." }
  ]
}

Rules:
- channel must be one of: "email", "linkedin_message", "linkedin_connection".
- If the requested channel is "email", every step is email. If "linkedin", use linkedin_connection first then linkedin_message. If "multi", mix sensibly.
- delay_days is days after the PREVIOUS step (first step = 0). Space steps 2-4 days apart.
- Templates may use placeholders {{name}}, {{full_name}}, {{company}}, {{title}}, {{industry}} — use them for personalization instead of inventing facts.
- email steps need subject_template; LinkedIn steps set subject_template to null.
- linkedin_connection body must be under 280 characters.
- Bodies are plain text, concise, specific to the goal, never pushy or spammy.`;

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

const str = (v: unknown, max = 500): string =>
  typeof v === "string" ? v.slice(0, max) : "";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "AI generation is not configured yet." }, 500);
    }

    const body = await req.json().catch(() => null);
    const goal = str(body?.goal);
    if (!goal) return jsonResponse({ error: "Goal is required" }, 400);
    const channel = str(body?.channel, 40) || "email";
    const tone = str(body?.tone, 40) || "friendly";
    const audience = str(body?.audience, 300);
    const stepCount = Math.min(7, Math.max(1, Number(body?.steps) || 3));

    const prompt = [
      `Goal: ${goal}`,
      `Channel preference: ${channel}`,
      `Tone: ${tone}`,
      `Number of steps: ${stepCount}`,
      audience ? `Target audience: ${audience}` : "",
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
          max_tokens: 2500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("generate-sequence upstream error", resp.status, detail.slice(0, 300));
      if (resp.status === 429) return jsonResponse({ error: "AI is busy — try again in a moment." }, 429);
      return jsonResponse({ error: "Could not generate the sequence. Please try again." }, 500);
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJSON(text);
    if (!parsed?.name || !Array.isArray(parsed?.steps) || parsed.steps.length === 0) {
      console.error("generate-sequence: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not generate the sequence. Please try again." }, 500);
    }

    // Normalize + validate every step so bad model output never reaches the DB.
    const steps = parsed.steps
      .slice(0, stepCount)
      .map((s: any, i: number) => {
        const ch = VALID_CHANNELS.has(String(s?.channel)) ? String(s.channel) : "email";
        return {
          step_order: i + 1,
          channel: ch,
          delay_days: Math.min(30, Math.max(0, Number(s?.delay_days) || (i === 0 ? 0 : 3))),
          subject_template: ch === "email" ? str(s?.subject_template, 200) || "Quick question, {{name}}" : null,
          body_template: str(s?.body_template, 3000),
        };
      })
      .filter((s: any) => s.body_template.length > 0);

    if (steps.length === 0) {
      return jsonResponse({ error: "Could not generate the sequence. Please try again." }, 500);
    }

    return jsonResponse({
      sequence: {
        name: str(parsed.name, 120) || "Outreach sequence",
        description: str(parsed.description, 300),
        steps,
      },
    });
  } catch (err) {
    console.error("generate-sequence failed", err);
    return jsonResponse({ error: "Failed to generate sequence" }, 500);
  }
});
