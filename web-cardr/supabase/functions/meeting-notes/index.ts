// meeting-notes
//
// Turns a meeting transcript / raw notes into structured insights using a
// language model via the Rork AI proxy (Vercel AI Gateway).
//
// Request:  { transcript: string, durationSeconds?: number, templateId?: string }
// Response: { notes: {
//   summary, keyTopics[], actionItems[{task, owner, deadline, priority, done}],
//   followUps[{description, with, urgency}], decisions[], insights[],
//   mentionedPeople[{name, role, context}], openQuestions[],
//   analytics{questionsAsked, sentimentScore, sentimentLabel, engagementLevel,
//             topSpeaker, talkTimeRatio, keyMetrics[{label, value}]},
//   ...template-specific fields
// } }
//
// Deploy with verify_jwt=false. Required secrets: TOOLKIT_URL, RORK_TOOLKIT_SECRET_KEY

// deno-lint-ignore-file no-explicit-any
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-3.5-flash";
const MAX_TRANSCRIPT_CHARS = 200_000;

/** Template-specific prompt guides, mirrored from the app's note templates. */
const TEMPLATE_GUIDES: Record<string, string> = {
  "customer-discovery": `This is a Customer Discovery / Sales Discovery call. Also include these extra JSON fields:
- "painPoints": string[] — every pain point, frustration, or challenge the prospect mentions, in their exact words
- "needs": string[] — what the prospect explicitly needs or wants
- "buyerQuotes": string[] — verbatim quotes revealing intent, urgency, or objections
- "objections": string[] — every concern, pushback, or hesitation raised
- "competitorMentions": string[] — competitors or alternatives mentioned
- "budgetSignals": string[] — mentions of budget, pricing sensitivity, willingness to pay
- "decisionProcess": string — who else is involved and the timeline
Focus the summary on the prospect's situation and buying signals.`,
  "one-on-one": `This is a 1-on-1 meeting. Also include these extra JSON fields:
- "wins": string[] — accomplishments and positive updates
- "blockers": string[] — obstacles or frustrations slowing the person down
- "feedback": string[] — feedback given or received
- "careerGoals": string[] — growth, skills, aspirations mentioned
- "morale": string — signals about engagement, satisfaction, or burnout
Capture the overall tone in the summary; action items should focus on removing blockers.`,
  "standup": `This is a Standup / Sprint meeting. Also include these extra JSON fields:
- "completedWork": string[] — what was done since last standup (per person if multiple speakers)
- "plannedWork": string[] — what each person plans to work on next
- "blockers": string[] — anything blocking progress
- "sprintRisks": string[] — items at risk of missing the deadline
Keep the summary very brief (2-3 sentences). Group updates by speaker when possible.`,
  "pitch": `This is a Sales Pitch or Product Demo. Also include these extra JSON fields:
- "audienceReactions": string[] — moments of interest, excitement, confusion, or disengagement
- "questionsAsked": string[] — every question the audience asked
- "objections": string[] — concerns or pushback, with exact words
- "buyingSignals": string[] — statements indicating interest or readiness to buy
- "featureInterest": string[] — features that got the most attention
- "competitorComparisons": string[] — mentions of competitors
- "closePlan": string — agreed next steps toward a deal
Assess the overall reception and likelihood of moving forward in the summary.`,
  "brainstorm": `This is a Brainstorming session. Also include these extra JSON fields:
- "ideasGenerated": string[] — every idea mentioned, even briefly
- "themes": string[] — related ideas grouped into themes
- "topIdeas": string[] — ideas with the most discussion or enthusiasm
- "concerns": string[] — risks raised about specific ideas
- "experimentsToRun": string[] — ideas selected for further exploration
Keep the summary focused on the creative output and direction chosen.`,
  "board-meeting": `This is a Board Meeting. Also include these extra JSON fields:
- "motionsAndVotes": string[] — motions with outcome (passed/failed/tabled) and vote counts if mentioned
- "strategicPriorities": string[] — strategic goals or focus areas discussed
- "riskItems": string[] — risks or compliance concerns, with severity when mentioned
- "committeeUpdates": string[] — reports from committees or departments
- "budgetItems": string[] — budget approvals, spend, forecasts
- "governanceActions": string[] — policy changes, appointments, procedural items
Capture the board's key decisions and strategic direction in the summary.`,
  "phone-call": `This is a Phone Call transcript. Also include these extra JSON fields:
- "callPurpose": string — the main reason for the call
- "commitments": string[] — promises made by either party
- "requestsMade": string[] — specific asks from either side
- "toneAssessment": string — overall tone (friendly, tense, professional, casual, urgent)
- "relationshipSignals": string[] — cues about the relationship
- "callbackNeeded": string or null — whether a follow-up call was agreed, and when
Focus the summary on the purpose and outcome of the call.`,
};

