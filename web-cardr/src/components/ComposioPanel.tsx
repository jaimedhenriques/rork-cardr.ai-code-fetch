import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  COMPOSIO_APPS,
  getConnectedAccounts,
  initiateConnection,
  disconnectToolkit,
  syncContactToCRM,
  type ConnectedAccount,
  type ComposioApp,
} from "@/lib/composio";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import {
  Check, Loader2, ExternalLink, Trash2, RefreshCw, Plug, Zap,
} from "lucide-react";

/**
 * Composio-powered integrations panel — lets users connect CRM/email/calendar
 * apps via OAuth, see connection status, and sync contacts to their CRM.
 */
export default function ComposioPanel() {
  const { contacts } = useApp();
  const [connected, setConnected] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<"all" | "crm" | "communication" | "calendar" | "productivity">("all");

  const loadConnected = useCallback(async () => {
    setLoading(true);
    try {
      const accounts = await getConnectedAccounts();
      setConnected(accounts);
    } catch {
      // Silent — user may not have any connections yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnected();
  }, [loadConnected]);

  const isConnected = (slug: string): ConnectedAccount | undefined =>
    connected.find((a) => a.toolkit === slug);

  const handleConnect = async (app: ComposioApp) => {
    setConnecting(app.slug);
    try {
      const { redirectUrl } = await initiateConnection(
        app.slug,
        `${window.location.origin}/app/integrations`,
      );
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        toast.success(`Connected to ${app.name}`);
        await loadConnected();
      }
    } catch (err: any) {
      toast.error(`Failed to connect ${app.name}: ${err.message}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (account: ConnectedAccount) => {
    try {
      await disconnectToolkit(account.id);
      setConnected((prev) => prev.filter((a) => a.id !== account.id));
      toast.success(`Disconnected from ${account.toolkit}`);
    } catch (err: any) {
      toast.error(`Failed to disconnect: ${err.message}`);
    }
  };

  const handleSyncAll = async (toolkit: string, appName: string) => {
    const unenriched = contacts.filter((c) => c.enriched);
    if (unenriched.length === 0) {
      toast.info("No enriched contacts to sync. Enrich some contacts first.");
      return;
    }
    setSyncing(toolkit);
    let success = 0;
    let failed = 0;
    try {
      for (const contact of unenriched) {
        try {
          await syncContactToCRM(contact as unknown as Record<string, unknown>, toolkit);
          success++;
        } catch {
          failed++;
        }
      }
      if (failed === 0) {
        toast.success(`Synced ${success} contacts to ${appName}`);
      } else {
        toast.warning(`Synced ${success}, failed ${failed} contacts to ${appName}`);
      }
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  };

  const filteredApps =
    activeCategory === "all"
      ? COMPOSIO_APPS
      : COMPOSIO_APPS.filter((a) => a.category === activeCategory);

  const categories: { id: typeof activeCategory; label: string }[] = [
    { id: "all", label: "All Apps" },
    { id: "crm", label: "CRM" },
    { id: "communication", label: "Communication" },
    { id: "calendar", label: "Calendar" },
    { id: "productivity", label: "Productivity" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-4 mb-2"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plug size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Composio Integrations</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Connect 250+ apps with one-click OAuth. AI agents can use your connected tools automatically.
            </p>
          </div>
          <button
            onClick={loadConnected}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {connected.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-muted-foreground">
              {connected.length} app{connected.length > 1 ? "s" : ""} connected
            </span>
          </div>
        )}
      </motion.div>

      {/* Category tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* App grid */}
      <div className="grid grid-cols-1 gap-2.5">
        {filteredApps.map((app, idx) => {
          const account = isConnected(app.slug);
          const isConnecting = connecting === app.slug;
          const isSyncing = syncing === app.slug;
          const isCrm = app.category === "crm";

          return (
            <motion.div
              key={app.slug}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * idx }}
              className="card-elevated p-4 flex items-center gap-3.5"
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl"
                style={{ background: app.bg }}
              >
                {app.emoji}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{app.name}</p>
                  {account && (
                    <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      <Check size={9} /> Connected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{app.tagline}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isCrm && account && (
                  <button
                    onClick={() => handleSyncAll(app.slug, app.name)}
                    disabled={isSyncing}
                    className="text-[11px] font-semibold text-primary flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Zap size={12} />
                    )}
                    Sync
                  </button>
                )}

                {account ? (
                  <button
                    onClick={() => handleDisconnect(account)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5"
                    title="Disconnect"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(app)}
                    disabled={isConnecting}
                    className="text-[11px] font-semibold text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ExternalLink size={12} />
                    )}
                    Connect
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Connected accounts detail (when any are connected) */}
      <AnimatePresence>
        {connected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="card-elevated p-4 mt-2"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Active Connections
            </p>
            <div className="space-y-2">
              {connected.map((account) => {
                const app = COMPOSIO_APPS.find((a) => a.slug === account.toolkit);
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{app?.emoji || "🔌"}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {app?.name || account.toolkit}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {account.status}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(account)}
                      className="text-[11px] text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
