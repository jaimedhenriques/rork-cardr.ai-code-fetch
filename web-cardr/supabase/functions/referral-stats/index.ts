// referral-stats
//
// Returns the signed-in user's referral dashboard data, matching the
// ReferralStats interface in src/hooks/useReferral.ts:
//   { referral_code, referral_link, total_clicks, total_signups,
//     active_subscribers, total_credits_earned_cents,
//     available_credits_cents, applied_credits_cents,
//     credit_history: [{ amount_cents, applied_at }] }
//
// Auth errors use stable codes (AUTH_MISSING_HEADER / AUTH_TOKEN_INVALID) that
// the client's isAuthError() helper recognizes.
// Lazily generates and saves a referral code the first time a user asks.
//
// Deploy with verify_jwt=false — the function validates the JWT itself.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-referral-stats-log-mode",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** 8-char, unambiguous, URL-safe referral code. */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const logMode = req.headers.get("x-referral-stats-log-mode") ?? "normal";
  const verbose = logMode === "verbose";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    // --- Authenticate ---------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token === anonKey) {
      return jsonResponse({ error: "Not authenticated", code: "AUTH_MISSING_HEADER" }, 401);
    }
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userResp.ok) {
      const code = userResp.status === 401 ? "AUTH_TOKEN_EXPIRED" : "AUTH_TOKEN_INVALID";
      return jsonResponse({ error: "Not authenticated", code }, 401);
    }
    const user = await userResp.json().catch(() => null);
    const userId = typeof user?.id === "string" ? user.id : "";
    if (!userId) {
      return jsonResponse({ error: "Not authenticated", code: "AUTH_TOKEN_INVALID" }, 401);
    }

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // --- Ensure the user has a referral code ---------------------------------
    const profResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=referral_code&limit=1`,
      { headers: svc },
    );
    if (!profResp.ok) return jsonResponse({ error: "Could not load profile" }, 500);
    const profiles = (await profResp.json()) as { referral_code: string | null }[];
    let code = profiles?.[0]?.referral_code ?? null;

    if (!code) {
      // Generate with a couple of retries in case of a (very unlikely) collision.
      for (let attempt = 0; attempt < 3 && !code; attempt++) {
        const candidate = generateCode();
        const patchResp = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ referral_code: candidate }),
        });
        if (patchResp.ok) code = candidate;
      }
      if (!code) return jsonResponse({ error: "Could not create referral code" }, 500);
      if (verbose) console.log("referral-stats: generated code for", userId);
    }

    // --- Gather stats ---------------------------------------------------------
    const [clicksResp, referralsResp, commissionsResp] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/referral_clicks?referral_code=eq.${encodeURIComponent(code)}&select=id`,
        { headers: { ...svc, Prefer: "count=exact", Range: "0-0" } },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/referrals?referrer_id=eq.${userId}&select=id,referred_id,status`,
        { headers: svc },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/referral_commissions?referrer_id=eq.${userId}&select=amount_cents,status,paid_at,created_at&order=created_at.desc`,
        { headers: svc },
      ),
    ]);

    let totalClicks = 0;
    if (clicksResp.ok) {
      const range = clicksResp.headers.get("content-range") ?? "";
      const total = range.split("/")[1];
      totalClicks = total && total !== "*" ? Number(total) : 0;
    }

    const referrals = referralsResp.ok
      ? ((await referralsResp.json()) as { referred_id: string; status: string }[])
      : [];
    const totalSignups = referrals.length;

    // Active subscribers = referred users with a currently active subscription.
    let activeSubscribers = 0;
    const referredIds = referrals.map((r) => r.referred_id).filter(Boolean);
    if (referredIds.length > 0) {
      const idList = referredIds.slice(0, 500).join(",");
      const subsResp = await fetch(
        `${supabaseUrl}/rest/v1/subscriptions?user_id=in.(${idList})&status=in.(active,trialing)&select=user_id`,
        { headers: svc },
      );
      if (subsResp.ok) {
        const rows = (await subsResp.json()) as { user_id: string }[];
        activeSubscribers = new Set(rows.map((r) => r.user_id)).size;
      }
    }

    const commissions = commissionsResp.ok
      ? ((await commissionsResp.json()) as {
          amount_cents: number | null;
          status: string | null;
          paid_at: string | null;
          created_at: string;
        }[])
      : [];

    let earned = 0;
    let applied = 0;
    const history: { amount_cents: number; applied_at: string }[] = [];
    for (const c of commissions) {
      const amount = Number(c.amount_cents ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (c.status === "flagged") continue;
      earned += amount;
      if (c.status === "paid" || c.paid_at) {
        applied += amount;
        history.push({ amount_cents: amount, applied_at: c.paid_at ?? c.created_at });
      }
    }

    const origin = req.headers.get("origin") || "https://cardr.ai";

    return jsonResponse({
      referral_code: code,
      referral_link: `${origin.replace(/\/$/, "")}/ref/${code}`,
      total_clicks: totalClicks,
      total_signups: totalSignups,
      active_subscribers: activeSubscribers,
      total_credits_earned_cents: earned,
      available_credits_cents: Math.max(0, earned - applied),
      applied_credits_cents: applied,
      credit_history: history,
    });
  } catch (err) {
    console.error("referral-stats failed", err);
    return jsonResponse({ error: "Could not load referral stats" }, 500);
  }
});
