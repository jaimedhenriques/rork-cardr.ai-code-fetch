export interface NoteTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  promptGuide: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "general",
    label: "General Meeting",
    emoji: "📋",
    description: "Standard meeting notes with summary, actions & follow-ups",
    promptGuide: "",
  },
  {
    id: "customer-discovery",
    label: "Customer Discovery",
    emoji: "🔍",
    description: "Pain points, needs, quotes & competitive intel",
    promptGuide: `This is a Customer Discovery / Sales Discovery call. Adapt your output to focus on:
- "painPoints": extract every pain point, frustration, or challenge the prospect mentions — use their exact words
- "needs": what the prospect explicitly needs or wants
- "buyerQuotes": verbatim quotes that reveal intent, urgency, or objections
- "objections": every concern, pushback, or hesitation raised
- "competitorMentions": any competitor or alternative solution mentioned
- "budgetSignals": any mention of budget, pricing sensitivity, or willingness to pay
- "decisionProcess": who else is involved in the decision, what's the timeline
- "nextSteps": specific agreed next steps
In the summary, focus on the prospect's situation and buying signals. Prioritize action items around follow-up timing and commitments made.`,
  },
  {
    id: "one-on-one",
    label: "1-on-1",
    emoji: "👥",
    description: "Goals, blockers, feedback & career growth",
    promptGuide: `This is a 1-on-1 meeting (manager/report or peer). Adapt your output to focus on:
- "wins": accomplishments, progress, and positive updates shared
- "blockers": obstacles, frustrations, or things slowing the person down
- "feedback": any feedback given or received (positive or constructive)
- "careerGoals": mentions of growth, skills, aspirations, or development
- "morale": signals about engagement, satisfaction, or burnout
- "supportNeeded": specific help, resources, or decisions the person needs from others
In the summary, capture the overall tone and key themes of the conversation. Action items should focus on removing blockers and supporting growth.`,
  },
  {
    id: "standup",
    label: "Standup / Sprint",
    emoji: "🏃",
    description: "Yesterday, today, blockers & sprint status",
    promptGuide: `This is a Standup / Sprint meeting. Adapt your output to focus on:
- "completedWork": what was done since last standup (per person if multiple speakers)
- "plannedWork": what each person plans to work on next
- "blockers": anything blocking progress — escalation needed?
- "sprintRisks": items at risk of missing the deadline
- "dependencies": cross-team or cross-person dependencies mentioned
Keep the summary very brief (2-3 sentences). Action items should focus on blockers and risks. Group updates by speaker/person when possible.`,
  },
  {
    id: "pitch",
    label: "Sales Pitch / Demo",
    emoji: "🎯",
    description: "Reactions, objections, buying signals & close plan",
    promptGuide: `This is a Sales Pitch or Product Demo. Adapt your output to focus on:
- "audienceReactions": moments of interest, excitement, confusion, or disengagement
- "questionsAsked": every question the audience asked — these reveal priorities
- "objections": concerns or pushback, with the exact words used
- "buyingSignals": statements indicating interest, urgency, or readiness to buy
- "featureInterest": which features or capabilities got the most attention
- "competitorComparisons": any mention of competitors or "how is this different from X?"
- "pricingDiscussion": any pricing-related conversation or sensitivity
- "closePlan": agreed next steps toward a deal (trial, proposal, follow-up call, etc.)
In the summary, assess the overall reception and likelihood of moving forward. Action items should focus on addressing objections and next steps in the sales process.`,
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    emoji: "💡",
    description: "Ideas, themes, voted priorities & next experiments",
    promptGuide: `This is a Brainstorming / Ideation session. Adapt your output to focus on:
- "ideasGenerated": every idea mentioned, even briefly
- "themes": group related ideas into themes or categories
- "topIdeas": ideas that got the most discussion or enthusiasm
- "concerns": risks or challenges raised about specific ideas
- "votesOrConsensus": any voting, ranking, or consensus reached
- "experimentsToRun": ideas selected for further exploration or testing
Keep the summary focused on the creative output and direction chosen. Action items should focus on next steps for the top ideas.`,
  },
  {
    id: "board-meeting",
    label: "Board Meeting",
    emoji: "🏛️",
    description: "Decisions, votes, strategic priorities & risk register",
    promptGuide: `This is a Board Meeting or Executive Committee meeting. Adapt your output to focus on:
- "motionsAndVotes": decisions put to a vote — include the motion text, outcome (passed/failed/tabled), and vote count if mentioned
- "strategicPriorities": high-level strategic goals, initiatives, or focus areas discussed
- "riskItems": risks, threats, or compliance concerns raised — include severity if mentioned
- "committeeUpdates": summary of reports from committees, departments, or working groups
- "budgetItems": any financial discussions — budget approvals, spend, forecasts, or allocations
- "governanceActions": policy changes, bylaw amendments, officer appointments, or procedural items
In the summary, capture the board's key decisions and strategic direction. Action items should focus on follow-through assignments with owners and deadlines.`,
  },
  {
    id: "phone-call",
    label: "Phone Call",
    emoji: "📞",
    description: "Call summary, commitments, follow-up & tone",
    promptGuide: `This is a Phone Call transcript. Adapt your output to focus on:
- "callPurpose": string — the main reason for the call
- "commitments": array of strings — promises or commitments made by either party
- "requestsMade": array of strings — specific asks or requests from either side
- "toneAssessment": string — overall tone of the call (friendly, tense, professional, casual, urgent)
- "relationshipSignals": array of strings — cues about the relationship (rapport, trust, frustration, new connection)
- "callbackNeeded": string or null — whether a follow-up call was agreed upon, and when
In the summary, focus on the purpose and outcome of the call. Action items should capture commitments and follow-ups with urgency.`,
  },
];

export const getTemplateById = (id: string): NoteTemplate =>
  NOTE_TEMPLATES.find((t) => t.id === id) || NOTE_TEMPLATES[0];
