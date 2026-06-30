import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  Unplug,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase, SUPABASE_FUNCTIONS_URL } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Connection {
  id: string;
  api_domain: string;
  auto_create_deal: boolean;
  enabled: boolean;
  connected_at: string;
}

interface SyncLogEntry {
  id: string;
  event_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const PipedriveSettingsPanel = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [autoDeal, setAutoDeal] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const loadAll = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: conn }, { data: logRows }] = await Promise.all([
      supabase.from("pipedrive_connections" as any).select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("pipedrive_sync_log" as any)
        .select("id,event_type,status,error_message,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    const c = (conn as any) || null;
    setConnection(c);
    setLogs((logRows as any) || []);
    if (c) setAutoDeal(c.auto_create_deal);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "pipedrive" && params.get("status") === "connected") {
      toast.success("Pipedrive connected!");
      window.history.replaceState({}, "", window.location.pathname);
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleConnect = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    setConnecting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("No session");
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/pipedrive-oauth/start`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Failed to start OAuth");
      window.location.href = json.url;
    } catch (e: any) {
      toast.error(e.message || "Could not start Pipedrive OAuth");
      setConnecting(false);
    }
  };

  const handleToggleAutoDeal = async (value: boolean) => {
    setAutoDeal(value);
    setSavingToggle(true);
    const { error } = await supabase
      .from("pipedrive_connections" as any)
      .update({ auto_create_deal: value })
      .eq("user_id", user!.id);
    setSavingToggle(false);
    if (error) {
      toast.error("Failed to save");
      setAutoDeal(!value);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Pipedrive? Your contacts will stop syncing.")) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("pipedrive-disconnect", { body: {} });
      if (error) throw error;
      toast.success("Pipedrive disconnected");
      setConnection(null);
      setLogs([]);
    } catch (e: any) {
      toast.error(e.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="px-4 pb-4 pt-1 bg-secondary/20 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 pt-3 bg-secondary/20 border-t border-border/40 space-y-4">
        {!connection ? (
          <>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Push every new contact (and notes) into Pipedrive as a Person + Deal. Auto-mapped by
              name — no setup required.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting || !user}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50"
            >
              {connecting ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              Connect Pipedrive
            </button>
            {!user && (
              <p className="text-[10px] text-muted-foreground text-center">Sign in to connect Pipedrive.</p>
            )}
          </>
        ) : (
          <>
            {/* Connection header */}
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span className="font-semibold text-emerald-600">Connected</span>
              <span className="text-muted-foreground truncate">
                · {new URL(connection.api_domain).hostname}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug">
              Contacts sync to your default Pipedrive pipeline. Fields auto-map by name (Name, Email,
              Phone, Title, Company, LinkedIn, Website).
            </p>

            {/* Auto-create deal toggle */}
            <label className="flex items-center justify-between gap-3 bg-background/60 rounded-lg px-3 py-2 border border-border/40 cursor-pointer">
              <div>
                <p className="text-xs font-semibold">Auto-create Deal</p>
                <p className="text-[10px] text-muted-foreground">
                  Create a Deal alongside each Person.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoDeal}
                disabled={savingToggle}
                onChange={(e) => handleToggleAutoDeal(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>

            {/* Activity log (collapsible) */}
            <div className="rounded-lg bg-background/60 border border-border/40 overflow-hidden">
              <button
                onClick={() => setActivityOpen((v) => !v)}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                <span>Recent sync activity</span>
                {activityOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {activityOpen && (
                <div className="px-2.5 pb-2 space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-1">No sync activity yet.</p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="flex items-center gap-2 text-[11px]">
                        {log.status === "success" ? (
                          <CheckCircle2 size={10} className="text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle size={10} className="text-destructive shrink-0" />
                        )}
                        <span className="font-mono text-muted-foreground shrink-0">
                          {log.event_type}
                        </span>
                        <span className="text-muted-foreground/70 ml-auto shrink-0">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Disconnect — full-width destructive at bottom */}
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full flex items-center justify-center gap-2 bg-destructive/10 text-destructive font-semibold rounded-xl py-2.5 text-xs disabled:opacity-50 hover:bg-destructive/20 transition-colors"
            >
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />}
              Disconnect Pipedrive
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default PipedriveSettingsPanel;
