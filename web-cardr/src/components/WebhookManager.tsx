import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Webhook, Trash2, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Activity, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhooks";
import { format, parseISO } from "date-fns";

interface Subscription {
  id: string;
  name: string;
  url: string;
  provider: string;
  events: string[];
  active: boolean;
  secret: string;
  last_delivery_at: string | null;
  last_status: string | null;
  failure_count: number;
  created_at: string;
}

interface Delivery {
  id: string;
  event: string;
  status_code: number | null;
  error: string | null;
  delivered_at: string;
}

interface Props {
  /** Optional: filter the create form to a specific provider preset. */
  defaultProvider?: "zapier" | "pipedream" | "generic";
  /** Optional: only show subs for this provider. */
  filterProvider?: "zapier" | "pipedream" | "generic";
  title?: string;
}

const PROVIDER_META: Record<string, { label: string; placeholder: string; help: string }> = {
  zapier: {
    label: "Zapier",
    placeholder: "https://hooks.zapier.com/hooks/catch/...",
    help: "In Zapier, create a Zap with the 'Webhooks by Zapier' trigger → 'Catch Hook'. Copy the URL and paste it here.",
  },
  pipedream: {
    label: "Pipedream",
    placeholder: "https://eo...m.pipedream.net",
    help: "In Pipedream, create a workflow with the 'HTTP / Webhook' trigger and paste the generated URL here.",
  },
  generic: {
    label: "Custom webhook",
    placeholder: "https://your-server.com/webhook",
    help: "Any HTTPS endpoint that accepts POST. We sign the body with HMAC-SHA256 in the X-Cardr-Signature header.",
  },
};

