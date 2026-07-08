// notes-chat
//
// "Ask your meetings" — cross-meeting Q&A grounded in ALL of the user's
// meeting notes ("what did we decide with Northwind?"). Every note is
// summarised into a compact digest; the notes most relevant to the latest
// question additionally contribute their transcripts, so answers can quote
// what was actually said without blowing the context window.
//
// Request:  { messages: [{role, content}], notes: [{ title, summary,
//             key_topics?, action_items?, follow_ups?, decisions?,
//             insights?, mentioned_people?, manual_notes?, transcript?,
//             created_at }] }
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
const MAX_TOTAL_CHARS = 220_000;
const MAX_TRANSCRIPT_NOTES = 4;
const MAX_TRANSCRIPT_CHARS = 40_000;
const MAX_NOTES = 120;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Compact one-note digest: everything except the raw transcript. */
function noteDigest(note: any, index: number): string {
  const lines: string[] = [
    `--- Meeting ${index + 1}: ${note?.title ?? "Untitled"}${typeof note?.created_at === "string" ? ` (${note.created_at.slice(0, 10)})` : ""} ---`,
  ];
  if (note?.summary) lines.push(`Summary: ${note.summary}`);
  if (Array.isArray(note?.key_topics) && note.key_topics.length) {
    lines.push(`Topics: ${note.key_topics.join(", ")}`);
  }
  if (Array.isArray(note?.decisions) && note.decisions.length) {
    lines.push("Decisions:\n" + note.decisions.map((d: any) => `- ${d}`).join("\n"));
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
  if (Array.isArray(note?.insights) && note.insights.length) {
    lines.push("Insights:\n" + note.insights.map((i: any) => `- ${i}`).join("\n"));
  }
  if (Array.isArray(note?.mentioned_people) && note.mentioned_people.length) {
    lines.push("People: " + note.mentioned_people.map((p: any) =>
      typeof p === "string" ? p : [p?.name, p?.role].filter(Boolean).join(" — ")
    ).join("; "));
  }
  if (note?.manual_notes) lines.push(`User's notes: ${String(note.manual_notes).slice(0, 2000)}`);
  return lines.join("\n");
}

/** Scores a note's relevance to the question with simple keyword overlap. */
function relevanceScore(note: any, question: string): number {
  const words = question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  if (words.length === 0) return 0;
  const haystack = [
    note?.title,
    note?.summary,
    Array.isArray(note?.key_topics) ? note.key_topics.join(" ") : "",
    Array.isArray(note?.decisions) ? note.decisions.join(" ") : "",
    Array.isArray(note?.mentioned_people)
      ? note.mentioned_people.map((p: any) => (typeof p === "string" ? p : p?.name ?? "")).join(" ")
      : "",
  ].join(" ").toLowerCase();
  let score = 0;
  for (const w of new Set(words)) {
    if (haystack.includes(w)) score += 1;
  }
  return score;
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
    const notes: any[] = Array.isArray(body?.notes) ? body.notes.slice(0, MAX_NOTES) : [];

    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "The assistant is not configured yet." }, 500);
    }

    // Digest every note; attach transcripts only for the most relevant ones.
    const lastUser = [...messages].reverse().find((m: any) => m?.role === "user");
    const question = typeof lastUser?.content === "string" ? lastUser.content : "";

    const digests = notes.map((n, i) => noteDigest(n, i));

    const ranked = notes
      .map((n, i) => ({ i, score: relevanceScore(n, question), hasTranscript: typeof n?.transcript === "string" && n.transcript.length > 200 }))
      .filter((r) => r.hasTranscript && r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_TRANSCRIPT_NOTES);

    const transcriptBlocks: string[] = ranked.map(({ i }) => {
      const n = notes[i];
      return `--- Transcript of "${n?.title ?? "Untitled"}"${typeof n?.created_at === "string" ? ` (${n.created_at.slice(0, 10)})` : ""} ---\n${String(n.transcript).slice(0, MAX_TRANSCRIPT_CHARS)}`;
    });

    let context = digests.join("\n\n");
    for (const block of transcriptBlocks) {
      if (context.length + block.length > MAX_TOTAL_CHARS) break;
      context += "\n\n" + block;
    }
    if (context.length > MAX_TOTAL_CHARS) context = context.slice(0, MAX_TOTAL_CHARS);

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt =
      `You are the user's meeting memory. Today is ${today}. Answer questions using ONLY the meeting notes below (all the user's recorded meetings). When you reference something, name the meeting and its date so the user can find it (e.g. "In *Discovery call — Northwind* (2026-07-01)…"). If several meetings are relevant, synthesize across them. If the notes don't cover it, say so plainly. Be concise; use markdown with short paragraphs, bullet lists, and bold highlights.

${notes.length === 0 ? "The user has no meeting notes yet — tell them to record their first meeting." : `MEETING NOTES (${notes.length} total):\n\n${context}`}`;

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
      console.error("notes-chat upstream error", upstream.status, detail.slice(0, 400));
      if (upstream.status === 429) return jsonResponse({ error: "The assistant is busy — try again in a moment." }, 429);
      if (upstream.status === 402) return jsonResponse({ error: "AI credits exhausted." }, 402);
      return jsonResponse({ error: "The assistant is unavailable right now." }, 500);
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("notes-chat failed", err);
    return jsonResponse({ error: "The assistant hit an unexpected error." }, 500);
  }
});
