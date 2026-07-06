// team-analytics
//
// Org-level meeting analytics for team members. Aggregates every org member's
// meeting_notes into privacy-safe stats: meeting volume, minutes, sentiment,
// questions, talk-time balance, per-member leaderboard, a meetings timeline,
// and the team's open action items. No transcripts, summaries, or note bodies
// are ever returned.
//
// Request:  POST { rangeDays?: number }   (default 30; >= 9999 = all time)
// Response: {
//   org: { id, name },
//   rangeDays,
//   totals: { meetings, minutes, avgSentiment, totalQuestions,
//             highEngagementPct, avgTalkDominance, actionItemsTotal, actionItemsDone },
//   members: [{ userId, name, meetings, minutes, avgSentiment, questions,
//               actionItems, actionItemsDone, avgTalkDominance, lastMeetingAt }],
//   timeline: [{ date: "YYYY-MM-DD", meetings, minutes }],
//   openActionItems: [{ task, owner, deadline, priority, memberName, noteTitle, createdAt }]
// }
//
// Errors use stable codes: AUTH_MISSING_HEADER / AUTH_TOKEN_INVALID /
// AUTH_TOKEN_EXPIRED (401) and NOT_IN_ORG (403).
//
// Deploy with verify_jwt=false — the function validates the JWT itself.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface NoteAnalytics {
  questionsAsked?: number;
  sentimentScore?: number;
  engagementLevel?: string;
  talkTimeRatio?: Record<string, number>;
}

interface ActionItem {
  task?: string;
  owner?: string;
  deadline?: string;
  done?: boolean;
  priority?: string;
}

interface NoteRow {
  user_id: string;
  title: string | null;
  created_at: string;
  duration_seconds: number | null;
  analytics: NoteAnalytics | null;
  action_items: ActionItem[] | null;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

    let rangeDays = 30;
    try {
      const body = await req.json();
      const raw = Number(body?.rangeDays);
      if (Number.isFinite(raw) && raw > 0) rangeDays = Math.min(Math.round(raw), 9999);
    } catch {
      // no body — defaults apply
    }

    const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // --- Resolve org membership ----------------------------------------------
    const memResp = await fetch(
      `${supabaseUrl}/rest/v1/org_members?user_id=eq.${userId}&select=org_id&limit=1`,
      { headers: svc },
    );
    if (!memResp.ok) return jsonResponse({ error: "Could not load membership" }, 500);
    const memberships = (await memResp.json()) as { org_id: string }[];
    const orgId = memberships?.[0]?.org_id ?? null;
    if (!orgId) {
      return jsonResponse({ error: "You are not part of an organization", code: "NOT_IN_ORG" }, 403);
    }