const WebhookManager = ({ defaultProvider = "zapier", filterProvider, title = "Webhooks" }: Props) => {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<"zapier" | "pipedream" | "generic">(defaultProvider);
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(["note.created", "contact.created"]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    let q = supabase.from("webhook_subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (filterProvider) q = q.eq("provider", filterProvider);
    const { data } = await q;
    setSubs((data as Subscription[]) || []);
    setLoading(false);
  }, [user, filterProvider]);

  useEffect(() => { load(); }, [load]);

  const toggleEvent = (e: WebhookEvent) => {
    setSelectedEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  };

  const handleCreate = async () => {
    if (!user) { toast.error("Sign in to create webhooks"); return; }
    if (!url.trim()) { toast.error("Webhook URL required"); return; }
    if (!url.startsWith("https://")) { toast.error("URL must use https://"); return; }
    if (selectedEvents.length === 0) { toast.error("Select at least one event"); return; }
    setCreating(true);
    const { error } = await supabase.from("webhook_subscriptions").insert({
      user_id: user.id,
      name: name.trim() || `${PROVIDER_META[provider].label} webhook`,
      url: url.trim(),
      provider,
      events: selectedEvents,
      active: true,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Webhook connected");
    setName(""); setUrl(""); setSelectedEvents(["note.created", "contact.created"]);
    setShowCreate(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("webhook_subscriptions").delete().eq("id", id);
    setSubs(prev => prev.filter(s => s.id !== id));
    toast.success("Webhook removed");
  };

  const handleToggleActive = async (sub: Subscription) => {
    await supabase.from("webhook_subscriptions").update({ active: !sub.active }).eq("id", sub.id);
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, active: !s.active } : s));
  };

  const handleTest = async (sub: Subscription) => {
    toast.info("Sending test event…");
    const { data, error } = await supabase.functions.invoke("dispatch-webhook", {
      body: { event: sub.events[0] || "note.created", payload: { test: true, message: "Test event from Cardr" } },
    });
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.delivered > 0) toast.success("Test delivered ✓");
    else toast.warning("Sent but no successful delivery — check the destination.");
    setTimeout(load, 800);
  };

  const handleExpand = async (sub: Subscription) => {
    if (expandedId === sub.id) { setExpandedId(null); return; }
    setExpandedId(sub.id);
    if (!deliveries[sub.id]) {
      const { data } = await supabase
        .from("webhook_deliveries")
        .select("id, event, status_code, error, delivered_at")
        .eq("subscription_id", sub.id)
        .order("delivered_at", { ascending: false })
        .limit(10);
      setDeliveries(prev => ({ ...prev, [sub.id]: (data as Delivery[]) || [] }));
    }
  };

  const copySecret = (secret: string, id: string) => {
    navigator.clipboard.writeText(secret);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!user) {
    return (
      <div className="card-elevated p-6 text-center">
        <Webhook size={28} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Sign in to manage webhooks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subs.length} active connection{subs.length === 1 ? "" : "s"}</p>
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> New
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card-elevated p-4 space-y-3">
              {!filterProvider && (
                <div className="flex gap-2">
                  {(Object.keys(PROVIDER_META) as Array<keyof typeof PROVIDER_META>).map(p => (
                    <button
                      key={p}
                      onClick={() => setProvider(p as any)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        provider === p ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {PROVIDER_META[p].label}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Name (optional)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HubSpot sync via Zapier"
                  className="w-full h-10 mt-1 px-3 rounded-lg bg-card border border-border text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Webhook URL</label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={PROVIDER_META[provider].placeholder}
                  className="w-full h-10 mt-1 px-3 rounded-lg bg-card border border-border text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{PROVIDER_META[provider].help}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Events</label>
                <div className="grid grid-cols-1 gap-1.5 mt-1.5">
                  {WEBHOOK_EVENTS.map(ev => (
                    <button
                      key={ev.value}
                      onClick={() => toggleEvent(ev.value)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                        selectedEvents.includes(ev.value)
                          ? "bg-primary/5 border-primary/30"
                          : "bg-card border-border hover:bg-secondary/40"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                        selectedEvents.includes(ev.value) ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {selectedEvents.includes(ev.value) && <Check size={10} className="text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{ev.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{ev.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 h-10 rounded-lg bg-secondary text-foreground text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  {creating ? "Connecting…" : "Connect"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="card-elevated p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : subs.length === 0 ? (
        <div className="card-elevated p-6 text-center">
          <Webhook size={24} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No webhooks yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Connect Zapier or Pipedream to sync notes & contacts to 5,000+ apps.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map(sub => (
            <div key={sub.id} className="card-elevated p-3.5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sub.active ? "bg-primary/10" : "bg-secondary"}`}>
                  <Webhook size={15} className={sub.active ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{sub.name}</p>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{sub.provider}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate font-mono">{sub.url}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{sub.events.length} event{sub.events.length === 1 ? "" : "s"}</span>
                    {sub.last_status && (
                      <span className={`text-[10px] flex items-center gap-1 ${sub.last_status === "ok" ? "text-emerald-600" : "text-destructive"}`}>
                        {sub.last_status === "ok" ? <Check size={9} /> : <AlertCircle size={9} />}
                        {sub.last_status === "ok" ? "OK" : "Failing"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(sub)}
                  className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${sub.active ? "bg-primary" : "bg-muted"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${sub.active ? "left-3.5" : "left-0.5"}`} />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                <button onClick={() => handleTest(sub)} className="text-[11px] font-semibold text-primary flex items-center gap-1">
                  <Activity size={11} /> Test
                </button>
                <button onClick={() => handleExpand(sub)} className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  {expandedId === sub.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Logs
                </button>
                <button onClick={() => copySecret(sub.secret, sub.id)} className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  {copied === sub.id ? <Check size={11} /> : <Copy size={11} />} Secret
                </button>
                <button onClick={() => handleDelete(sub.id)} className="text-[11px] font-semibold text-destructive flex items-center gap-1 ml-auto">
                  <Trash2 size={11} /> Remove
                </button>
              </div>

              {expandedId === sub.id && (
                <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                  {(deliveries[sub.id] || []).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No deliveries yet. Click Test to send one.</p>
                  ) : (
                    (deliveries[sub.id] || []).map(d => {
                      const ok = d.status_code !== null && d.status_code >= 200 && d.status_code < 300;
                      return (
                        <div key={d.id} className="flex items-center gap-2 text-[11px]">
                          <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-destructive"}`} />
                          <span className="font-mono text-foreground">{d.event}</span>
                          <span className={ok ? "text-emerald-600" : "text-destructive"}>
                            {d.status_code ?? "ERR"}
                          </span>
                          <span className="text-muted-foreground ml-auto">{format(parseISO(d.delivered_at), "MMM d, HH:mm:ss")}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebhookManager;
