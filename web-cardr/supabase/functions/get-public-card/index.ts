// get-public-card
//
// Public (unauthenticated) lookup of a shared digital business card by slug.
//
// Request:  { slug: string }
// Response: { profile: { name, title, company, email, phone, website,
//             linkedin, avatar, card_slug } }
//           or 404 { error: "Card not found" }
//
// Deploy with verify_jwt=false (this endpoint is intentionally public).
// Uses the service-role key server-side to bypass RLS for the single
// whitelisted set of card fields — nothing else is exposed.

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
      return jsonResponse({ error: "Service not configured" }, 500);
    }

    const body = await req.json().catch(() => null);
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    if (!slug || slug.length > 200) {
      return jsonResponse({ error: "Invalid slug" }, 400);
    }

    const fields = "name,title,company,email,phone,website,linkedin,avatar,card_slug";
    const url = `${supabaseUrl}/rest/v1/profiles?card_slug=eq.${encodeURIComponent(slug)}&select=${fields}&limit=1`;
    const resp = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!resp.ok) {
      console.error("get-public-card: profiles query failed", resp.status);
      return jsonResponse({ error: "Lookup failed" }, 500);
    }

    const rows = (await resp.json()) as Record<string, unknown>[];
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row || !row.name) {
      return jsonResponse({ error: "Card not found" }, 404);
    }

    return jsonResponse({
      profile: {
        name: row.name ?? "",
        title: row.title ?? "",
        company: row.company ?? "",
        email: row.email ?? "",
        phone: row.phone ?? "",
        website: row.website ?? "",
        linkedin: row.linkedin ?? "",
        avatar: row.avatar ?? null,
        card_slug: row.card_slug ?? slug,
      },
    });
  } catch (err) {
    console.error("get-public-card failed", err);
    return jsonResponse({ error: "Lookup failed" }, 500);
  }
});
