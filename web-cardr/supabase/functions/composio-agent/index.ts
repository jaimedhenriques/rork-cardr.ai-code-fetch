// composio-agent
//
// Composio-powered AI agent edge function. Handles:
//   1. POST { action: "initiate", toolkit } → returns OAuth redirect URL
//   2. POST { action: "connected_accounts" } → lists user's connected apps
//   3. POST { action: "toolkits" } → lists available toolkits (catalog)
//   4. POST { action: "execute", toolName, arguments } → direct tool execution
//   5. POST { action: "agent", prompt, toolkits?, messages? } → AI agent with Composio tools
//   6. POST { action: "sync_contact", contactId } → push a contact to connected CRM(s)
//
// Deploy with verify_jwt=false. Required secrets: COMPOSIO_API_KEY, TOOLKIT_URL, RORK_TOOLKIT_SECRET_KEY
// The Anthropic API key is NOT needed — we use the Rork AI proxy (Vercel AI Gateway).

// deno-lint-ignore-file no-explicit-any

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

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/** Extracts the user ID from the JWT for Composio session scoping. */
async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const parts = JSON.parse(atob(token.split(".")[1]));
    return parts?.sub ?? null;
  } catch {
    return null;
  }
}

// ─── Composio API helpers ───────────────────────────────────────────

const COMPOSIO_API = "https://api.composio.dev";

