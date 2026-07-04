// send-org-invitation
//
// Creates an org invitation for the given email and sends the invite email
// through Resend. Caller must be an owner/admin member of the org.
//
// Request:  { email: string, role: "admin" | "member", orgId: string }
// Response: { invitation: {...}, emailSent: boolean } | { error: string }
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

const APP_URL = "https://rork-cardr.ai-code-fetch.rork.app";
const ALLOWED_ROLES = new Set(["admin", "member"]);
const INVITER_ROLES = new Set(["owner", "admin"]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM") || "cardr <onboarding@resend.dev>";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    // --- Authenticate ---------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt || jwt === anonKey) return jsonResponse({ error: "Sign in to invite members" }, 401);
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userResp.ok) return jsonResponse({ error: "Sign in to invite members" }, 401);
    const user = await userResp.json().catch(() => null);
    const userId = typeof user?.id === "string" ? user.id : "";
    const userEmail = typeof user?.email === "string" ? user.email : "";
    if (!userId) return jsonResponse({ error: "Sign in to invite members" }, 401);

    // --- Validate body --------------------------------------------------------
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body?.role === "string" ? body.role.trim().toLowerCase() : "";
    const orgId = typeof body?.orgId === "string" ? body.orgId.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Valid email is required" }, 400);
    }
    if (!ALLOWED_ROLES.has(role)) return jsonResponse({ error: "Invalid role" }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(orgId)) return jsonResponse({ error: "Invalid organization" }, 400);

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // --- Verify caller is org owner/admin --------------------------------------
    const memberResp = await fetch(
      `${supabaseUrl}/rest/v1/org_members?org_id=eq.${orgId}&user_id=eq.${userId}&select=role&limit=1`,
      { headers: svc },
    );
    const memberRows = memberResp.ok ? ((await memberResp.json()) as { role: string }[]) : [];
    const callerRole = String(memberRows?.[0]?.role ?? "").toLowerCase();
    if (!INVITER_ROLES.has(callerRole)) {
      return jsonResponse({ error: "Only org owners and admins can invite members" }, 403);
    }

    // --- Load org name ----------------------------------------------------------
    const orgResp = await fetch(
      `${supabaseUrl}/rest/v1/organizations?id=eq.${orgId}&select=name,max_seats&limit=1`,
      { headers: svc },
    );
    const orgRows = orgResp.ok
      ? ((await orgResp.json()) as { name: string; max_seats: number | null }[])
      : [];
    const org = orgRows?.[0];
    if (!org) return jsonResponse({ error: "Organization not found" }, 404);

    // --- Seat limit check -------------------------------------------------------
    if (org.max_seats != null) {
      const countResp = await fetch(
        `${supabaseUrl}/rest/v1/org_members?org_id=eq.${orgId}&select=id`,
        { headers: { ...svc, Prefer: "count=exact", Range: "0-0" } },
      );
      const total = Number(
        (countResp.headers.get("content-range") || "").split("/")[1] || "0",
      );
      if (total >= Number(org.max_seats)) {
        return jsonResponse({ error: "All seats are taken. Increase seats to invite more members." }, 400);
      }
    }

    // --- Create or refresh the invitation --------------------------------------
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const existingResp = await fetch(
      `${supabaseUrl}/rest/v1/org_invitations?org_id=eq.${orgId}&email=eq.${encodeURIComponent(email)}&accepted_at=is.null&select=id&limit=1`,
      { headers: svc },
    );
    const existingRows = existingResp.ok ? ((await existingResp.json()) as { id: string }[]) : [];

    let invitation: Record<string, unknown> | null = null;
    if (existingRows.length > 0) {
      const patchResp = await fetch(
        `${supabaseUrl}/rest/v1/org_invitations?id=eq.${existingRows[0].id}`,
        {
          method: "PATCH",
          headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ role, token, expires_at: expiresAt, invited_by: userEmail }),
        },
      );
      const rows = patchResp.ok ? ((await patchResp.json()) as Record<string, unknown>[]) : [];
      invitation = rows?.[0] ?? null;
    } else {
      const insertResp = await fetch(`${supabaseUrl}/rest/v1/org_invitations`, {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          org_id: orgId,
          email,
          role,
          token,
          expires_at: expiresAt,
          invited_by: userEmail,
        }),
      });
      const rows = insertResp.ok ? ((await insertResp.json()) as Record<string, unknown>[]) : [];
      invitation = rows?.[0] ?? null;
    }
    if (!invitation) return jsonResponse({ error: "Could not create the invitation" }, 500);

    // --- Send the invite email ---------------------------------------------------
    let emailSent = false;
    if (resendKey) {
      const joinUrl = `${APP_URL}/join/${token}`;
      const orgName = escapeHtml(org.name || "an organization");
      const inviter = escapeHtml(userEmail || "A teammate");
      const html = `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827;">
          <h2 style="font-size:18px;margin:0 0 4px;">cardr</h2>
          <p style="font-size:15px;line-height:1.6;">${inviter} invited you to join <strong>${orgName}</strong> on cardr as a <strong>${escapeHtml(role)}</strong>.</p>
          <p style="margin:24px 0;">
            <a href="${joinUrl}" style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;display:inline-block;">Accept invitation</a>
          </p>
          <p style="font-size:13px;color:#6b7280;line-height:1.6;">Or paste this link into your browser:<br /><a href="${joinUrl}" style="color:#2563eb;">${joinUrl}</a></p>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px;">This invitation expires in 7 days.</p>
        </div>`;
      const sendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject: `You're invited to join ${org.name || "a team"} on cardr`,
          html,
        }),
      });
      if (sendResp.ok) {
        emailSent = true;
      } else {
        console.error(
          "send-org-invitation: Resend error",
          sendResp.status,
          await sendResp.text().catch(() => ""),
        );
      }
    }

    return jsonResponse({ invitation, emailSent });
  } catch (err) {
    console.error("send-org-invitation failed", err);
    return jsonResponse({ error: "Could not send the invitation" }, 500);
  }
});
