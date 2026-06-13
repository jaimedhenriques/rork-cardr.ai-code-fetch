import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Webhook, Check, X, Loader2, ExternalLink, Settings2, Code2, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  getWebhookUrl, setWebhookUrl,
  getWebhookEvents, setWebhookEvents,
  WEBHOOK_EVENTS, buildPayloadSchema,
  type WebhookType, type WebhookEvent,
} from "@/lib/webhook";

interface WebhookCardProps {
  type: WebhookType;
  label: string;
  icon: string;
  placeholder: string;
  helpUrl: string;
  helpText: string;
  compact?: boolean;
}

export const WebhookCard = ({ type, label, icon, placeholder, helpUrl, helpText, compact }: WebhookCardProps) => {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [copied, setCopied] = useState(false);

  const schema = buildPayloadSchema(events);

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(schema);
      setCopied(true);
      toast.success("Payload schema copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy — select and copy manually");
    }
  };

  useEffect(() => {
    const stored = getWebhookUrl(type);
    if (stored) {
      setUrl(stored);
      setSaved(true);
    }
    setEvents(getWebhookEvents(type));
  }, [type]);

  const toggleEvent = (id: WebhookEvent) => {
    const next = events.includes(id) ? events.filter((e) => e !== id) : [...events, id];
    setEvents(next);
    setWebhookEvents(type, next);
  };

  const handleSave = () => {
    if (!url.trim()) {
      setWebhookUrl(type, null);
      setSaved(false);
      toast.success(`${label} webhook removed`);
      return;
    }
    if (!url.startsWith("https://")) {
      toast.error("Please enter a valid HTTPS URL");
      return;
    }
    setWebhookUrl(type, url.trim());
    setSaved(true);
    toast.success(`${label} webhook saved`);
  };

  const handleTest = async () => {
    if (!url.trim()) return;
    setTesting(true);
    try {
      await fetch(url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({
          event: "test",
          timestamp: new Date().toISOString(),
          source: "Card ScanPro",
          data: { name: "Test Contact", email: "test@example.com", company: "Test Corp", title: "CEO" },
        }),
      });
      toast.success("Test event sent! Check your workflow history.");
    } catch {
      toast.error("Failed to send test event");
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    setWebhookUrl(type, null);
    setUrl("");
    setSaved(false);
    toast.success(`${label} webhook removed`);
  };

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-[11px] font-semibold text-foreground">{label}</span>
        </div>
      )}
      <input
        value={url}
        onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
        placeholder={placeholder}
        className="input-field text-xs"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saved && url === getWebhookUrl(type)}
          className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
        >
          <Check size={12} /> {saved ? "Saved" : "Save"}
        </button>
        {saved && (
          <>
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-secondary text-foreground text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              Test
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-destructive-light text-destructive text-xs font-semibold transition-all active:scale-[0.97]"
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>

      {saved && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowEvents((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold hover:text-foreground transition-colors"
          >
            <Settings2 size={10} />
            Trigger events ({events.length}/{WEBHOOK_EVENTS.length})
          </button>
          <button
            onClick={() => setShowSchema((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold hover:text-foreground transition-colors"
          >
            <Code2 size={10} />
            Payload schema
          </button>
          <button
            onClick={handleCopySchema}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 text-[10px] text-primary font-semibold hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? "Copied!" : "Copy schema"}
          </button>
        </div>
      )}

      <AnimatePresence>
        {saved && showEvents && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pt-1">
              {WEBHOOK_EVENTS.map((evt) => {
                const enabled = events.includes(evt.id);
                return (
                  <button
                    key={evt.id}
                    onClick={() => toggleEvent(evt.id)}
                    className={`w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${
                      enabled ? "bg-primary/10 border border-primary/30" : "bg-secondary/40 border border-transparent"
                    }`}
                  >
                    <div className={`mt-0.5 w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center transition-colors ${
                      enabled ? "bg-primary" : "bg-muted border border-border"
                    }`}>
                      {enabled && <Check size={9} className="text-primary-foreground" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground font-mono">{evt.id}</p>
                      <p className="text-[10px] text-muted-foreground leading-snug">{evt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saved && showSchema && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              <div className="relative rounded-lg bg-secondary/60 border border-border/60 p-3 max-h-64 overflow-auto">
                <button
                  onClick={handleCopySchema}
                  disabled={events.length === 0}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur text-[10px] font-semibold text-foreground hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <pre className="text-[10px] leading-relaxed text-foreground font-mono whitespace-pre-wrap break-all pr-14">{schema}</pre>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Sample JSON for {events.length} enabled event{events.length === 1 ? "" : "s"} — paste into your Zap/Make/n8n field mapper.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline">
        <ExternalLink size={10} /> {helpText}
      </a>
    </div>
  );
};

export const WEBHOOK_PRESETS: Record<WebhookType, Omit<WebhookCardProps, "type" | "compact">> = {
  zapier: {
    label: "Zapier",
    icon: "⚡",
    placeholder: "https://hooks.zapier.com/hooks/catch/...",
    helpUrl: "https://zapier.com/apps/webhook/integrations",
    helpText: 'Create a Zap with the "Webhooks by Zapier" trigger',
  },
  make: {
    label: "Make",
    icon: "🔄",
    placeholder: "https://hook.eu2.make.com/...",
    helpUrl: "https://www.make.com/en/help/tools/webhooks",
    helpText: 'Create a Make scenario with a "Custom webhook" trigger',
  },
  n8n: {
    label: "n8n",
    icon: "🤖",
    placeholder: "https://your-instance.app.n8n.cloud/webhook/...",
    helpUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
    helpText: 'Create an n8n workflow with a "Webhook" trigger node',
  },
};

const WebhookSettings = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-elevated p-5 mb-3">
    <div className="flex items-center gap-2 mb-1">
      <Webhook size={14} className="text-primary" />
      <p className="section-label">Automations / Webhooks</p>
    </div>
    <p className="text-[11px] text-muted-foreground mb-4">
      Auto-send events to your CRM, spreadsheet, or any tool — toggle which events fire per webhook.
    </p>

    <div className="space-y-4">
      <WebhookCard type="zapier" {...WEBHOOK_PRESETS.zapier} />
      <div className="border-t border-border/60" />
      <WebhookCard type="make" {...WEBHOOK_PRESETS.make} />
      <div className="border-t border-border/60" />
      <WebhookCard type="n8n" {...WEBHOOK_PRESETS.n8n} />
    </div>
  </motion.div>
);

export default WebhookSettings;
