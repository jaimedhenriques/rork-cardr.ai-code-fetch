// note-chat
//
// "Ask about this note" — per-meeting Q&A grounded ONLY in a single note's
// content (summary, insights, polished notes, transcript). Streams an
// OpenAI-style SSE response via the Rork AI proxy (Vercel AI Gateway).
//
// Request:  { messages: [{role, content}], note: { title, summary, transcript,
//             manual_notes, enhanced_notes?, key_topics?, action_items?,
//             follow_ups?, decisions?, insights?, mentioned_people?,
//             open_questions?, created_at? } }
// Response: SSE stream (data: {choices:[{delta:{content}}]} … data: [DONE])
//
// Deploy with verify_jwt=false. Required secrets: TOOLKIT_URL, RORK_TOOLKIT_SECRET_KEY

// deno-lint-ignore-file no-explicit-any
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-3.5-flash";
const MAX_TRANSCRIPT_CHARS = 150_000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Builds a compact grounding block describing the single note. */
function noteContext(note: any): string {
  const lines: string[] = [`Title: ${note?.title ?? "Untitled"}`];
  if (typeof note?.created_at === "string") lines.push(`Date: ${note.created_at}`);
  if (note?.summary) lines.push(`Summary: ${note.summary}`);
  if (Array.isArray(note?.key_topics) && note.key_topics.length) {
    lines.push(`Key topics: ${note.key_topics.join(", ")}`);
  }
  if (Array.isArray(note?.action_items) && note.action_items.length) {
    lines.push("Action items:\n" + note.action_items.map((a: any) => {
      const task = typeof a === "string" ? a : a?.task ?? "";
      const owner = typeof a === "object" && a?.owner ? ` (owner: ${a.owner})` : "";
      const deadline = typeof a === "object" && a?.deadline ? ` (due: ${a.deadline})` : "";
      const done = typeof a === "object" && a?.done ? " [done]" : "";
      return `- ${task}${owner}${deadline}${done}`;
    }).join("\n"));
  }
  if (Array.isArray(note?.follow_ups) && note.follow_ups.length) {
    lines.push("Follow-ups:\n" + note.follow_ups.map((f: any) => {
      const desc = typeof f === "string" ? f : f?.description ?? "";
      const withWho = typeof f === "object" && f?.with ? ` (with: ${f.with})` : "";
      return `- ${desc}${withWho}`;
    }).join("\n"));
  }
  if (Array.isArray(note?.decisions) && note.decisions.length) {
    lines.push("Decisions:\n" + note.decisions.map((d: any) => `- ${d}`).join("\n"));
  }
  if (Array.isArray(note?.insights) && note.insights.length) {
    lines.push("Insights:\n" + note.insights.map((i: any) => `- ${i}`).join("\n"));
  }
  if (Array.isArray(note?.mentioned_people) && note.mentioned_people.length) {
    lines.push("People mentioned:\n" + note.mentioned_people.map((p: any) => {
      const name = typeof p === "string" ? p : p?.name ?? "";
      const role = typeof p === "object" && p?.role ? ` — ${p.role}` : "";
      return `- ${name}${role}`;
    }).join("\n"));
  }
  if (Array.isArray(note?.open_questions) && note.open_questions.length) {
    lines.push("Open questions:\n" + note.open_questions.map((q: any) => `- ${q}`).join("\n"));
  }
  if (note?.enhanced_notes) lines.push(`Polished notes:\n${note.enhanced_notes}`);
  if (note?.manual_notes) lines.push(`User's own notes:\n${note.manual_notes}`);
  if (note?.transcript) {
    lines.push(`Transcript:\n${String(note.transcript).slice(0, MAX_TRANSCRIPT_CHARS)}`);
  }
  return lines.join("\n\n");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages || messages.length === 0) {
      return jsonResponse({ error: "Missing messages" }, 400);
    }
    if (!body?.note || typeof body.note !== "object") {
      return jsonResponse({ error: "Missing note" }, 400);
    }

    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "The assistant is not configured yet." }, 500);
    }

    const systemPrompt =
      `You are a meeting assistant answering questions about ONE meeting note only. Base every answer strictly on the meeting information below and say so if something isn't covered by it. Be concise and use markdown (short paragraphs, bullet lists, bold highlights). When asked to draft emails or agendas, ground every detail in this meeting.

MEETING NOTE:

${noteContext(body.note)}`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages
        .filter((m: any) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
        .map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const upstream = await fetch(
      `${toolkitUrl.replace(/\/$/, "")}/v2/vercel/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${toolkitKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          temperature: 0.3,
          max_tokens: 3000,
          messages: chatMessages,
        }),
      },
    );

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error("note-chat upstream error", upstream.status, detail.slice(0, 400));
      if (upstream.status === 429) return jsonResponse({ error: "The assistant is busy — try again in a moment." }, 429);
      if (upstream.status === 402) return jsonResponse({ error: "AI credits exhausted." }, 402);
      return jsonResponse({ error: "The assistant is unavailable right now." }, 500);
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("note-chat failed", err);
    return jsonResponse({ error: "The assistant hit an unexpected error." }, 500);
  }
});