const BASE_PROMPT = `You are an expert meeting analyst. Analyze the transcript/notes and return ONLY a JSON object (no markdown fences, no commentary) with this shape:
{
  "summary": "2-4 sentence overview of what the meeting was about and its outcome",
  "keyTopics": ["short topic", ...],
  "actionItems": [{ "task": "...", "owner": "person or null", "deadline": "date/timeframe or null", "priority": "high|medium|low", "done": false }],
  "followUps": [{ "description": "...", "with": "person or null", "urgency": "high|medium|low" }],
  "decisions": ["decision made", ...],
  "insights": ["notable insight or observation", ...],
  "mentionedPeople": [{ "name": "...", "role": "their role/company or null", "context": "why they came up or null" }],
  "openQuestions": ["unresolved question", ...],
  "analytics": {
    "questionsAsked": 0,
    "sentimentScore": 0.0,
    "sentimentLabel": "positive|neutral|negative|mixed",
    "engagementLevel": "high|medium|low",
    "topSpeaker": "speaker label or null",
    "talkTimeRatio": { "Speaker 1": 0.6, "Speaker 2": 0.4 },
    "keyMetrics": [{ "label": "short stat name", "value": "short value" }]
  }
}

Rules:
- Base everything strictly on the transcript. Never invent people, dates, or numbers.
- Omit or use empty arrays for sections with nothing meaningful — do not pad.
- talkTimeRatio only when the transcript has speaker labels ([mm:ss] Speaker N:); values sum to 1.
- sentimentScore is -1..1. keyMetrics max 4 items.
- Write in the same language as the transcript.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseModelJSON(text: string): any | null {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const toolkitUrl = Deno.env.get("TOOLKIT_URL");
    const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    if (!toolkitUrl || !toolkitKey) {
      return jsonResponse({ error: "AI notes are not configured yet." }, 500);
    }

    const body = await req.json().catch(() => null);
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    if (transcript.length < 10) {
      return jsonResponse({ error: "Transcript too short" }, 400);
    }
    const durationSeconds = Number(body?.durationSeconds) || 0;
    const templateId = typeof body?.templateId === "string" ? body.templateId : "general";
    const guide = TEMPLATE_GUIDES[templateId] ?? "";

    const systemPrompt = guide ? `${BASE_PROMPT}\n\n${guide}` : BASE_PROMPT;
    const durationLine = durationSeconds > 0
      ? `Meeting duration: ${Math.round(durationSeconds / 60)} minutes.\n\n`
      : "";

    const resp = await fetch(
      `${toolkitUrl.replace(/\/$/, "")}/v2/vercel/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${toolkitKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 8000,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${durationLine}Transcript / notes:\n\n${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`,
            },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("meeting-notes upstream error", resp.status, detail.slice(0, 400));
      if (resp.status === 429) return jsonResponse({ error: "AI is busy — try again in a moment." }, 429);
      if (resp.status === 402) return jsonResponse({ error: "AI credits exhausted." }, 402);
      return jsonResponse({ error: "Could not generate notes. Please try again." }, 500);
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const notes = parseModelJSON(text);
    if (!notes) {
      console.error("meeting-notes: unparseable model output", text.slice(0, 300));
      return jsonResponse({ error: "Could not generate notes. Please try again." }, 500);
    }

    // Normalize the core arrays so clients never crash on odd types.
    const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
    notes.keyTopics = arr(notes.keyTopics);
    notes.actionItems = arr(notes.actionItems);
    notes.followUps = arr(notes.followUps);
    notes.decisions = arr(notes.decisions);
    notes.insights = arr(notes.insights);
    notes.mentionedPeople = arr(notes.mentionedPeople);
    notes.openQuestions = arr(notes.openQuestions);

    return jsonResponse({ notes, model: MODEL });
  } catch (err) {
    console.error("meeting-notes failed", err);
    return jsonResponse({ error: "Failed to generate meeting notes" }, 500);
  }
});
