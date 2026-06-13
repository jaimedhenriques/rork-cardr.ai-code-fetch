import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Check, ChevronRight, ChevronDown, ExternalLink,
  MessageSquare, Calendar, Globe, BarChart3, Users, Workflow
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import SlackSettingsPanel from "@/components/SlackSettingsPanel";
import PipedriveSettingsPanel from "@/components/PipedriveSettingsPanel";
import { WebhookCard, WEBHOOK_PRESETS } from "@/components/ZapierWebhook";
import type { WebhookType } from "@/lib/webhook";

type IntegrationStatus = "connected" | "available" | "coming_soon" | "via_zapier";

interface Integration {
  id: string;
  name: string;
  descriptionKey: string;
  logo: string;
  category: string;
  status: IntegrationStatus;
  webhookType?: WebhookType;
  zapTemplateUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  // Automation — universal sync layer (lead the page)
  { id: "zapier", name: "Zapier", descriptionKey: "integrations.zapierDesc", logo: "⚡", category: "automation", status: "available", webhookType: "zapier" },
  { id: "make", name: "Make", descriptionKey: "integrations.makeDesc", logo: "🔄", category: "automation", status: "available", webhookType: "make" },
  { id: "n8n", name: "n8n", descriptionKey: "integrations.n8nDesc", logo: "🤖", category: "automation", status: "available", webhookType: "n8n" },

