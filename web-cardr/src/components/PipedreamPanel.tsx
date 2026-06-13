import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plug, Trash2, ExternalLink, Sparkles, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import PipedreamCredentialsPanel from "@/components/PipedreamCredentialsPanel";
import PipedreamConnectionsTable from "@/components/PipedreamConnectionsTable";
import IntegrationsStatusView from "@/components/IntegrationsStatusView";
import { usePipedreamConnect } from "@/hooks/usePipedreamConnect";


interface PipedreamConnection {
  id: string;
  app_slug: string;
  app_name: string;
  pipedream_account_id: string;
  status: string;
  environment: string;
  connected_at: string;
}

const FEATURED_APPS: Array<{ slug: string; name: string; tagline: string }> = [
  { slug: "salesforce", name: "Salesforce", tagline: "Sync contacts to your CRM" },
  { slug: "notion", name: "Notion", tagline: "Push notes to a workspace" },
  { slug: "linear", name: "Linear", tagline: "Create issues from notes" },
  { slug: "airtable_oauth", name: "Airtable", tagline: "Mirror contacts to a base" },
  { slug: "monday", name: "Monday.com", tagline: "Track deals in boards" },
  { slug: "intercom", name: "Intercom", tagline: "Sync to support inbox" },
];

// Common Pipedream app slugs for the generic picker autocomplete.
// Users can type any slug from https://pipedream.com/apps — this is just a hint list.
const PICKER_SUGGESTIONS: Array<{ slug: string; name: string }> = [
  { slug: "salesforce", name: "Salesforce" },
  { slug: "hubspot", name: "HubSpot" },
  { slug: "notion", name: "Notion" },
  { slug: "linear", name: "Linear" },
  { slug: "airtable_oauth", name: "Airtable" },
  { slug: "monday", name: "Monday.com" },
  { slug: "intercom", name: "Intercom" },
  { slug: "zendesk", name: "Zendesk" },
  { slug: "asana", name: "Asana" },
  { slug: "trello", name: "Trello" },
  { slug: "jira", name: "Jira" },
  { slug: "clickup", name: "ClickUp" },
  { slug: "pipedrive", name: "Pipedrive" },
  { slug: "zoho_crm", name: "Zoho CRM" },
  { slug: "freshsales", name: "Freshsales" },
  { slug: "mailchimp", name: "Mailchimp" },
  { slug: "sendgrid", name: "SendGrid" },
  { slug: "google_sheets", name: "Google Sheets" },
  { slug: "discord", name: "Discord" },
  { slug: "telegram_bot_api", name: "Telegram" },
  { slug: "github", name: "GitHub" },
  { slug: "gitlab", name: "GitLab" },
  { slug: "shopify", name: "Shopify" },
  { slug: "stripe", name: "Stripe" },
  { slug: "calendly", name: "Calendly" },
  { slug: "typeform", name: "Typeform" },
];

export default function PipedreamPanel() {
  const [connections, setConnections] = useState<PipedreamConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerQuery, setPickerQuery] = useState("");
  const { connecting, startConnect: startPipedreamConnect } = usePipedreamConnect();

  const connectedSlugs = useMemo(
    () => new Set(connections.map((c) => c.app_slug.toLowerCase())),
    [connections],
  );

  const pickerMatches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ slug: string; name: string }>;
    return PICKER_SUGGESTIONS.filter(
      (a) => a.slug.includes(q) || a.name.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [pickerQuery]);

  const normalizedPickerSlug = useMemo(
    () => pickerQuery.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    [pickerQuery],
  );

  const fetchConnections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pipedream_connections")
      .select("*")
      .order("connected_at", { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setConnections((data ?? []) as PipedreamConnection[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const startConnect = (appSlug: string, appName: string) =>
    startPipedreamConnect({
      appSlug,
      appName,
      onConnected: () => fetchConnections(),
    });

  const disconnect = async (id: string, name: string) => {
    if (!confirm(`Disconnect ${name}?`)) return;
    const { error } = await supabase
      .from("pipedream_connections")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${name} disconnected`);
      fetchConnections();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Connect any of 2,700+ apps via Pipedream</h3>
        <p className="text-sm text-muted-foreground mt-1">
          One-click OAuth for Salesforce, Notion, Linear, and the long tail. Pipedream handles token refresh — Cardr just calls the app's API.
        </p>
      </div>

      <PipedreamCredentialsPanel />


      {/* High-level integrations status (per-app summary) */}
      <IntegrationsStatusView />

      {/* Detailed per-account connection table */}
      <PipedreamConnectionsTable />

      {/* Featured apps */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Featured apps</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURED_APPS.map((app) => (
            <motion.button
              key={app.slug}
              whileHover={{ y: -2 }}
              onClick={() => startConnect(app.slug, app.name)}
              disabled={connecting === app.slug}
              className="text-left rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all px-4 py-3 disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground">{app.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{app.tagline}</div>
                </div>
                {connecting === app.slug ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Plug className="h-4 w-4 text-primary" />
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Generic app picker */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
        <div className="flex items-start gap-3 mb-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-foreground">Connect any other app</div>
            <p className="text-sm text-muted-foreground mt-1">
              Search Pipedream's 2,700+ apps by name or paste a slug (e.g. <code className="font-mono text-xs">hubspot</code>,{" "}
              <code className="font-mono text-xs">zendesk</code>).
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            placeholder="Type an app name or slug…"
            className="pl-9"
            aria-label="Search Pipedream apps"
          />
        </div>

        {pickerMatches.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {pickerMatches.map((app) => {
              const isConnected = connectedSlugs.has(app.slug);
              return (
                <li key={app.slug}>
                  <button
                    type="button"
                    onClick={() => startConnect(app.slug, app.name)}
                    disabled={connecting === app.slug || isConnected}
                    className="w-full flex items-center justify-between rounded-md border border-border bg-card hover:border-primary/40 transition-colors px-3 py-2 text-left disabled:opacity-50"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{app.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{app.slug}</span>
                    </div>
                    {connecting === app.slug ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : isConnected ? (
                      <span className="text-xs text-muted-foreground">Connected</span>
                    ) : (
                      <Plug className="h-4 w-4 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {pickerQuery.trim() && pickerMatches.length === 0 && normalizedPickerSlug && (
          <div className="mt-3 flex items-center justify-between rounded-md border border-dashed border-border bg-card/50 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm text-foreground">Try connecting</span>
              <span className="text-xs font-mono text-muted-foreground">{normalizedPickerSlug}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => startConnect(normalizedPickerSlug, pickerQuery.trim())}
              disabled={connecting === normalizedPickerSlug}
            >
              {connecting === normalizedPickerSlug ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plug className="h-4 w-4 mr-1.5" /> Connect
                </>
              )}
            </Button>
          </div>
        )}

        <a
          href="https://pipedream.com/apps"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
        >
          Browse the full catalog <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
