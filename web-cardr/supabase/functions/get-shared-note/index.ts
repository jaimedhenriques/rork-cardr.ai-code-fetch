// get-shared-note
//
// Public view of a shared meeting note. Looks up meeting_notes by share_token
// with the service role and returns only whitelisted, non-sensitive fields.
//
// Request:  { token: string }
// Response: { note: { title, summary, key_topics, action_items, follow_ups,
//                     decisions, manual_notes, created_at, duration_seconds } }
//           404 { error } when the token doesn't match a note.
//
// Deploy with verify_jwt=false — this page is viewed by anonymous visitors.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    // Share tokens are URL-safe identifiers; reject anything suspicious.
    if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return jsonResponse({ error: "Note not found" }, 404);
    }

    const fields = [
      "title",
      "summary",
      "key_topics",
      "action_items",
      "follow_ups",
      "decisions",
      "manual_notes",
      "created_at",
      "duration_seconds",
    ].join(",");

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/meeting_notes?share_token=eq.${encodeURIComponent(token)}&select=${fields}&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!resp.ok) {
      console.error("get-shared-note: query failed", resp.status);
      return jsonResponse({ error: "Could not load note" }, 500);
    }

    const rows = (await resp.json()) as unknown[];
    const note = Array.isArray(rows) ? rows[0] : undefined;
    if (!note) return jsonResponse({ error: "Note not found" }, 404);

    return jsonResponse({ note });
  } catch (err) {
    console.error("get-shared-note failed", err);
    return jsonResponse({ error: "Could not load note" }, 500);
  }
});