async function composioFetch(path: string, options: RequestInit = {}): Promise<any> {
  const apiKey = Deno.env.get("COMPOSIO_API_KEY");
  if (!apiKey) throw new Error("COMPOSIO_API_KEY not set");
  const resp = await fetch(`${COMPOSIO_API}${path}`, {
    ...options,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.message || data?.error || `Composio API error ${resp.status}`);
  return data;
}

/** Initiates an OAuth connection for a toolkit and returns the redirect URL. */
async function initiateConnection(userId: string, toolkit: string, redirectUrl: string): Promise<{ redirectUrl: string }> {
  const body: any = {
    toolkit_slug: toolkit,
    entity_id: userId,
    redirect_url: redirectUrl,
  };
  const data = await composioFetch("/v1/auth-configs/initiate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { redirectUrl: data.redirect_url || data.redirectUrl || data.url };
}

/** Lists all connected accounts for a user. */
async function getConnectedAccounts(userId: string): Promise<any[]> {
  const data = await composioFetch(`/v1/connectedAccounts?entity_id=${encodeURIComponent(userId)}`);
  return data.connectedAccounts || data.items || [];
}

/** Lists available toolkits from Composio catalog. */
async function getToolkits(): Promise<any[]> {
  const data = await composioFetch("/v1/toolkits?limit=100");
  return data.toolkits || data.items || [];
}

/** Executes a specific tool directly. */
async function executeTool(userId: string, toolName: string, args: Record<string, unknown>): Promise<any> {
  const data = await composioFetch("/v1/tools/execute", {
    method: "POST",
    body: JSON.stringify({
      tool_name: toolName,
      entity_id: userId,
      arguments: args,
    }),
  });
  return data;
}

// ─── Rork AI proxy helper (for LLM calls without an Anthropic key) ────

async function callAIProxy(
  messages: any[],
  system: string,
  tools?: any[],
): Promise<Response> {
  const toolkitUrl = Deno.env.get("TOOLKIT_URL");
  const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
  if (!toolkitUrl || !toolkitKey) {
    throw new Error("AI proxy not configured");
  }
  const body: any = {
    model: "google/gemini-3.5-flash",
    temperature: 0.3,
    max_tokens: 2048,
    messages: [
      { role: "system", content: system },
      ...messages,
    ],
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }
  const resp = await fetch(`${toolkitUrl}/v2/vercel/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${toolkitKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return resp;
}

// ─── CRM contact sync helper ─────────────────────────────────────────

/** Maps a Cardr contact to a CRM-compatible payload. */
function mapContactToCRM(contact: any): Record<string, unknown> {
  return {
    first_name: contact.name?.split(" ")[0] || contact.name,
    last_name: contact.name?.split(" ").slice(1).join(" ") || "",
    email: contact.email || null,
    phone: contact.phone || contact.mobilePhone || null,
    company: contact.company || null,
    title: contact.title || null,
    website: contact.website || null,
    linkedin: contact.linkedin || null,
    industry: contact.industry || null,
    location: contact.location || null,
    notes: contact.notes || null,
    company_description: contact.companyDescription || null,
    company_size: contact.companySize || null,
    annual_revenue: contact.annualRevenue || null,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const userId = await getUserId(req);
  if (!userId) {
    return errorResponse("Authentication required", 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const action = body.action;
  if (!action) {
    return errorResponse("Missing 'action' field");
  }

  try {
    // ─── 1. Initiate OAuth connection ──────────────────────────────
    if (action === "initiate") {
      const toolkit = body.toolkit;
      if (!toolkit) return errorResponse("Missing 'toolkit' field");
      const redirectUrl = body.redirectUrl || `${req.headers.get("origin") || "https://cardr.ai"}/app/integrations`;
      const result = await initiateConnection(userId, toolkit, redirectUrl);
      return jsonResponse(result);
    }

    // ─── 2. List connected accounts ────────────────────────────────
    if (action === "connected_accounts") {
      const accounts = await getConnectedAccounts(userId);
      const mapped = accounts.map((acc: any) => ({
        id: acc.id,
        toolkit: acc.toolkit_slug || acc.toolkit,
        status: acc.status,
        client_id: acc.client_id,
        created_at: acc.created_at,
      }));
      return jsonResponse({ accounts: mapped });
    }

    // ─── 3. List available toolkits ────────────────────────────────
    if (action === "toolkits") {
      const allToolkits = await getToolkits();
      // Filter to CRM/productivity-relevant toolkits
      const relevantSlugs = [
        "hubspot", "salesforce", "pipedrive", "zoho_crm", "close_crm",
        "gmail", "google_calendar", "google_contacts", "google_drive",
        "slack", "notion", "linear", "github", "jira", "asana",
        "monday", "trello", "microsoft_teams", "outlook", "discord",
        "airtable", "sheets", "calendly", "zoom", "intercom",
      ];
      const filtered = allToolkits.filter((t: any) =>
        relevantSlugs.includes(t.slug || t.name) ||
        relevantSlugs.includes(t.toolkit_slug)
      );
      return jsonResponse({ toolkits: filtered });
    }

    // ─── 4. Direct tool execution ──────────────────────────────────
    if (action === "execute") {
      const { toolName, arguments: toolArgs } = body;
      if (!toolName) return errorResponse("Missing 'toolName' field");
      const result = await executeTool(userId, toolName, toolArgs || {});
      return jsonResponse({ result });
    }

    // ─── 5. AI agent with Composio tools ───────────────────────────
    if (action === "agent") {
      const { prompt, messages, toolkits } = body;
      if (!prompt && !messages) return errorResponse("Missing 'prompt' or 'messages'");

      // Get connected accounts to know which toolkits are available
      const accounts = await getConnectedAccounts(userId);
      const connectedSlugs = accounts
        .filter((a: any) => a.status === "ACTIVE" || a.status === "active")
        .map((a: any) => a.toolkit_slug || a.toolkit);

      if (connectedSlugs.length === 0) {
        return jsonResponse({
          message: "No connected accounts found. Connect a CRM or app first.",
          connectedAccounts: [],
        });
      }

      // Build Composio session for this user with connected toolkits
      const sessionBody: any = {
        entity_id: userId,
        toolkits: toolkits || connectedSlugs,
      };
      const sessionData = await composioFetch("/v1/sessions", {
        method: "POST",
        body: JSON.stringify(sessionBody),
      });

      const sessionId = sessionData.session_id || sessionData.id;
      if (!sessionId) throw new Error("Failed to create Composio session");

      // Get tools from the session
      const toolsData = await composioFetch(`/v1/sessions/${sessionId}/tools`);
      const composioTools = toolsData.tools || toolsData.items || [];

      // Convert Composio tools to OpenAI function-calling format
      const aiTools = composioTools.map((t: any) => ({
        type: "function",
        function: {
          name: t.name || t.slug,
          description: t.description || "",
          parameters: t.parameters || { type: "object", properties: {} },
        },
      }));

      // Build conversation messages
      const chatMessages = messages || [{ role: "user", content: prompt }];

      const systemPrompt = `You are Cardr.AI's integration assistant. You can use connected apps (CRM, email, calendar, etc.) via Composio tools to help the user manage their contacts and sales workflow.

Available connected apps: ${connectedSlugs.join(", ")}

When the user asks to:
- Push a contact to CRM → use the appropriate CRM create/update tool
- Send a follow-up email → use the email send tool
- Create a calendar event → use the calendar create tool
- Send a Slack notification → use the Slack send message tool

Always confirm what you did after executing a tool. If a tool fails, explain the error and suggest a fix.`;

      // Call AI proxy with tools
      const aiResp = await callAIProxy(chatMessages, systemPrompt, aiTools);

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        throw new Error(`AI proxy error ${aiResp.status}: ${errText.slice(0, 200)}`);
      }

      const aiData = await aiResp.json();
      const choice = aiData.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;
      const responseText = choice?.message?.content || "";

      // If the model wants to call tools, execute them via Composio
      if (toolCalls && toolCalls.length > 0) {
        const results: any[] = [];
        for (const tc of toolCalls) {
          const toolName = tc.function?.name;
          let toolArgs: any = {};
          try {
            toolArgs = JSON.parse(tc.function?.arguments || "{}");
          } catch { /* keep empty */ }

          try {
            const execResult = await executeTool(userId, toolName, toolArgs);
            results.push({
              tool: toolName,
              success: true,
              data: execResult,
            });
          } catch (err: any) {
            results.push({
              tool: toolName,
              success: false,
              error: err.message,
            });
          }
        }

        // Send tool results back to the model for a final response
        const followUpMessages = [
          ...chatMessages,
          choice.message,
          ...results.map((r) => ({
            role: "tool",
            tool_call_id: toolCalls.find((tc: any) => tc.function?.name === r.tool)?.id,
            content: JSON.stringify(r.success ? r.data : { error: r.error }),
          })),
        ];

        const followUpResp = await callAIProxy(followUpMessages, systemPrompt);
        if (followUpResp.ok) {
          const followUpData = await followUpResp.json();
          const finalText = followUpData.choices?.[0]?.message?.content || responseText;
          return jsonResponse({
            message: finalText,
            toolResults: results,
            sessionId,
          });
        }
      }

      return jsonResponse({
        message: responseText,
        toolResults: [],
        sessionId,
      });
    }

    // ─── 6. Sync contact to CRM ────────────────────────────────────
    if (action === "sync_contact") {
      const { contact, toolkit } = body;
      if (!contact) return errorResponse("Missing 'contact' field");
      if (!toolkit) return errorResponse("Missing 'toolkit' (e.g. 'hubspot')");

      // Verify the user has this toolkit connected
      const accounts = await getConnectedAccounts(userId);
      const isConnected = accounts.some(
        (a: any) => (a.toolkit_slug || a.toolkit) === toolkit &&
          (a.status === "ACTIVE" || a.status === "active"),
      );
      if (!isConnected) {
        return errorResponse(`No active connection to ${toolkit}. Connect it first.`, 400);
      }

      const crmContact = mapContactToCRM(contact);

      // Determine the right tool name based on the CRM
      const toolNameMap: Record<string, string> = {
        hubspot: "HUBSPOT_CREATE_CONTACT",
        salesforce: "SALESFORCE_CREATE_CONTACT",
        pipedrive: "PIPEDRIVE_CREATE_PERSON",
        zoho_crm: "ZOHOCRM_CREATE_CONTACT",
        close_crm: "CLOSE_CREATE_CONTACT",
        google_contacts: "GOOGLECONTACTS_CREATE_CONTACT",
      };

      const toolName = toolNameMap[toolkit];
      if (!toolName) {
        return errorResponse(`CRM toolkit '${toolkit}' not supported for contact sync`, 400);
      }

      const result = await executeTool(userId, toolName, crmContact);
      return jsonResponse({ success: true, result });
    }

    // ─── 7. Disconnect a toolkit ───────────────────────────────────
    if (action === "disconnect") {
      const { connectedAccountId } = body;
      if (!connectedAccountId) return errorResponse("Missing 'connectedAccountId'");
      await composioFetch(`/v1/connectedAccounts/${connectedAccountId}`, {
        method: "DELETE",
      });
      return jsonResponse({ success: true });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err: any) {
    console.error("[composio-agent] error:", err.message);
    return errorResponse(err.message || "Internal server error", 500);
  }
});
