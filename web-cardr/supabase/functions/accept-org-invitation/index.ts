// accept-org-invitation
//
// Accepts an organization invitation (from /join/:token) for the signed-in
// user: validates the token, checks expiry and email match, adds the caller to
// org_members, and stamps accepted_at on the invitation.
//
// Request:  { token: string }
// Response: { success: true, org_id: string } | { error: string }
//
// Deploy with verify_jwt=false — the function validates the JWT itself.

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

const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "member", "viewer"]);

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

    // --- Authenticate ---------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt || jwt === anonKey) {
      return jsonResponse({ error: "Sign in to accept this invitation" }, 401);
    }
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userResp.ok) return jsonResponse({ error: "Sign in to accept this invitation" }, 401);
    const user = await userResp.json().catch(() => null);
    const userId = typeof user?.id === "string" ? user.id : "";
    const userEmail = typeof user?.email === "string" ? user.email.toLowerCase() : "";
    if (!userId) return jsonResponse({ error: "Sign in to accept this invitation" }, 401);

    // --- Validate token -------------------------------------------------------
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return jsonResponse({ error: "Invalid invitation" }, 400);
    }

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    const invResp = await fetch(
      `${supabaseUrl}/rest/v1/org_invitations?token=eq.${encodeURIComponent(token)}&select=id,org_id,email,role,expires_at,accepted_at&limit=1`,
      { headers: svc },
    );
    if (!invResp.ok) return jsonResponse({ error: "Could not load invitation" }, 500);
    const invitations = (await invResp.json()) as {
      id: string;
      org_id: string;
      email: string | null;
      role: string | null;
      expires_at: string | null;
      accepted_at: string | null;
    }[];
    const inv = invitations?.[0];
    if (!inv) return jsonResponse({ error: "Invalid invitation" }, 400);
    if (inv.accepted_at) return jsonResponse({ error: "This invitation has already been used" }, 400);
    if (inv.expires_at && Date.parse(inv.expires_at) < Date.now()) {
      return jsonResponse({ error: "This invitation has expired" }, 400);
    }
    if (inv.email && userEmail && inv.email.toLowerCase() !== userEmail) {
      return jsonResponse(
        { error: "This invitation was sent to a different email address" },
        403,
      );
    }

    // --- Add to org (idempotent) ----------------------------------------------
    const memberResp = await fetch(
      `${supabaseUrl}/rest/v1/org_members?org_id=eq.${inv.org_id}&user_id=eq.${userId}&select=id&limit=1`,
      { headers: svc },
    );
    const existing = memberResp.ok ? ((await memberResp.json()) as unknown[]) : [];
    if (!Array.isArray(existing) || existing.length === 0) {
      const role = ALLOWED_ROLES.has(String(inv.role ?? "").toLowerCase())
        ? String(inv.role).toLowerCase()
        : "member";
      const insertResp = await fetch(`${supabaseUrl}/rest/v1/org_members`, {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          org_id: inv.org_id,
          user_id: userId,
          role,
          joined_at: new Date().toISOString(),
        }),
      });
      if (!insertResp.ok) {
        console.error(
          "accept-org-invitation: member insert failed",
          insertResp.status,
          await insertResp.text().catch(() => ""),
        );
        return jsonResponse({ error: "Could not join the organization" }, 500);
      }
    }

    // --- Mark invitation accepted ---------------------------------------------
    await fetch(`${supabaseUrl}/rest/v1/org_invitations?id=eq.${inv.id}`, {
      method: "PATCH",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ accepted_at: new Date().toISOString() }),
    }).catch(() => undefined);

    return jsonResponse({ success: true, org_id: inv.org_id });
  } catch (err) {
    console.error("accept-org-invitation failed", err);
    return jsonResponse({ error: "Could not accept invitation" }, 500);
  }
});
