// validate-coupon
//
// Validates a promo code against the coupon_codes table.
//
// Request:  { code: string, plan?: string }
// Response: { valid: true, coupon: { code, discount_pct } }
//         | { valid: false, error: string }
//
// Checks: coupon exists, is active, hasn't expired, hasn't hit max_uses, and
// applies to the requested plan (when the coupon restricts plans).
//
// Deploy with verify_jwt=false — pricing page may validate before sign-in.

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
      return jsonResponse({ valid: false, error: "Service not configured" }, 500);
    }

    const body = await req.json().catch(() => null);
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";
    const plan = typeof body?.plan === "string" ? body.plan.trim().toLowerCase() : "";
    if (!rawCode || rawCode.length > 64 || !/^[A-Za-z0-9_-]+$/.test(rawCode)) {
      return jsonResponse({ valid: false, error: "Invalid coupon code" });
    }

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    const couponResp = await fetch(
      `${supabaseUrl}/rest/v1/coupon_codes?code=ilike.${encodeURIComponent(rawCode)}&select=id,code,discount_pct,active,expires_at,max_uses,applies_to&limit=1`,
      { headers: svc },
    );
    if (!couponResp.ok) {
      console.error("validate-coupon: query failed", couponResp.status);
      return jsonResponse({ valid: false, error: "Could not validate coupon" }, 500);
    }
    const coupons = (await couponResp.json()) as {
      id: string;
      code: string;
      discount_pct: number | null;
      active: boolean | null;
      expires_at: string | null;
      max_uses: number | null;
      applies_to: string[] | null;
    }[];
    const coupon = coupons?.[0];
    if (!coupon) return jsonResponse({ valid: false, error: "Coupon not found" });
    if (coupon.active === false) {
      return jsonResponse({ valid: false, error: "This coupon is no longer active" });
    }
    if (coupon.expires_at && Date.parse(coupon.expires_at) < Date.now()) {
      return jsonResponse({ valid: false, error: "This coupon has expired" });
    }
    if (
      plan &&
      Array.isArray(coupon.applies_to) &&
      coupon.applies_to.length > 0 &&
      !coupon.applies_to.map((p) => String(p).toLowerCase()).includes(plan)
    ) {
      return jsonResponse({ valid: false, error: "This coupon doesn't apply to that plan" });
    }

    if (coupon.max_uses != null) {
      const usageResp = await fetch(
        `${supabaseUrl}/rest/v1/coupon_usage?coupon_id=eq.${coupon.id}&select=id`,
        { headers: { ...svc, Prefer: "count=exact", Range: "0-0" } },
      );
      if (usageResp.ok) {
        const range = usageResp.headers.get("content-range") ?? "";
        const total = Number(range.split("/")[1] ?? 0);
        if (Number.isFinite(total) && total >= Number(coupon.max_uses)) {
          return jsonResponse({ valid: false, error: "This coupon has reached its usage limit" });
        }
      }
    }

    return jsonResponse({
      valid: true,
      coupon: { code: coupon.code, discount_pct: Number(coupon.discount_pct ?? 0) },
    });
  } catch (err) {
    console.error("validate-coupon failed", err);
    return jsonResponse({ valid: false, error: "Could not validate coupon" }, 500);
  }
});
