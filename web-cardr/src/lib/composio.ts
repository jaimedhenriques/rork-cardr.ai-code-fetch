import { supabase } from "@/integrations/supabase/client";

/**
 * Composio integration client — calls the `composio-agent` edge function
 * to manage OAuth connections, execute tools, and run AI agents with
 * connected CRM/email/calendar apps.
 *
 * All API keys stay server-side (Supabase secrets). The web client only
 * sends the action + parameters; the edge function handles Composio auth.
 */

export interface ConnectedAccount {
  id: string;
  toolkit: string;
  status: string;
  client_id?: string;
  created_at?: string;
}

export interface ComposioToolkit {
  slug: string;
  name: string;
  description?: string;
  logo?: string;
  categories?: string[];
}

export interface ToolResult {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentResponse {
  message: string;
  toolResults: ToolResult[];
  sessionId?: string;
}

async function callEdge<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("composio-agent", {
    body,
  });
  if (error) throw new Error(error.message || "Composio request failed");
  return data as T;
}

/** Initiates an OAuth connection for a toolkit. Returns a redirect URL. */
export async function initiateConnection(
  toolkit: string,
  redirectUrl?: string,
): Promise<{ redirectUrl: string }> {
  return callEdge({ action: "initiate", toolkit, redirectUrl });
}

/** Lists all connected accounts for the current user. */
export async function getConnectedAccounts(): Promise<ConnectedAccount[]> {
  const result = await callEdge<{ accounts: ConnectedAccount[] }>({
    action: "connected_accounts",
  });
  return result.accounts;
}

/** Lists available Composio toolkits (filtered to CRM/productivity apps). */
export async function getToolkits(): Promise<ComposioToolkit[]> {
  const result = await callEdge<{ toolkits: ComposioToolkit[] }>({
    action: "toolkits",
  });
  return result.toolkits;
}

/** Executes a specific tool directly (no AI agent). */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await callEdge<{ result: unknown }>({
    action: "execute",
    toolName,
    arguments: args,
  });
  return result.result;
}

/** Runs the AI agent with connected Composio tools. */
export async function runAgent(
  prompt: string,
  options?: { toolkits?: string[]; messages?: Array<{ role: string; content: string }> },
): Promise<AgentResponse> {
  return callEdge({
    action: "agent",
    prompt,
    toolkits: options?.toolkits,
    messages: options?.messages,
  });
}

/** Syncs a contact to a connected CRM toolkit. */
export async function syncContactToCRM(
  contact: Record<string, unknown>,
  toolkit: string,
): Promise<{ success: boolean; result: unknown }> {
  return callEdge({ action: "sync_contact", contact, toolkit });
}

/** Disconnects a toolkit by connected account ID. */
export async function disconnectToolkit(
  connectedAccountId: string,
): Promise<{ success: boolean }> {
  return callEdge({ action: "disconnect", connectedAccountId });
}

// ─── Curated app catalog for the Integrations page ───────────────────

export interface ComposioApp {
  slug: string;
  name: string;
  tagline: string;
  category: "crm" | "communication" | "calendar" | "productivity";
  iconColor: string;
  bg: string;
  emoji: string;
}

export const COMPOSIO_APPS: ComposioApp[] = [
  // CRM
  { slug: "hubspot", name: "HubSpot", tagline: "Auto-push contacts as HubSpot contacts", category: "crm", iconColor: "#FF7A59", bg: "linear-gradient(135deg, #FFF1ED 0%, #FFE0D6 100%)", emoji: "🟠" },
  { slug: "salesforce", name: "Salesforce", tagline: "Sync contacts & activities to Salesforce", category: "crm", iconColor: "#00A1E0", bg: "linear-gradient(135deg, #E6F5FB 0%, #CFEBF5 100%)", emoji: "☁️" },
  { slug: "pipedrive", name: "Pipedrive", tagline: "Create deals & persons in Pipedrive", category: "crm", iconColor: "#1A1A1A", bg: "linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%)", emoji: "💼" },
  { slug: "zoho_crm", name: "Zoho CRM", tagline: "Push enriched contacts to Zoho", category: "crm", iconColor: "#E42527", bg: "linear-gradient(135deg, #FDECEC 0%, #F9D7D7 100%)", emoji: "🔴" },
  { slug: "close_crm", name: "Close CRM", tagline: "Sync contacts & log calls to Close", category: "crm", iconColor: "#3D82F5", bg: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)", emoji: "🔵" },
  // Communication
  { slug: "gmail", name: "Gmail", tagline: "Send follow-up emails from meeting notes", category: "communication", iconColor: "#EA4335", bg: "linear-gradient(135deg, #FCE9E7 0%, #F9D7D3 100%)", emoji: "📧" },
  { slug: "slack", name: "Slack", tagline: "Send contact & note notifications to Slack", category: "communication", iconColor: "#4A154B", bg: "linear-gradient(135deg, #F4ECF5 0%, #E8DCEA 100%)", emoji: "💬" },
  { slug: "outlook", name: "Outlook", tagline: "Send emails via Outlook 365", category: "communication", iconColor: "#0078D4", bg: "linear-gradient(135deg, #E6F2FC 0%, #D0E7F8 100%)", emoji: "📨" },
  // Calendar
  { slug: "google_calendar", name: "Google Calendar", tagline: "Create events from meeting notes", category: "calendar", iconColor: "#1A73E8", bg: "linear-gradient(135deg, #E8F0FE 0%, #D2E3FC 100%)", emoji: "📅" },
  { slug: "calendly", name: "Calendly", tagline: "Share booking links from your card", category: "calendar", iconColor: "#006BFF", bg: "linear-gradient(135deg, #E6F0FF 0%, #D0E2FF 100%)", emoji: "🗓️" },
  // Productivity
  { slug: "notion", name: "Notion", tagline: "Save meeting notes as Notion pages", category: "productivity", iconColor: "#1A1A1A", bg: "linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%)", emoji: "📝" },
  { slug: "linear", name: "Linear", tagline: "Create issues from action items", category: "productivity", iconColor: "#5E6AD2", bg: "linear-gradient(135deg, #EDEEF8 0%, #DCDEF0 100%)", emoji: "📐" },
  { slug: "asana", name: "Asana", tagline: "Create tasks from meeting action items", category: "productivity", iconColor: "#F06A6A", bg: "linear-gradient(135deg, #FDEEEE 0%, #F9DADA 100%)", emoji: "✅" },
  { slug: "jira", name: "Jira", tagline: "Create tickets from meeting notes", category: "productivity", iconColor: "#0052CC", bg: "linear-gradient(135deg, #E6F0FF 0%, #D0E2FF 100%)", emoji: "🎯" },
  { slug: "airtable", name: "Airtable", tagline: "Sync contacts to Airtable bases", category: "productivity", iconColor: "#FCB400", bg: "linear-gradient(135deg, #FFF7E6 0%, #FFEDC4 100%)", emoji: "🗂️" },
];
