// reviewer-demo-bootstrap
//
// Creates (or resets) the shared App Reviewer demo account and seeds it with
// realistic demo data (profile, contacts, an event, a meeting note) so App
// Store reviewers and prospects can explore the app without signing up.
//
// Request:  POST {} (no auth required — deploy with verify_jwt=false)
// Response: { email: string, password: string } | { error: string }
//
// The password is intentionally fixed and documented in App Review notes.
// The account only ever contains seeded demo data.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_EMAIL = "reviewer@cardr.ai";
const DEMO_PASSWORD = "CardrReview!2026";

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
    const svc: Record<string, string> = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // --- Ensure the demo auth user exists with the known password -------------
    let userId = "";
    const createResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: svc,
      body: JSON.stringify({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: "App Reviewer" },
      }),
    });

    if (createResp.ok) {
      const created = await createResp.json().catch(() => null);
      userId = typeof created?.id === "string" ? created.id : "";
    } else {
      // User already exists — find it and reset the password + confirmation.
      const listResp = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(DEMO_EMAIL)}`,
        { headers: svc },
      );
      if (!listResp.ok) {
        return jsonResponse({ error: "Could not look up demo account" }, 500);
      }
      const listBody = await listResp.json().catch(() => null);
      const users: { id?: string; email?: string }[] = Array.isArray(listBody?.users)
        ? listBody.users
        : Array.isArray(listBody)
          ? listBody
          : [];
      const match = users.find(
        (u) => (u.email ?? "").toLowerCase() === DEMO_EMAIL,
      );
      userId = typeof match?.id === "string" ? match.id : "";
      if (!userId) {
        return jsonResponse({ error: "Demo account could not be created" }, 500);
      }
      const resetResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers: svc,
        body: JSON.stringify({ password: DEMO_PASSWORD, email_confirm: true }),
      });
      if (!resetResp.ok) {
        const detail = await resetResp.text().catch(() => "");
        console.error("reviewer-demo: password reset failed", resetResp.status, detail.slice(0, 200));
        return jsonResponse({ error: "Could not reset demo account" }, 500);
      }
    }

    if (!userId) return jsonResponse({ error: "Demo account unavailable" }, 500);

    // --- Profile (upsert) ------------------------------------------------------
    await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: { ...svc, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: userId,
        email: DEMO_EMAIL,
        name: "Riley Parker",
        title: "Head of Partnerships",
        company: "Cardr Demo Co.",
        phone: "+1 (555) 010-2026",
        website: "https://cardr.ai",
      }),
    }).catch(() => undefined);

    // --- Seed demo data only once ----------------------------------------------
    const existing = await fetch(
      `${supabaseUrl}/rest/v1/contacts?user_id=eq.${userId}&select=id&limit=1`,
      { headers: svc },
    );
    const existingRows = existing.ok ? await existing.json().catch(() => []) : [];
    if (!Array.isArray(existingRows) || existingRows.length === 0) {
      await seedDemoData(supabaseUrl, svc, userId);
    }

    return jsonResponse({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  } catch (err) {
    console.error("reviewer-demo-bootstrap failed", err);
    return jsonResponse({ error: "Could not prepare demo account" }, 500);
  }
});

async function seedDemoData(
  supabaseUrl: string,
  svc: Record<string, string>,
  userId: string,
): Promise<void> {
  const insert = (table: string, rows: unknown) =>
    fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...svc, Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    }).catch(() => undefined);

  const today = new Date();
  const iso = (daysFromNow: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().slice(0, 10);
  };

  // NOTE: PostgREST bulk inserts require every row to have identical keys,
  // so each contact goes through this factory that fills gaps with null.
  const contact = (row: Record<string, unknown>): Record<string, unknown> => ({
    user_id: userId,
    name: null,
    title: null,
    company: null,
    email: null,
    phone: null,
    industry: null,
    location: null,
    lead_source: null,
    conversation_status: null,
    next_step: null,
    next_action_date: null,
    notes: null,
    enriched: false,
    ...row,
  });

  await insert("contacts", [
    contact({
      name: "Maya Chen",
      title: "VP of Sales",
      company: "Northwind Labs",
      email: "maya.chen@northwindlabs.example",
      phone: "+1 (555) 014-8823",
      industry: "SaaS",
      location: "San Francisco, CA",
      lead_source: "Badge scan — SaaStr Annual",
      conversation_status: "warm",
      next_step: "Send pilot proposal",
      next_action_date: iso(3),
      notes: "Met at SaaStr booth. Interested in team plan for her 12-person sales org.",
      enriched: true,
    }),
    contact({
      name: "Diego Alvarez",
      title: "Founder & CEO",
      company: "Brightpath AI",
      email: "diego@brightpath.example",
      industry: "Artificial Intelligence",
      location: "Austin, TX",
      lead_source: "Business card scan",
      conversation_status: "hot",
      next_step: "Intro call scheduled",
      next_action_date: iso(1),
      notes: "Wants to compare against Granola for internal meeting notes.",
      enriched: true,
    }),
    contact({
      name: "Priya Raman",
      title: "Partnerships Lead",
      company: "Meridian Group",
      email: "priya.r@meridiangroup.example",
      phone: "+1 (555) 019-3321",
      industry: "Consulting",
      location: "New York, NY",
      lead_source: "QR code exchange",
      conversation_status: "warm",
      notes: "Asked for enterprise pricing and SSO details.",
    }),
    contact({
      name: "Tom Okafor",
      title: "Head of RevOps",
      company: "Cascade Systems",
      email: "tokafor@cascade.example",
      industry: "Enterprise Software",
      location: "Seattle, WA",
      lead_source: "Referral",
      conversation_status: "new",
      notes: "Referred by Maya Chen. Evaluating CRM sync options.",
    }),
  ]);

  await insert("events", {
    user_id: userId,
    title: "SaaStr Annual 2026",
    description: "Flagship SaaS conference — booth #214, focus on team-plan leads.",
    location: "San Francisco, CA",
    start_date: iso(-2),
    end_date: iso(-1),
    event_type: "conference",
    status: "completed",
  });

  await insert("meeting_notes", {
    user_id: userId,
    title: "Discovery call — Northwind Labs pilot",
    category: "sales-call",
    duration_seconds: 1560,
    summary:
      "Maya's 12-person sales team loses roughly two hours a day to manual meeting recaps and CRM data entry. She wants a 30-day pilot with five reps, with success measured by follow-up speed and CRM hygiene. Budget is approved for a team plan if the pilot converts at least three reps into daily active users.",
    key_topics: ["Pilot scope", "CRM sync", "Meeting notes automation", "Pricing"],
    action_items: [
      { task: "Send pilot proposal with team-plan pricing", owner: "Riley", deadline: iso(3), done: false, priority: "high" },
      { task: "Set up sandbox workspace for Northwind reps", owner: "Riley", deadline: iso(5), done: false, priority: "medium" },
      { task: "Share security & data-retention one-pager", owner: "Riley", deadline: iso(2), done: true, priority: "high" },
    ],
    follow_ups: [
      { description: "Check in after the first pilot week", with: "Maya Chen", urgency: "medium" },
    ],
    decisions: [
      "Pilot starts with five reps for 30 days",
      "Success metric: 3+ daily active reps by week four",
    ],
    insights: [
      "Manual recap time is the strongest pain point — lead with the AI notetaker",
      "HubSpot sync is a must-have for the wider rollout",
    ],
    mentioned_people: [
      { name: "Maya Chen", role: "VP of Sales", context: "Pilot sponsor" },
      { name: "Tom Okafor", role: "Head of RevOps", context: "Owns the CRM integration decision" },
    ],
    open_questions: ["Does the team plan include SSO?", "Can transcripts be exported to HubSpot notes?"],
    manual_notes: "Maya: 12 reps, ~2h/day lost to recaps. Wants pilot. Budget OK. Needs HubSpot sync + SSO answer.",
  });
}
