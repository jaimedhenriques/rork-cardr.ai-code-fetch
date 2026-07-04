// track-referral-click
//
// Records an anonymous click on a referral link (/ref/:code). Stores a
// privacy-preserving SHA-256 hash of the visitor IP instead of the raw IP.
//
// Request:  { referral_code: string }
// Response: { success: true } — always succeeds quietly for valid input so
//           the landing page never breaks; invalid codes are ignored.
//
// Deploy with verify_jwt=false — clicks come from signed-out visitors.

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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    const code = typeof body?.referral_code === "string" ? body.referral_code.trim() : "";
    if (!code || code.length > 64 || !/^[A-Za-z0-9_-]+$/.test(code)) {
      // Malformed code — swallow silently so the landing page stays clean.
      return jsonResponse({ success: true });
    }

    // Only count clicks for codes that belong to a real user.
    const ownerResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?referral_code=eq.${encodeURIComponent(code)}&select=id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const owners = ownerResp.ok ? ((await ownerResp.json()) as unknown[]) : [];
    if (!Array.isArray(owners) || owners.length === 0) {
      return jsonResponse({ success: true });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const ipHash = await sha256Hex(`cardr-ref:${ip}`);
    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 400);

    const insertResp = await fetch(`${supabaseUrl}/rest/v1/referral_clicks`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ referral_code: code, ip_hash: ipHash, user_agent: userAgent }),
    });
    if (!insertResp.ok) {
      console.error("track-referral-click: insert failed", insertResp.status);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("track-referral-click failed", err);
    return jsonResponse({ success: true });
  }
});
