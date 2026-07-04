// ai-chat
//
// The AI assistant behind the dashboard chat, the full AI page (web + iOS),
// per-note Q&A, and the feedback form. Calls a language model via the Rork AI
// proxy (Vercel AI Gateway).
//
// Request bodies handled:
//   1. { message, context: "feedback-collection" }        → logs feedback, JSON { success }
//   2. { messages, contacts?, folders?, stages?, notes?, enableTools? }
//        → SSE stream (OpenAI-style deltas, ends with [DONE])
//        → or JSON { tool_calls: [...], message? } when the model calls tools
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
const MAX_CONTEXT_CHARS = 120_000;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new contact in the user's CRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name (required)" },
          company: { type: "string" },
          title: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description: "Update fields on an existing contact, found by name or id.",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string", description: "Exact name of the contact to update" },
          contact_id: { type: "string" },
          company: { type: "string" },
          title: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          notes: { type: "string" },
          stage_id: { type: "string", description: "Pipeline stage id to move the contact to" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_contact",
      description: "Delete a contact, found by name or id. Only when the user explicitly asks.",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string" },
          contact_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_contacts_to_stage",
      description: "Move one or more contacts to a pipeline stage.",
      parameters: {
        type: "object",
        properties: {
          stage_id: { type: "string", description: "Target stage id from the provided stages list" },
          contact_names: { type: "array", items: { type: "string" } },
        },
        required: ["stage_id", "contact_names"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enrich_contacts",
      description: "Run data enrichment on contacts. Empty contact_names means enrich all contacts missing details.",
      parameters: {
        type: "object",
        properties: {
          contact_names: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Navigate the user to a page in the app. Paths: /contacts, /scan, /notes, /events, /pipeline, /card, /settings, /analytics.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Compact + cap a context payload so huge CRMs don't blow up the prompt. */
function contextBlock(label: string, value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "";
  let json = JSON.stringify(value);
  if (json.length > MAX_CONTEXT_CHARS) json = json.slice(0, MAX_CONTEXT_CHARS) + "…]";
  return `\n\n${label} (JSON):\n${json}`;
}

function buildSystemPrompt(body: any): string {
  const today = new Date().toISOString().slice(0, 10);
  let prompt =
    `You are cardr's AI assistant — a sharp, friendly networking copilot inside a contacts/CRM app. Today is ${today}.

You can see the user's CRM data below. Answer questions about their contacts, pipeline, meetings, and networking activity. Be concise, use markdown (short paragraphs, bullet lists, bold highlights), and give actionable suggestions.

When the user asks you to create, update, delete, move, or enrich contacts, or to open a page — call the matching tool instead of describing the steps. Never call tools for read-only questions.`;

  prompt += contextBlock("Contacts", body?.contacts);
  prompt += contextBlock("Folders", body?.folders);
  prompt += contextBlock("Pipeline stages", body?.stages);
  prompt += contextBlock("Meeting notes", body?.notes);
  return prompt;
}

interface ToolCallAccumulator {
  id?: string;
  name?: string;
  args: string;
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

    // Feedback form path — record and acknowledge.
    if (body?.context === "feedback-collection" || (typeof body?.message === "string" && !body?.messages)) {
      console.info("[feedback]", String(body?.message ?? "").slice(0, 1000));
      return jsonResponse({ success: true });
    }

    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages || messages.length === 0) {
      return jsonResponse({ error: "Missing messages" }, 400);
    }

    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "The assistant is not configured yet." }, 500);
    }

    const enableTools = body?.enableTools === true;
    const chatMessages = [
      { role: "system", content: buildSystemPrompt(body) },
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
          temperature: 0.4,
          max_tokens: 4000,
          messages: chatMessages,
          ...(enableTools ? { tools: TOOLS, tool_choice: "auto" } : {}),
        }),
      },
    );

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error("ai-chat upstream error", upstream.status, detail.slice(0, 400));
      if (upstream.status === 429) return jsonResponse({ error: "The assistant is busy — try again in a moment." }, 429);
      if (upstream.status === 402) return jsonResponse({ error: "AI credits exhausted." }, 402);
      return jsonResponse({ error: "The assistant is unavailable right now." }, 500);
    }

    // Without tools, pipe the SSE stream straight through.
    if (!enableTools) {
      return new Response(upstream.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // With tools enabled we sniff the stream: if the model calls tools we drain
    // everything and answer with JSON; if it answers with text we replay the
    // buffered bytes and keep streaming.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const rawChunks: Uint8Array[] = [];
    let parseBuffer = "";
    let mode: "unknown" | "stream" | "tools" = "unknown";
    const toolCalls: ToolCallAccumulator[] = [];
    let messageText = "";

    const handlePayload = (payload: string): void => {
      if (payload === "[DONE]") return;
      let obj: any;
      try {
        obj = JSON.parse(payload);
      } catch {
        return;
      }
      const delta = obj?.choices?.[0]?.delta;
      if (!delta) return;
      if (Array.isArray(delta.tool_calls)) {
        if (mode === "unknown") mode = "tools";
        for (const tc of delta.tool_calls) {
          const index = typeof tc.index === "number" ? tc.index : 0;
          if (!toolCalls[index]) toolCalls[index] = { args: "" };
          if (tc.id) toolCalls[index].id = tc.id;
          if (tc.function?.name) toolCalls[index].name = tc.function.name;
          if (typeof tc.function?.arguments === "string") toolCalls[index].args += tc.function.arguments;
        }
      }
      if (typeof delta.content === "string" && delta.content.length > 0) {
        messageText += delta.content;
        if (mode === "unknown" && delta.content.trim().length > 0) mode = "stream";
      }
    };

    const processBuffer = (): void => {
      let newlineIndex: number;
      while ((newlineIndex = parseBuffer.indexOf("\n")) !== -1) {
        let line = parseBuffer.slice(0, newlineIndex);
        parseBuffer = parseBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        handlePayload(line.slice(5).trim());
        // Once we know it's a plain text stream we stop parsing — the raw
        // chunks are replayed verbatim. Tool mode keeps consuming every line.
        if (mode === "stream") return;
      }
    };

    while (mode === "unknown") {
      const { done, value } = await reader.read();
      if (done) break;
      rawChunks.push(value);
      parseBuffer += decoder.decode(value, { stream: true });
      processBuffer();
    }

    if (mode === "stream") {
      const passthrough = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for (const chunk of rawChunks) controller.enqueue(chunk);
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch (err) {
            console.error("ai-chat stream relay error", err);
          } finally {
            controller.close();
          }
        },
      });
      return new Response(passthrough, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Tools (or empty) — drain the rest, then reply with JSON.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parseBuffer += decoder.decode(value, { stream: true });
      processBuffer();
    }
    parseBuffer += decoder.decode();
    processBuffer();
    // Flush a final line without a trailing newline, if any.
    const tail = parseBuffer.trim();
    if (tail.startsWith("data:")) handlePayload(tail.slice(5).trim());

    const completedCalls = toolCalls
      .filter((tc) => tc.name)
      .map((tc, i) => ({
        id: tc.id ?? `call_${i}`,
        type: "function",
        function: { name: tc.name, arguments: tc.args || "{}" },
      }));

    if (completedCalls.length > 0) {
      return jsonResponse({
        tool_calls: completedCalls,
        ...(messageText.trim() ? { message: messageText.trim() } : {}),
      });
    }
    return jsonResponse({
      message: messageText.trim() || "I didn't catch that — could you rephrase?",
    });
  } catch (err) {
    console.error("ai-chat failed", err);
    return jsonResponse({ error: "The assistant hit an unexpected error." }, 500);
  }
});
