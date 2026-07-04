// apply-referral
//
// Links a newly signed-up user to the referrer whose code they used.
//
// Request:  { referral_code: string }  (caller must be signed in)
// Response: { success: true } | { error: string }
//
// Guards: unknown code, self-referral, and double-application are rejected.
// Deploy with verify_jwt=false — the function validates the JWT itself so it
// can return clean JSON error codes the client understands.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-referral-stats-log-mode",
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    // --- Authenticate the caller -------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token === anonKey) {
      return jsonResponse({ error: "Not authenticated", code: "AUTH_MISSING_HEADER" }, 401);
    }
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userResp.ok) {
      return jsonResponse({ error: "Not authenticated", code: "AUTH_TOKEN_INVALID" }, 401);
    }
    const user = await userResp.json().catch(() => null);
    const userId = typeof user?.id === "string" ? user.id : "";
    if (!userId) {
      return jsonResponse({ error: "Not authenticated", code: "AUTH_TOKEN_INVALID" }, 401);
    }

    // --- Validate input ------------------------------------------------------
    const body = await req.json().catch(() => null);
    const code = typeof body?.referral_code === "string" ? body.referral_code.trim() : "";
    if (!code || code.length > 64 || !/^[A-Za-z0-9_-]+$/.test(code)) {
      return jsonResponse({ error: "Invalid referral code" }, 400);
    }

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // --- Resolve the referrer ------------------------------------------------
    const refResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?referral_code=eq.${encodeURIComponent(code)}&select=id&limit=1`,
      { headers: svc },
    );
    if (!refResp.ok) return jsonResponse({ error: "Could not apply referral" }, 500);
    const referrers = (await refResp.json()) as { id: string }[];
    const referrerId = referrers?.[0]?.id;
    if (!referrerId) return jsonResponse({ error: "Invalid referral code" }, 400);
    if (referrerId === userId) {
      return jsonResponse({ error: "You can't use your own referral code" }, 400);
    }

    // --- Reject double application ------------------------------------------
    const existingResp = await fetch(
      `${supabaseUrl}/rest/v1/referrals?referred_id=eq.${userId}&select=id&limit=1`,
      { headers: svc },
    );
    const existing = existingResp.ok ? ((await existingResp.json()) as unknown[]) : [];
    if (Array.isArray(existing) && existing.length > 0) {
      return jsonResponse({ error: "A referral has already been applied to this account" }, 400);
    }

    // --- Record the referral -------------------------------------------------
    const insertResp = await fetch(`${supabaseUrl}/rest/v1/referrals`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        referrer_id: referrerId,
        referred_id: userId,
        referral_code: code,
        status: "signed_up",
      }),
    });
    if (!insertResp.ok) {
      console.error("apply-referral: insert failed", insertResp.status, await insertResp.text().catch(() => ""));
      return jsonResponse({ error: "Could not apply referral" }, 500);
    }

    // Best-effort: stamp the referred user's profile.
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ referred_by: code }),
    }).catch(() => undefined);

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("apply-referral failed", err);
    return jsonResponse({ error: "Could not apply referral" }, 500);
  }
});
