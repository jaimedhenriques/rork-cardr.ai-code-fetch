import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Webhook, Zap, Slack as SlackIcon, Calendar as CalIcon, Briefcase, Mail, Database, Building2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import WebhookManager from "@/components/WebhookManager";
import PipedreamPanel from "@/components/PipedreamPanel";
import { FeatureGate } from "@/components/ComingSoonBadge";

interface IntegrationCard {
  id: string;
  name: string;
  tagline: string;
  category: "automation" | "crm" | "communication" | "calendar";
  status: "live" | "soon";
  icon: any;
  iconColor: string;
  bg: string;
  action: () => void;
  actionLabel: string;
}

const Integrations = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<"grid" | "zapier" | "pipedream" | "webhooks">("grid");

  const integrations: IntegrationCard[] = [
    {
      id: "zapier",
      name: "Zapier",
      tagline: "Send notes & contacts to 6,000+ apps",
      category: "automation",
      status: "live",
      icon: Zap,
      iconColor: "#FF4F00",
      bg: "linear-gradient(135deg, #FFF1E6 0%, #FFE4D1 100%)",
      action: () => setView("zapier"),
      actionLabel: "Connect",
    },
    {
      id: "pipedream",
      name: "Pipedream",
      tagline: "Build custom workflows with code or no-code",
      category: "automation",
      status: "live",
      icon: Webhook,
      iconColor: "#1B7E3E",
      bg: "linear-gradient(135deg, #E6F4EC 0%, #D1EAD8 100%)",
      action: () => setView("pipedream"),
      actionLabel: "Connect",
    },
    {
      id: "webhooks",
      name: "Custom Webhooks",
      tagline: "Sign-verified POST to any HTTPS endpoint",
      category: "automation",
      status: "live",
      icon: Webhook,
      iconColor: "#3b82f6",
      bg: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
      action: () => setView("webhooks"),
      actionLabel: "Configure",
    },
    {
      id: "pipedrive",
      name: "Pipedrive",
      tagline: "Native CRM sync — auto-create deals",
      category: "crm",
      status: "live",
      icon: Briefcase,
      iconColor: "#1A1A1A",
      bg: "linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%)",
      action: () => navigate("/app/settings"),
      actionLabel: "Open",
    },
    {
      id: "slack",
      name: "Slack",
      tagline: "Notifications for new contacts & follow-ups",
      category: "communication",
      status: "live",
      icon: SlackIcon,
      iconColor: "#4A154B",
      bg: "linear-gradient(135deg, #F4ECF5 0%, #E8DCEA 100%)",
      action: () => navigate("/app/settings"),
      actionLabel: "Open",
    },
    {
      id: "google-calendar",
      name: "Google Calendar",
      tagline: "Auto-sync meetings & start recordings",
      category: "calendar",
      status: "live",
      icon: CalIcon,
      iconColor: "#1A73E8",
      bg: "linear-gradient(135deg, #E8F0FE 0%, #D2E3FC 100%)",
      action: () => navigate("/app/calendar"),
      actionLabel: "Open",
    },
    {
      id: "hubspot",
      name: "HubSpot",
      tagline: "Push notes as engagements (coming soon)",
      category: "crm",
      status: "soon",
      icon: Building2,
      iconColor: "#FF7A59",
      bg: "linear-gradient(135deg, #FFF1ED 0%, #FFE0D6 100%)",
      action: () => setView("zapier"),
      actionLabel: "Use Zapier",
    },
    {
      id: "salesforce",
      name: "Salesforce",
      tagline: "Sync contacts & activities (coming soon)",
      category: "crm",
      status: "soon",
      icon: Database,
      iconColor: "#00A1E0",
      bg: "linear-gradient(135deg, #E6F5FB 0%, #CFEBF5 100%)",
      action: () => setView("zapier"),
      actionLabel: "Use Zapier",
    },
    {
      id: "gmail",
      name: "Gmail",
      tagline: "Send follow-ups from notes (via Zapier)",
      category: "communication",
      status: "soon",
      icon: Mail,
      iconColor: "#EA4335",
      bg: "linear-gradient(135deg, #FCE9E7 0%, #F9D7D3 100%)",
      action: () => setView("zapier"),
      actionLabel: "Use Zapier",
    },
  ];

  if (view !== "grid") {
    return (
      <div className="min-h-screen pb-40 px-5 pt-12">
        <PageHeader />
        <button onClick={() => setView("grid")} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 mt-2">
          <ArrowLeft size={14} /> All integrations
        </button>
        <h1 className="text-title-1 mb-1">{view === "webhooks" ? "Custom Webhooks" : view === "zapier" ? "Zapier" : "Pipedream"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {view === "zapier" && "Push events to Zapier in real-time. Each event triggers your Zap, which can fan out to 6,000+ apps."}
          {view === "pipedream" && "One-click connect to 2,700+ apps via Pipedream Connect. Pipedream handles OAuth and token refresh — Cardr just calls the app's API."}
          {view === "webhooks" && "Send signed events to any HTTPS endpoint. Verify with HMAC-SHA256 using the secret below."}
        </p>
        {view === "pipedream" ? (
          <FeatureGate feature="pipedreamIntegrations" variant="overlay">
            <PipedreamPanel />
          </FeatureGate>
        ) : (
          <WebhookManager
            defaultProvider={view === "webhooks" ? "generic" : (view as any)}
            filterProvider={view === "webhooks" ? "generic" : (view as any)}
            title={`${view === "webhooks" ? "Custom" : view === "zapier" ? "Zapier" : "Pipedream"} connections`}
          />
        )}
      </div>
    );
  }

  const grouped = {
    automation: integrations.filter(i => i.category === "automation"),
    crm: integrations.filter(i => i.category === "crm"),
    communication: integrations.filter(i => i.category === "communication"),
    calendar: integrations.filter(i => i.category === "calendar"),
  };

  return (
    <div className="min-h-screen pb-40 px-5 pt-12">
      <PageHeader />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
          <Sparkles size={10} /> Integrations
        </div>
        <h1 className="text-title-1">Connect everything</h1>
        <p className="text-sm text-muted-foreground mt-1">Sync notes & contacts to your CRM in one click. 6,000+ apps via Zapier and Pipedream.</p>
      </motion.div>

      {(["automation", "crm", "communication", "calendar"] as const).map((cat, idx) => (
        <motion.section key={cat} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (idx + 1) }} className="mb-7">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
            {cat === "automation" ? "Automation" : cat === "crm" ? "CRM & Sales" : cat === "communication" ? "Communication" : "Calendar"}
          </h2>
          <div className="grid grid-cols-1 gap-2.5">
            {grouped[cat].map(int => {
              const Icon = int.icon;
              return (
                <motion.button
                  key={int.id}
                  onClick={int.action}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-left card-elevated p-4 flex items-center gap-3.5 group hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: int.bg }}>
                    <Icon size={22} style={{ color: int.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{int.name}</p>
                      {int.status === "soon" && <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Soon</span>}
                      {int.status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{int.tagline}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-primary shrink-0 group-hover:gap-2 transition-all">
                    {int.actionLabel} <ArrowRight size={11} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      ))}
    </div>
  );
};

export default Integrations;