    // --- Load org, roster, and profiles ---------------------------------------
    const [orgResp, rosterResp] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/organizations?id=eq.${orgId}&select=id,name&limit=1`, { headers: svc }),
      fetch(`${supabaseUrl}/rest/v1/org_members?org_id=eq.${orgId}&select=user_id`, { headers: svc }),
    ]);
    if (!orgResp.ok || !rosterResp.ok) return jsonResponse({ error: "Could not load organization" }, 500);
    const orgs = (await orgResp.json()) as { id: string; name: string }[];
    const org = orgs?.[0];
    if (!org) return jsonResponse({ error: "Organization not found", code: "NOT_IN_ORG" }, 403);

    const roster = (await rosterResp.json()) as { user_id: string }[];
    const memberIds = [...new Set(roster.map((r) => r.user_id).filter(Boolean))].slice(0, 500);
    if (memberIds.length === 0) return jsonResponse({ error: "Organization has no members" }, 500);

    const idList = memberIds.join(",");
    const profResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=in.(${idList})&select=id,name,email`,
      { headers: svc },
    );
    const profiles = profResp.ok
      ? ((await profResp.json()) as { id: string; name: string | null; email: string | null }[])
      : [];
    const nameOf = (id: string): string => {
      const p = profiles.find((x) => x.id === id);
      const name = p?.name?.trim();
      if (name) return name;
      const email = p?.email?.trim();
      if (email) return email.split("@")[0];
      return "Member";
    };

    // --- Load team notes -------------------------------------------------------
    let notesUrl =
      `${supabaseUrl}/rest/v1/meeting_notes?user_id=in.(${idList})` +
      `&select=user_id,title,created_at,duration_seconds,analytics,action_items` +
      `&order=created_at.desc&limit=2000`;
    if (rangeDays < 9999) {
      const cutoff = new Date(Date.now() - rangeDays * 86400_000).toISOString();
      notesUrl += `&created_at=gte.${encodeURIComponent(cutoff)}`;
    }
    const notesResp = await fetch(notesUrl, { headers: svc });
    if (!notesResp.ok) return jsonResponse({ error: "Could not load team meetings" }, 500);
    const notes = (await notesResp.json()) as NoteRow[];

    // --- Aggregate --------------------------------------------------------------
    interface MemberAgg {
      meetings: number;
      minutes: number;
      sentimentSum: number;
      sentimentCount: number;
      questions: number;
      actionItems: number;
      actionItemsDone: number;
      dominanceSum: number;
      dominanceCount: number;
      lastMeetingAt: string | null;
    }
    const perMember = new Map<string, MemberAgg>();
    for (const id of memberIds) {
      perMember.set(id, {
        meetings: 0, minutes: 0, sentimentSum: 0, sentimentCount: 0, questions: 0,
        actionItems: 0, actionItemsDone: 0, dominanceSum: 0, dominanceCount: 0, lastMeetingAt: null,
      });
    }

    const timelineMap = new Map<string, { meetings: number; minutes: number }>();
    const openActionItems: {
      task: string; owner: string | null; deadline: string | null; priority: string | null;
      memberName: string; noteTitle: string; createdAt: string;
    }[] = [];

    let sentimentSum = 0;
    let sentimentCount = 0;
    let totalQuestions = 0;
    let analyzedCount = 0;
    let highEngagement = 0;
    let dominanceSum = 0;
    let dominanceCount = 0;
    let actionItemsTotal = 0;
    let actionItemsDone = 0;
    let totalSeconds = 0;

    for (const note of notes) {
      const agg = perMember.get(note.user_id);
      const minutes = Math.round((note.duration_seconds ?? 0) / 60);
      totalSeconds += note.duration_seconds ?? 0;

      if (agg) {
        agg.meetings += 1;
        agg.minutes += minutes;
        if (!agg.lastMeetingAt) agg.lastMeetingAt = note.created_at;
      }

      const day = note.created_at.slice(0, 10);
      const t = timelineMap.get(day) ?? { meetings: 0, minutes: 0 };
      t.meetings += 1;
      t.minutes += minutes;
      timelineMap.set(day, t);

      const a = note.analytics;
      if (a && Object.keys(a).length > 0) {
        analyzedCount += 1;
        if (typeof a.sentimentScore === "number") {
          sentimentSum += a.sentimentScore;
          sentimentCount += 1;
          if (agg) { agg.sentimentSum += a.sentimentScore; agg.sentimentCount += 1; }
        }
        if (typeof a.questionsAsked === "number") {
          totalQuestions += a.questionsAsked;
          if (agg) agg.questions += a.questionsAsked;
        }
        if ((a.engagementLevel ?? "").toLowerCase() === "high") highEngagement += 1;
        const ratios = Object.values(a.talkTimeRatio ?? {}).filter((v) => typeof v === "number");
        if (ratios.length > 1) {
          const dominance = Math.max(...ratios);
          dominanceSum += dominance;
          dominanceCount += 1;
          if (agg) { agg.dominanceSum += dominance; agg.dominanceCount += 1; }
        }
      }

      const items = Array.isArray(note.action_items) ? note.action_items : [];
      for (const item of items) {
        const task = (item?.task ?? "").trim();
        if (!task) continue;
        actionItemsTotal += 1;
        if (agg) agg.actionItems += 1;
        if (item.done === true) {
          actionItemsDone += 1;
          if (agg) agg.actionItemsDone += 1;
        } else if (openActionItems.length < 60) {
          openActionItems.push({
            task: task.slice(0, 300),
            owner: item.owner?.trim() || null,
            deadline: item.deadline?.trim() || null,
            priority: item.priority?.trim()?.toLowerCase() || null,
            memberName: nameOf(note.user_id),
            noteTitle: (note.title ?? "Untitled meeting").slice(0, 120),
            createdAt: note.created_at,
          });
        }
      }
    }

    openActionItems.sort((x, y) => {
      const px = PRIORITY_RANK[x.priority ?? ""] ?? 3;
      const py = PRIORITY_RANK[y.priority ?? ""] ?? 3;
      if (px !== py) return px - py;
      return y.createdAt.localeCompare(x.createdAt);
    });

    const members = memberIds
      .map((id) => {
        const m = perMember.get(id)!;
        return {
          userId: id,
          name: nameOf(id),
          meetings: m.meetings,
          minutes: m.minutes,
          avgSentiment: m.sentimentCount > 0 ? round2(m.sentimentSum / m.sentimentCount) : null,
          questions: m.questions,
          actionItems: m.actionItems,
          actionItemsDone: m.actionItemsDone,
          avgTalkDominance: m.dominanceCount > 0
            ? Math.round((m.dominanceSum / m.dominanceCount) * 100)
            : null,
          lastMeetingAt: m.lastMeetingAt,
        };
      })
      .sort((x, y) => y.meetings - x.meetings || x.name.localeCompare(y.name));

    const timeline = [...timelineMap.entries()]
      .map(([date, v]) => ({ date, meetings: v.meetings, minutes: v.minutes }))
      .sort((x, y) => x.date.localeCompare(y.date));

    return jsonResponse({
      org: { id: org.id, name: org.name },
      rangeDays,
      totals: {
        meetings: notes.length,
        minutes: Math.round(totalSeconds / 60),
        avgSentiment: sentimentCount > 0 ? round2(sentimentSum / sentimentCount) : null,
        totalQuestions,
        highEngagementPct: analyzedCount > 0
          ? Math.round((highEngagement / analyzedCount) * 100)
          : null,
        avgTalkDominance: dominanceCount > 0
          ? Math.round((dominanceSum / dominanceCount) * 100)
          : null,
        actionItemsTotal,
        actionItemsDone,
      },
      members,
      timeline,
      openActionItems: openActionItems.slice(0, 15),
    });
  } catch (err) {
    console.error("team-analytics failed", err);
    return jsonResponse({ error: "Could not load team analytics" }, 500);
  }
});
