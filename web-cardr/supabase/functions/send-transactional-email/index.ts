// send-transactional-email
//
// Sends templated transactional emails via Resend, with idempotency and
// unsubscribe handling.
//
// Request:  { templateName: string, recipientEmail: string,
//             idempotencyKey?: string, templateData?: Record<string, unknown> }
// Response: { success: true, id?: string, skipped?: string } | { error: string }
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

interface RenderedEmail {
  subject: string;
  html: string;
}

function renderTemplate(
  templateName: string,
  data: Record<string, unknown>,
  unsubscribeUrl: string,
): RenderedEmail | null {
  const footer = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      <p>Sent by cardr — smart contact capture.</p>
      <p><a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a> from these emails.</p>
    </div>`;
  const wrap = (inner: string) =>
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827;">
      <h2 style="font-size:18px;margin:0 0 4px;">cardr</h2>
      ${inner}${footer}
    </div>`;

  const name = typeof data.name === "string" && data.name.trim()
    ? escapeHtml(data.name.trim())
    : "";

  switch (templateName) {
    case "contact-confirmation":
      return {
        subject: "Great connecting with you",
        html: wrap(`
          <p style="font-size:15px;">Hi${name ? ` ${name}` : ""},</p>
          <p style="font-size:15px;line-height:1.6;">It was great connecting with you! Your contact details were saved${name ? "" : " with us"} so we can stay in touch.</p>
          <p style="font-size:15px;line-height:1.6;">Looking forward to speaking again soon.</p>`),
      };
    case "welcome":
      return {
        subject: "Welcome to cardr",
        html: wrap(`
          <p style="font-size:15px;">Hi${name ? ` ${name}` : ""},</p>
          <p style="font-size:15px;line-height:1.6;">Welcome to cardr — scan badges and business cards, capture meeting notes, and let AI keep your network warm.</p>
          <p style="font-size:15px;line-height:1.6;"><a href="${APP_URL}/app" style="color:#2563eb;">Open cardr</a> to get started.</p>`),
      };
    default:
      return null;
  }
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
    if (!resendKey) return jsonResponse({ error: "Email is not configured" }, 500);

    // --- Authenticate (signed-in users only) ---------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt || jwt === anonKey) return jsonResponse({ error: "Unauthorized" }, 401);
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userResp.ok) return jsonResponse({ error: "Unauthorized" }, 401);

    // --- Validate body --------------------------------------------------------
    const body = await req.json().catch(() => null);
    const templateName = typeof body?.templateName === "string" ? body.templateName.trim() : "";
    const recipientEmail = typeof body?.recipientEmail === "string"
      ? body.recipientEmail.trim().toLowerCase()
      : "";
    const idempotencyKey = typeof body?.idempotencyKey === "string"
      ? body.idempotencyKey.trim().slice(0, 200)
      : "";
    const templateData: Record<string, unknown> =
      body?.templateData && typeof body.templateData === "object" ? body.templateData : {};

    if (!templateName) return jsonResponse({ error: "templateName is required" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return jsonResponse({ error: "Valid recipientEmail is required" }, 400);
    }

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // --- Idempotency ----------------------------------------------------------
    if (idempotencyKey) {
      const dupResp = await fetch(
        `${supabaseUrl}/rest/v1/transactional_emails?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id&limit=1`,
        { headers: svc },
      );
      const dup = dupResp.ok ? ((await dupResp.json()) as unknown[]) : [];
      if (Array.isArray(dup) && dup.length > 0) {
        return jsonResponse({ success: true, skipped: "duplicate" });
      }
    }

    // --- Unsubscribe check + token --------------------------------------------
    const unsubResp = await fetch(
      `${supabaseUrl}/rest/v1/email_unsubscribes?email=eq.${encodeURIComponent(recipientEmail)}&select=token,unsubscribed_at&limit=1`,
      { headers: svc },
    );
    const unsubRows = unsubResp.ok
      ? ((await unsubResp.json()) as { token: string; unsubscribed_at: string | null }[])
      : [];
    let unsubToken = unsubRows?.[0]?.token ?? "";
    if (unsubRows?.[0]?.unsubscribed_at) {
      return jsonResponse({ success: true, skipped: "unsubscribed" });
    }
    if (!unsubToken) {
      unsubToken = crypto.randomUUID().replace(/-/g, "") +
        crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const insertResp = await fetch(`${supabaseUrl}/rest/v1/email_unsubscribes`, {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ email: recipientEmail, token: unsubToken }),
      });
      if (!insertResp.ok) {
        // Race: another send created it — re-read
        const retry = await fetch(
          `${supabaseUrl}/rest/v1/email_unsubscribes?email=eq.${encodeURIComponent(recipientEmail)}&select=token&limit=1`,
          { headers: svc },
        );
        const rows = retry.ok ? ((await retry.json()) as { token: string }[]) : [];
        unsubToken = rows?.[0]?.token ?? unsubToken;
      }
    }

    const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${unsubToken}`;
    const rendered = renderTemplate(templateName, templateData, unsubscribeUrl);
    if (!rendered) return jsonResponse({ error: `Unknown template: ${templateName}` }, 400);

    // --- Send via Resend --------------------------------------------------------
    const sendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: resendFrom,
        to: [recipientEmail],
        subject: rendered.subject,
        html: rendered.html,
      }),
    });
    const sendData = await sendResp.json().catch(() => null);
    if (!sendResp.ok) {
      console.error("send-transactional-email: Resend error", sendResp.status, JSON.stringify(sendData));
      return jsonResponse({ error: sendData?.message || "Email send failed" }, 502);
    }
    const resendId = typeof sendData?.id === "string" ? sendData.id : null;

    // --- Log -------------------------------------------------------------------
    await fetch(`${supabaseUrl}/rest/v1/transactional_emails`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        idempotency_key: idempotencyKey || null,
        template_name: templateName,
        recipient_email: recipientEmail,
        resend_id: resendId,
        status: "sent",
      }),
    }).catch(() => undefined);

    return jsonResponse({ success: true, id: resendId });
  } catch (err) {
    console.error("send-transactional-email failed", err);
    return jsonResponse({ error: "Could not send email" }, 500);
  }
});
