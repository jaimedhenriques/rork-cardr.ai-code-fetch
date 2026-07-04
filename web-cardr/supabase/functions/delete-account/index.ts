// delete-account
//
// Permanently deletes the signed-in user's account: every database row they
// own, their uploaded files in storage, and finally the auth user itself.
// Writes an account_deletion_audit row describing what happened.
//
// Request:  { confirm: "DELETE" }  (caller must be signed in)
// Response: { success: true } | { error: string }
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

// Child tables first so foreign keys never block a delete.
// Every table here has a user_id column scoped to the account owner.
const USER_TABLES: string[] = [
  "automation_sequence_messages",
  "automation_sequence_runs",
  "automation_sequence_steps",
  "automation_sequences",
  "webhook_deliveries",
  "webhook_subscriptions",
  "event_contacts",
  "event_files",
  "meeting_participants",
  "contact_activities",
  "scan_artifacts",
  "scan_csv_state",
  "scan_sync_jobs",
  "calendar_events",
  "card_events",
  "agent_runs",
  "agents",
  "proposals",
  "coupon_usage",
  "export_attachment_validations",
  "export_header_suppression_audits",
  "export_schedule_runs",
  "export_schedules",
  "google_calendar_sync",
  "google_calendar_tokens",
  "ios_receipt_validations",
  "notifications",
  "org_members",
  "pipedream_connections",
  "pipedrive_connections",
  "pipedrive_sync_log",
  "pipeline_stages",
  "slack_settings",
  "subscriptions",
  "usage_tracking",
  "user_api_keys",
  "meeting_notes",
  "contacts",
  "events",
  "folders",
  "tags",
];

const BUCKETS = ["avatars", "event-passes", "meeting-attachments", "org-branding"];

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const startedAt = Date.now();

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
    const userEmail = typeof user?.email === "string" ? user.email : "";
    if (!userId) return jsonResponse({ error: "Not authenticated" }, 401);

    // --- Require explicit confirmation ----------------------------------------
    const body = await req.json().catch(() => null);
    if (body?.confirm !== "DELETE") {
      return jsonResponse({ error: "Confirmation required" }, 400);
    }

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const dbErrors: Record<string, string> = {};
    const dbDeleted: Record<string, number> = {};

    // --- Phase: purge database rows -------------------------------------------
    for (const table of USER_TABLES) {
      try {
        const resp = await fetch(
          `${supabaseUrl}/rest/v1/${table}?user_id=eq.${userId}`,
          {
            method: "DELETE",
            headers: { ...svc, Prefer: "return=minimal, count=exact" },
          },
        );
        if (resp.ok) {
          const range = resp.headers.get("content-range") ?? "";
          const total = Number(range.split("/")[1] ?? 0);
          if (Number.isFinite(total) && total > 0) dbDeleted[table] = total;
        } else {
          dbErrors[table] = `HTTP ${resp.status}`;
        }
      } catch {
        dbErrors[table] = "request failed";
      }
    }

    // Referral rows key off referrer/referred, not user_id.
    await fetch(
      `${supabaseUrl}/rest/v1/referral_commissions?referrer_id=eq.${userId}`,
      { method: "DELETE", headers: { ...svc, Prefer: "return=minimal" } },
    ).catch(() => undefined);
    await fetch(
      `${supabaseUrl}/rest/v1/referrals?or=(referrer_id.eq.${userId},referred_id.eq.${userId})`,
      { method: "DELETE", headers: { ...svc, Prefer: "return=minimal" } },
    ).catch(() => undefined);

    // Profile last — other rows may reference it.
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: "DELETE",
      headers: { ...svc, Prefer: "return=minimal" },
    }).catch(() => undefined);

    // --- Phase: remove storage objects -----------------------------------------
    let storageDeleted = 0;
    for (const bucket of BUCKETS) {
      try {
        const listResp = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
          method: "POST",
          headers: { ...svc, "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: `${userId}/`, limit: 1000 }),
        });
        if (!listResp.ok) continue;
        const objects = (await listResp.json()) as { name: string }[];
        const names = (Array.isArray(objects) ? objects : [])
          .map((o) => `${userId}/${o.name}`)
          .filter((n) => n.length > `${userId}/`.length);
        if (names.length === 0) continue;
        const delResp = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
          method: "DELETE",
          headers: { ...svc, "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: names }),
        });
        if (delResp.ok) storageDeleted += names.length;
      } catch {
        // best-effort — never block account deletion on storage cleanup
      }
    }

    // --- Phase: delete the auth user (the irreversible step) --------------------
    const adminResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!adminResp.ok) {
      const detail = await adminResp.text().catch(() => "");
      console.error("delete-account: auth deletion failed", adminResp.status, detail.slice(0, 200));
      await writeAudit(supabaseUrl, svc, {
        user_id: userId,
        email: userEmail,
        phase: "auth",
        status: "failed",
        error_message: `Auth deletion failed (HTTP ${adminResp.status})`,
        db_rows_deleted: dbDeleted,
        db_errors: dbErrors,
        storage_objects_deleted: { count: storageDeleted },
        duration_ms: Date.now() - startedAt,
        user_agent: req.headers.get("user-agent") ?? null,
      });
      return jsonResponse({ error: "Could not fully delete the account — contact support." }, 500);
    }

    await writeAudit(supabaseUrl, svc, {
      user_id: userId,
      email: userEmail,
      phase: "complete",
      status: "success",
      db_rows_deleted: dbDeleted,
      db_errors: Object.keys(dbErrors).length > 0 ? dbErrors : null,
      storage_objects_deleted: { count: storageDeleted },
      duration_ms: Date.now() - startedAt,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("delete-account failed", err);
    return jsonResponse({ error: "Account deletion failed" }, 500);
  }
});

async function writeAudit(
  supabaseUrl: string,
  svc: Record<string, string>,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/account_deletion_audit`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
  } catch {
    // audit is best-effort
  }
}
