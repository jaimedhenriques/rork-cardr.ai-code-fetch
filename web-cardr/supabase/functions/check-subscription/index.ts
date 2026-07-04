// check-subscription
//
// Returns the caller's current plan state, matching the client-side zod
// contract in src/lib/subscriptionValidation.ts:
//   { subscribed: boolean, plan?: string|null, product_id?: string|null,
//     subscription_end?: string|null }
// Invariant enforced by the client: subscribed=true requires a paid plan
// AND a valid ISO subscription_end.
//
// Source of truth is the `subscriptions` table (kept up to date by the
// purchase/receipt flows). If a STRIPE_SECRET_KEY secret is added later,
// this function can be extended to live-sync from Stripe first.
//
// Deploy with verify_jwt=false — the function validates the caller's JWT
// itself and safely returns { subscribed: false } for anonymous calls.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PAID_PLANS = new Set(["pro", "business", "teams", "pro_plus"]);
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Parses a loosely formatted timestamp into strict ISO 8601, or null. */
function toIso(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    // Identify the caller from their JWT. Anonymous → not subscribed.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token === anonKey) {
      return jsonResponse({ subscribed: false });
    }

    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userResp.ok) {
      return jsonResponse({ subscribed: false });
    }
    const user = await userResp.json().catch(() => null);
    const userId = typeof user?.id === "string" ? user.id : "";
    if (!userId) {
      return jsonResponse({ subscribed: false });
    }

    // Read the subscription row (service role — RLS-independent).
    const subResp = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}` +
        `&select=plan,status,current_period_end,stripe_subscription_id&order=updated_at.desc&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!subResp.ok) {
      console.error("check-subscription: subscriptions query failed", subResp.status);
      return jsonResponse({ error: "Could not load subscription" }, 500);
    }

    const rows = (await subResp.json()) as Record<string, unknown>[];
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) {
      return jsonResponse({ subscribed: false, plan: "starter" });
    }

    const plan = String(row.plan ?? "starter").toLowerCase();
    const status = String(row.status ?? "").toLowerCase();
    const periodEnd = toIso(row.current_period_end);

    const isPaid = PAID_PLANS.has(plan);
    const isActive = ACTIVE_STATUSES.has(status);
    const notExpired = periodEnd === null || Date.parse(periodEnd) > Date.now();
    const subscribed = isPaid && isActive && notExpired;

    if (!subscribed) {
      return jsonResponse({
        subscribed: false,
        plan: isPaid && isActive ? plan : "starter",
        subscription_end: periodEnd,
      });
    }

    // The client contract requires a renewal date when subscribed. If the
    // stored period end is missing/unparseable, fall back to +30 days so an
    // active paying user is never downgraded by a formatting issue.
    const subscriptionEnd =
      periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return jsonResponse({
      subscribed: true,
      plan,
      product_id: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
      subscription_end: subscriptionEnd,
    });
  } catch (err) {
    console.error("check-subscription failed", err);
    return jsonResponse({ error: "Subscription check failed" }, 500);
  }
});
