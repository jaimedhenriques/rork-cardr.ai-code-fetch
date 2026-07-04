// dispatch-webhook
//
// Fans an app event out to the signed-in user's active webhook subscriptions
// (Zapier / Pipedream / custom endpoints). Each delivery is signed with
// HMAC-SHA256 in the X-Cardr-Signature header when the subscription has a
// secret, logged to webhook_deliveries, and reflected in the subscription's
// last_status / failure_count.
//
// Request:  { event: string, payload: object }
// Response: { delivered: number, failed: number }
//
// Deploy with verify_jwt=false — the function validates the JWT itself.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KNOWN_EVENTS = new Set([
  "note.created",
  "note.updated",
  "note.deleted",
  "contact.created",
  "contact.updated",
  "contact.deleted",
  "follow_up.due",
  "action_item.created",
]);

const DELIVERY_TIMEOUT_MS = 6000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface Subscription {
  id: string;
  url: string;
  provider: string | null;
  secret: string | null;
  failure_count: number | null;
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

    // --- Authenticate ---------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt || jwt === anonKey) return jsonResponse({ error: "Not authenticated" }, 401);
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userResp.ok) return jsonResponse({ error: "Not authenticated" }, 401);
    const user = await userResp.json().catch(() => null);
    const userId = typeof user?.id === "string" ? user.id : "";
    if (!userId) return jsonResponse({ error: "Not authenticated" }, 401);

    // --- Validate input -------------------------------------------------------
    const body = await req.json().catch(() => null);
    const event = typeof body?.event === "string" ? body.event.trim() : "";
    if (!KNOWN_EVENTS.has(event)) return jsonResponse({ error: "Unknown event" }, 400);
    const payload =
      body?.payload && typeof body.payload === "object" ? body.payload : {};

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // --- Find matching subscriptions ------------------------------------------
    const subsResp = await fetch(
      `${supabaseUrl}/rest/v1/webhook_subscriptions?user_id=eq.${userId}&active=is.true&events=cs.{${encodeURIComponent(event)}}&select=id,url,provider,secret,failure_count`,
      { headers: svc },
    );
    if (!subsResp.ok) {
      console.error("dispatch-webhook: subscriptions query failed", subsResp.status);
      return jsonResponse({ error: "Could not load webhooks" }, 500);
    }
    const subs = (await subsResp.json()) as Subscription[];
    if (!Array.isArray(subs) || subs.length === 0) {
      return jsonResponse({ delivered: 0, failed: 0 });
    }

    const deliveredAt = new Date().toISOString();
    const outBody = JSON.stringify({ event, payload, timestamp: deliveredAt, source: "cardr" });

    let delivered = 0;
    let failed = 0;

    await Promise.all(
      subs.map(async (sub) => {
        if (!sub.url || !sub.url.startsWith("https://")) {
          failed++;
          return;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Cardr-Event": event,
          "User-Agent": "Cardr-Webhooks/1.0",
        };
        if (sub.secret) {
          headers["X-Cardr-Signature"] = await hmacSha256Hex(sub.secret, outBody);
        }

        let statusCode: number | null = null;
        let errorMsg: string | null = null;
        let responseBody: string | null = null;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
          const resp = await fetch(sub.url, {
            method: "POST",
            headers,
            body: outBody,
            signal: controller.signal,
          });
          clearTimeout(timer);
          statusCode = resp.status;
          responseBody = (await resp.text().catch(() => "")).slice(0, 500);
          if (resp.ok) delivered++;
          else {
            failed++;
            errorMsg = `HTTP ${resp.status}`;
          }
        } catch (e) {
          failed++;
          errorMsg = e instanceof Error && e.name === "AbortError" ? "Timed out" : "Connection failed";
        }

        const succeeded = errorMsg === null;

        // Log the delivery + update subscription health (best-effort).
        await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/webhook_deliveries`, {
            method: "POST",
            headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({
              subscription_id: sub.id,
              user_id: userId,
              event,
              payload,
              status_code: statusCode,
              error: errorMsg,
              response_body: responseBody,
              delivered_at: deliveredAt,
            }),
          }).catch(() => undefined),
          fetch(`${supabaseUrl}/rest/v1/webhook_subscriptions?id=eq.${sub.id}`, {
            method: "PATCH",
            headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({
              last_delivery_at: deliveredAt,
              last_status: succeeded ? "success" : "failed",
              failure_count: succeeded ? 0 : Number(sub.failure_count ?? 0) + 1,
            }),
          }).catch(() => undefined),
        ]);
      }),
    );

    return jsonResponse({ delivered, failed });
  } catch (err) {
    console.error("dispatch-webhook failed", err);
    return jsonResponse({ error: "Webhook dispatch failed" }, 500);
  }
});