  // CRM / Sales — via Zapier with pre-built templates
  { id: "salesforce", name: "Salesforce", descriptionKey: "integrations.salesforceDesc", logo: "☁️", category: "crm", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/salesforce/integrations/webhook" },
  { id: "hubspot", name: "HubSpot", descriptionKey: "integrations.hubspotDesc", logo: "🟠", category: "crm", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/hubspot/integrations/webhook" },
  { id: "pipedrive", name: "Pipedrive", descriptionKey: "integrations.pipedriveDesc", logo: "🟢", category: "crm", status: "available" },
  { id: "zoho", name: "Zoho CRM", descriptionKey: "integrations.zohoDesc", logo: "🔴", category: "crm", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/zoho-crm/integrations/webhook" },
  { id: "dynamics", name: "Microsoft Dynamics 365", descriptionKey: "integrations.dynamicsDesc", logo: "🟣", category: "crm", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/microsoft-dynamics-crm/integrations/webhook" },
  { id: "freshsales", name: "Freshsales", descriptionKey: "integrations.freshsalesDesc", logo: "🔵", category: "crm", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/freshsales/integrations/webhook" },

  // Communication
  { id: "slack", name: "Slack", descriptionKey: "integrations.slackDesc", logo: "💬", category: "communication", status: "available" },
  { id: "whatsapp", name: "WhatsApp Business", descriptionKey: "integrations.whatsappDesc", logo: "💚", category: "communication", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/whatsapp-notifications/integrations/webhook" },
  { id: "imessage", name: "iMessage", descriptionKey: "integrations.imessageDesc", logo: "🍎", category: "communication", status: "coming_soon" },
  { id: "teams", name: "Microsoft Teams", descriptionKey: "integrations.teamsDesc", logo: "🟦", category: "communication", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/microsoft-teams/integrations/webhook" },
  { id: "telegram", name: "Telegram", descriptionKey: "integrations.telegramDesc", logo: "✈️", category: "communication", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/telegram/integrations/webhook" },

  // Productivity
  { id: "google-calendar", name: "Google Calendar", descriptionKey: "integrations.gcalDesc", logo: "📅", category: "productivity", status: "available" },
  { id: "outlook", name: "Outlook / Microsoft 365", descriptionKey: "integrations.outlookDesc", logo: "📧", category: "productivity", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/microsoft-outlook/integrations/webhook" },
  { id: "calendly", name: "Calendly", descriptionKey: "integrations.calendlyDesc", logo: "🗓️", category: "productivity", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/calendly/integrations/webhook" },
  { id: "notion", name: "Notion", descriptionKey: "integrations.notionDesc", logo: "📝", category: "productivity", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/notion/integrations/webhook" },
  { id: "airtable", name: "Airtable", descriptionKey: "integrations.airtableDesc", logo: "🗂️", category: "productivity", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/airtable/integrations/webhook" },
  { id: "google-sheets", name: "Google Sheets", descriptionKey: "integrations.gsheetsDesc", logo: "📊", category: "productivity", status: "via_zapier", zapTemplateUrl: "https://zapier.com/apps/google-sheets/integrations/webhook" },

  // Data & Enrichment
  { id: "linkedin-nav", name: "LinkedIn Sales Navigator", descriptionKey: "integrations.linkedinNavDesc", logo: "🔗", category: "enrichment", status: "coming_soon" },
  { id: "clearbit", name: "Clearbit", descriptionKey: "integrations.clearbitDesc", logo: "🌐", category: "enrichment", status: "coming_soon" },
  { id: "apollo", name: "Apollo.io", descriptionKey: "integrations.apolloDesc", logo: "🚀", category: "enrichment", status: "coming_soon" },
  { id: "zoominfo", name: "ZoomInfo", descriptionKey: "integrations.zoominfoDesc", logo: "🔍", category: "enrichment", status: "coming_soon" },
];

const CATEGORIES: { key: string; labelKey: string; icon: any }[] = [
  { key: "automation", labelKey: "integrations.categoryAutomation", icon: Workflow },
  { key: "crm", labelKey: "integrations.categoryCrm", icon: BarChart3 },
  { key: "communication", labelKey: "integrations.categoryCommunication", icon: MessageSquare },
  { key: "productivity", labelKey: "integrations.categoryProductivity", icon: Calendar },
  { key: "enrichment", labelKey: "integrations.categoryEnrichment", icon: Users },
];

const StatusBadge = ({ status, t }: { status: IntegrationStatus; t: (key: string) => string }) => {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 rounded-lg px-2.5 py-1">
        <Check size={10} /> {t("integrations.connected")}
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 rounded-lg px-2.5 py-1">
        {t("integrations.connect")} <ChevronRight size={10} />
      </span>
    );
  }
  if (status === "via_zapier") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 rounded-lg px-2.5 py-1">
        ⚡ Via Zapier
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted rounded-lg px-2.5 py-1">
      <Lock size={9} /> {t("integrations.comingSoon")}
    </span>
  );
};

const IntegrationsSection = () => {
  const { t } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalAvailable = INTEGRATIONS.filter((i) => i.status === "available" || i.status === "via_zapier").length;
  const connectedCount = INTEGRATIONS.filter((i) => i.status === "connected").length;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Globe size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("integrations.hubTitle")}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Connect 7000+ apps via Zapier, Make &amp; n8n — or use native integrations for Slack &amp; Google Calendar.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-3">
          <div className="flex-1 bg-secondary/60 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-foreground">{INTEGRATIONS.length}</p>
            <p className="text-[10px] text-muted-foreground">{t("integrations.total")}</p>
          </div>
          <div className="flex-1 bg-emerald-500/10 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-600">{connectedCount}</p>
            <p className="text-[10px] text-muted-foreground">{t("integrations.connected")}</p>
          </div>
          <div className="flex-1 bg-primary/10 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-primary">{totalAvailable}</p>
            <p className="text-[10px] text-muted-foreground">{t("integrations.available")}</p>
          </div>
        </div>
      </motion.div>

      {/* Categories */}
      {CATEGORIES.map((cat, ci) => {
        const items = INTEGRATIONS.filter(i => i.category === cat.key);
        if (items.length === 0) return null;
        const CatIcon = cat.icon;
        const isAutomation = cat.key === "automation";
        return (
          <motion.div
            key={cat.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * (ci + 1) }}
            className="card-elevated overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <CatIcon size={14} className="text-primary" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t(cat.labelKey)}
                </p>
              </div>
              {isAutomation && (
                <span className="text-[9px] font-bold text-primary bg-primary/10 rounded-md px-2 py-0.5 uppercase tracking-wider">
                  Recommended
                </span>
              )}
            </div>

            {isAutomation && (
              <p className="px-4 pb-2 text-[11px] text-muted-foreground leading-snug">
                Connect any of <strong>7000+ apps</strong> by paying once: paste a webhook URL from Zapier, Make, or n8n and every new contact flows automatically.
              </p>
            )}

            <div className="divide-y divide-border/40">
              {items.map((integration) => {
                const isExpandable =
                  integration.status === "available" &&
                  (integration.id === "slack" || integration.id === "pipedrive" || !!integration.webhookType);
                const isExpanded = expandedId === integration.id;
                const isViaZapier = integration.status === "via_zapier";

                return (
                  <div key={integration.id}>
                    <button
                      onClick={() => {
                        if (isExpandable) {
                          setExpandedId(isExpanded ? null : integration.id);
                        } else if (isViaZapier && integration.zapTemplateUrl) {
                          window.open(integration.zapTemplateUrl, "_blank", "noopener,noreferrer");
                        }
                      }}
                      disabled={integration.status === "coming_soon"}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        integration.status === "coming_soon" ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary/40"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-secondary/80 flex items-center justify-center shrink-0 text-lg">
                        {integration.logo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${integration.status === "coming_soon" ? "text-muted-foreground" : "text-foreground"}`}>
                          {integration.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          {t(integration.descriptionKey)}
                        </p>
                      </div>
                      {isExpandable ? (
                        <ChevronDown size={14} className={`text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                      ) : isViaZapier ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge status={integration.status} t={t} />
                          <ExternalLink size={12} className="text-muted-foreground" />
                        </div>
                      ) : (
                        <StatusBadge status={integration.status} t={t} />
                      )}
                    </button>
                    <AnimatePresence>
                      {isExpanded && integration.id === "slack" && <SlackSettingsPanel />}
                      {isExpanded && integration.id === "pipedrive" && <PipedriveSettingsPanel />}
                      {isExpanded && integration.webhookType && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 bg-secondary/20 border-t border-border/40">
                            <WebhookCard type={integration.webhookType} {...WEBHOOK_PRESETS[integration.webhookType]} compact />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default IntegrationsSection;
