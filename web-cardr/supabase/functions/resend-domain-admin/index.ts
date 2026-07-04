// resend-domain-admin
//
// Platform-admin-only proxy to the Resend Domains API, backing the
// /app/admin/email-sender page.
//
// Request:  { action: "list" | "get" | "create" | "verify" | "remove" | "current_from", ...payload }
// Responses:
//   list         → { domains: Domain[] }
//   get          → { domain: Domain }        (includes DNS records)
//   create       → { domain: Domain }
//   verify       → { success: true }
//   remove       → { success: true }
//   current_from → { value: string, configured: boolean, fallback: string | null }
// Errors: { error: string, code?: "no_resend_connection" }
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

const FALLBACK_FROM = "onboarding@resend.dev";

async function resendFetch(
  key: string,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const resp = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    // --- Authenticate + platform-admin check -----------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt || jwt === anonKey) return jsonResponse({ error: "Unauthorized" }, 401);
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userResp.ok) return jsonResponse({ error: "Unauthorized" }, 401);
    const user = await userResp.json().catch(() => null);
    const userId = typeof user?.id === "string" ? user.id : "";
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const adminResp = await fetch(
      `${supabaseUrl}/rest/v1/platform_admins?user_id=eq.${userId}&select=id&limit=1`,
      { headers: svc },
    );
    const admins = adminResp.ok ? ((await adminResp.json()) as unknown[]) : [];
    if (!Array.isArray(admins) || admins.length === 0) {
      return jsonResponse({ error: "Platform admin only" }, 403);
    }

    // --- Parse action -----------------------------------------------------------
    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "current_from") {
      return jsonResponse({
        value: resendFrom,
        configured: Boolean(resendFrom),
        fallback: resendFrom ? null : FALLBACK_FROM,
      });
    }

    if (!resendKey) {
      return jsonResponse({ error: "Resend is not connected", code: "no_resend_connection" }, 400);
    }

    switch (action) {
      case "list": {
        const { ok, data } = await resendFetch(resendKey, "/domains");
        if (!ok) return jsonResponse({ error: (data as { message?: string })?.message || "Couldn't list domains" }, 502);
        const domains = Array.isArray((data as { data?: unknown[] })?.data)
          ? (data as { data: unknown[] }).data
          : [];
        return jsonResponse({ domains });
      }
      case "get": {
        const id = typeof body?.id === "string" ? body.id.trim() : "";
        if (!id) return jsonResponse({ error: "id is required" }, 400);
        const { ok, data } = await resendFetch(resendKey, `/domains/${encodeURIComponent(id)}`);
        if (!ok) return jsonResponse({ error: (data as { message?: string })?.message || "Couldn't load domain" }, 502);
        return jsonResponse({ domain: data });
      }
      case "create": {
        const name = typeof body?.name === "string" ? body.name.trim().toLowerCase() : "";
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) {
          return jsonResponse({ error: "Enter a valid domain" }, 400);
        }
        const { ok, data } = await resendFetch(resendKey, "/domains", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        if (!ok) return jsonResponse({ error: (data as { message?: string })?.message || "Couldn't add domain" }, 502);
        return jsonResponse({ domain: data });
      }
      case "verify": {
        const id = typeof body?.id === "string" ? body.id.trim() : "";
        if (!id) return jsonResponse({ error: "id is required" }, 400);
        const { ok, data } = await resendFetch(
          resendKey,
          `/domains/${encodeURIComponent(id)}/verify`,
          { method: "POST" },
        );
        if (!ok) return jsonResponse({ error: (data as { message?: string })?.message || "Verification failed" }, 502);
        return jsonResponse({ success: true });
      }
      case "remove": {
        const id = typeof body?.id === "string" ? body.id.trim() : "";
        if (!id) return jsonResponse({ error: "id is required" }, 400);
        const { ok, data } = await resendFetch(
          resendKey,
          `/domains/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        if (!ok) return jsonResponse({ error: (data as { message?: string })?.message || "Couldn't remove domain" }, 502);
        return jsonResponse({ success: true });
      }
      default:
        return jsonResponse({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (err) {
    console.error("resend-domain-admin failed", err);
    return jsonResponse({ error: "Request failed" }, 500);
  }
});
