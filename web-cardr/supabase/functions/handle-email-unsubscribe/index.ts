// handle-email-unsubscribe
//
// Public endpoint backing the /unsubscribe page.
//
// GET  ?token=…  → { valid: true } | { valid: false, reason: "already_unsubscribed" | "invalid" }
// POST { token } → { success: true } | { success: false, reason: "already_unsubscribed" | "invalid" }
//
// Deploy with verify_jwt=false — recipients are not signed in.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface UnsubRow {
  id: string;
  unsubscribed_at: string | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }
    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    let token = "";
    if (req.method === "GET") {
      token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      token = typeof body?.token === "string" ? body.token.trim() : "";
    } else {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return req.method === "GET"
        ? jsonResponse({ valid: false, reason: "invalid" })
        : jsonResponse({ success: false, reason: "invalid" }, 400);
    }

    const rowResp = await fetch(
      `${supabaseUrl}/rest/v1/email_unsubscribes?token=eq.${encodeURIComponent(token)}&select=id,unsubscribed_at&limit=1`,
      { headers: svc },
    );
    const rows = rowResp.ok ? ((await rowResp.json()) as UnsubRow[]) : [];
    const row = rows?.[0];

    if (req.method === "GET") {
      if (!row) return jsonResponse({ valid: false, reason: "invalid" });
      if (row.unsubscribed_at) return jsonResponse({ valid: false, reason: "already_unsubscribed" });
      return jsonResponse({ valid: true });
    }

    // POST — perform the unsubscribe
    if (!row) return jsonResponse({ success: false, reason: "invalid" }, 400);
    if (row.unsubscribed_at) return jsonResponse({ success: false, reason: "already_unsubscribed" });

    const patchResp = await fetch(
      `${supabaseUrl}/rest/v1/email_unsubscribes?id=eq.${row.id}`,
      {
        method: "PATCH",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
      },
    );
    if (!patchResp.ok) {
      console.error("handle-email-unsubscribe: patch failed", patchResp.status);
      return jsonResponse({ error: "Could not process the request" }, 500);
    }
    return jsonResponse({ success: true });
  } catch (err) {
    console.error("handle-email-unsubscribe failed", err);
    return jsonResponse({ error: "Could not process the request" }, 500);
  }
});
