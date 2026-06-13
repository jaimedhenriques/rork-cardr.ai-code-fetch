import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ScanLine, CreditCard, CalendarDays, Flag, ArrowRight, ChevronRight, Sparkles, LogIn, Zap, Play, TrendingUp, Users, Activity, AlertTriangle, FileText, Mic, PenLine, MessageSquare } from "lucide-react";
import { useSubscription, PLAN_LIMITS, UPGRADE_THRESHOLD } from "@/hooks/useSubscription";
import AIChatSection from "@/components/AIChatSection";
import ReferralShareSheet from "@/components/ReferralShareSheet";
import PageHeader from "@/components/PageHeader";
import DashboardCustomizer from "@/components/DashboardCustomizer";
import { getEngagementScore, type EngagementTier } from "@/lib/engagement";
import { supabase } from "@/integrations/supabase/client";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { useDashboardSections } from "@/hooks/useDashboardSections";
import { useLanguage } from "@/context/LanguageContext";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import AnimatedNumber from "@/components/ui/animated-number";
import BentoCard from "@/components/ui/bento-card";
import AnimatedList from "@/components/ui/animated-list";
import { isIosNative } from "@/lib/iosCompliance";
import IosManagePlanNotice from "@/components/IosManagePlanNotice";
import ShareMyCardSection from "@/components/ShareMyCardSection";
import DashboardHero from "@/components/DashboardHero";
import DashboardEventsWidget from "@/components/DashboardEventsWidget";
import QuickEmailExportButton from "@/components/QuickEmailExportButton";

const Dashboard = () => {
  const { contacts, profile, isGuest, contactLimit } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { quickActions } = useNavPreferences();
  const { sections, setSections, toggleSection, applyPreset, moveSection, visibleSectionIds } = useDashboardSections();
  const { usage, subscription, usagePercent, shouldShowUpgradePrompt, limits, plan } = useSubscription();
  const { t } = useLanguage();
  const enrichedCount = contacts.filter((c) => c.enriched).length;
  const recentContacts = contacts.slice(0, 5);

  const [lastActivities, setLastActivities] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user || contacts.length === 0) return;
    supabase
      .from("contact_activities")
      .select("contact_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const row of data) {
          if (!map[row.contact_id]) map[row.contact_id] = row.created_at;
        }
        setLastActivities(map);
      });
  }, [user, contacts.length]);

  const distribution = { A: 0, B: 0, C: 0 };
  contacts.forEach((c) => {
    const score = getEngagementScore(c, lastActivities[c.id]);
    distribution[score.tier]++;
  });
  const total = contacts.length || 1;

  const greeting = profile.name
    ? `${t("dashboard.hey")}, ${profile.name.split(" ")[0]} 👋`
    : user?.email
      ? `${t("dashboard.welcomeBack")} 👋`
      : `${t("dashboard.welcome")} 👋`;

  const show = (id: string) => visibleSectionIds.includes(id);

  // Nav label translation helper for quick actions
  const NAV_LABEL_KEYS: Record<string, string> = {
    scan: "nav.scan",
    card: "nav.myCard",
    calendar: "nav.calendar",
    events: "nav.events",
    contacts: "nav.contacts",
    notes: "nav.notes",
    ai: "nav.ai",
    pipeline: "nav.pipeline",
    settings: "nav.settings",
    admin: "nav.admin",
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader showFullLogo rightContent={
        <DashboardCustomizer
          sections={sections}
          setSections={setSections}
          toggleSection={toggleSection}
          applyPreset={applyPreset}
          moveSection={moveSection}
        />
      } />

      {/* Premium hero — replaces standalone greeting + share_card when both are visible */}
      {show("greeting") && show("share_card") && (
        <DashboardHero contactsCount={contacts.length} enrichedCount={enrichedCount} />
      )}

      {/* Render sections in order */}
      {sections.filter((s) => s.visible).map((section) => {
        // Skip greeting/share_card individually if hero is rendered
        if ((section.id === "greeting" || section.id === "share_card") && show("greeting") && show("share_card")) {
          return null;
        }
        switch (section.id) {
          case "greeting":
            return (
              <motion.div key="greeting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-title-1 text-foreground">{greeting}</h1>
                  <div className="flex items-center gap-2">
                    {isGuest ? (
                      <button onClick={() => navigate("/auth")} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <LogIn size={13} /> {t("action.signIn")}
                      </button>
                    ) : (
                      <ReferralShareSheet />
                    )}
                  </div>
                </div>
                <p className="text-footnote mt-1 tabular-nums">
                  <AnimatedNumber value={contacts.length} className="font-semibold text-foreground/80" /> {t("dashboard.contacts")} ·{" "}
                  <AnimatedNumber value={enrichedCount} className="font-semibold text-foreground/80" /> {t("dashboard.enriched")}
                </p>
              </motion.div>
            );

          case "share_card":
            return <ShareMyCardSection key="share_card" />;

          case "usage": {
            if (plan !== "starter") return null;
            const showUpgradePrompt = shouldShowUpgradePrompt();
            const usageBars: { label: string; field: "contacts" | "enrichments" | "notes" | "transcriptionMinutes"; used: number; limit: number; unit?: string }[] = [
              { label: t("usage.contacts"), field: "contacts", used: usage.contactsCount, limit: limits.contacts },
              { label: t("usage.enrichments"), field: "enrichments", used: usage.enrichmentsUsed, limit: limits.enrichments },
              { label: t("usage.notes"), field: "notes", used: usage.notesCreated, limit: limits.notes },
              { label: t("usage.transcription"), field: "transcriptionMinutes", used: usage.transcriptionMinutesUsed, limit: limits.transcriptionMinutes, unit: "min" },
            ];
            return (
              <motion.div key="usage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-primary" />
                    <p className="text-xs font-semibold text-foreground">{t("dashboard.starterPlanUsage")}</p>
                  </div>
                  {isIosNative() ? (
                    <IosManagePlanNotice compact />
                  ) : (
                    <button onClick={() => navigate("/pricing")} className="text-[11px] font-semibold text-primary flex items-center gap-1">
                      <Zap size={11} /> {t("dashboard.upgrade")}
                    </button>
                  )}
                </div>
                <div className="space-y-2.5">
                  {usageBars.map(({ label, field, used, limit, unit }) => {
                    const pct = usagePercent(field);
                    const isNear = pct >= UPGRADE_THRESHOLD * 100;
                    const isFull = pct >= 100;
                    return (
                      <div key={field}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
                          <span className={`text-[10px] font-semibold ${isFull ? "text-red-400" : isNear ? "text-amber-400" : "text-muted-foreground"}`}>
                            {used}/{limit}{unit ? ` ${unit}` : ""}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : isNear ? "bg-amber-400" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {showUpgradePrompt && !isIosNative() && (
                  <button
                    onClick={() => navigate("/pricing")}
                    className="mt-3 w-full rounded-xl py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-amber-900 bg-amber-400/20 border border-amber-400/30 hover:bg-amber-400/30 transition-colors"
                  >
                    <AlertTriangle size={13} className="text-amber-400" />
                    {t("dashboard.approachingLimits")}
                  </button>
                )}
                {showUpgradePrompt && isIosNative() && (
                  <div className="mt-3 w-full rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-amber-200 bg-amber-400/10 border border-amber-400/30 select-none" role="note">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                    <span>{t("dashboard.approachingLimits")} — Manage your plan at cardr.ai</span>
                  </div>
                )}
                <p className="text-[9px] text-muted-foreground mt-2 text-center">{t("dashboard.lifetimeCaps")}</p>
              </motion.div>
            );
          }

          case "health":
            if (contacts.length === 0) return null;
            return (
              <motion.div key="health" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={14} className="text-primary" />
                  <p className="text-xs font-semibold text-foreground">{t("dashboard.networkHealth")}</p>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-3 rounded-full overflow-hidden flex bg-muted">
                    {distribution.A > 0 && <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(distribution.A / total) * 100}%` }} />}
                    {distribution.B > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${(distribution.B / total) * 100}%` }} />}
                    {distribution.C > 0 && <div className="h-full bg-zinc-400 transition-all" style={{ width: `${(distribution.C / total) * 100}%` }} />}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {([
                    { tier: "A" as EngagementTier, label: t("dashboard.hot"), count: distribution.A, color: "text-emerald-500", bg: "bg-emerald-500" },
                    { tier: "B" as EngagementTier, label: t("dashboard.warm"), count: distribution.B, color: "text-amber-500", bg: "bg-amber-500" },
                    { tier: "C" as EngagementTier, label: t("dashboard.cold"), count: distribution.C, color: "text-zinc-500", bg: "bg-zinc-500" },
                  ]).map(({ label, count, color, bg }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${bg}`} />
                      <AnimatedNumber value={count} className={`text-xs font-bold ${color}`} />
                      <span className="text-2xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );

          case "quick_actions":
            return (
              <div key="quick_actions">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`grid gap-2 mb-2 ${quickActions.length <= 3 ? "grid-cols-3" : quickActions.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
                  {quickActions.map((action, i) => (
                    <button
                      key={action.id}
                      onClick={() => navigate(action.path)}
                      className={`rounded-2xl p-3 flex flex-col items-center gap-1.5 transition-all active:scale-95 ${
                        i === 0 ? "" : "card-elevated hover:border-primary/25"
                      }`}
                      style={i === 0 ? {
                        background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                        boxShadow: "var(--shadow-brand)",
                      } : undefined}
                    >
                      <action.icon size={20} className={i === 0 ? "text-primary-foreground" : "text-primary"} />
                      <span className={`text-[10px] font-semibold ${i === 0 ? "text-primary-foreground" : "text-foreground"}`}>
                        {NAV_LABEL_KEYS[action.id] ? t(NAV_LABEL_KEYS[action.id]) : action.label}
                      </span>
                    </button>
                  ))}
                </motion.div>
                {contacts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-4">
                    <QuickEmailExportButton variant="tile" label="Email contacts as CSV" className="w-full flex-row justify-center gap-2 py-2.5" />
                  </motion.div>
                )}
              </div>
            );

          case "notes_cta":
            return (
              <motion.div key="notes_cta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <FileText size={14} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground">{t("dashboard.meetingNotes")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("dashboard.meetingNotesDesc")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => navigate("/notes/record")}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors active:scale-95"
                  >
                    <Mic size={16} className="text-primary" />
                    <span className="text-[10px] font-semibold text-primary">{t("dashboard.record")}</span>
                  </button>
                  <button
                    onClick={() => navigate("/notes/new")}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors active:scale-95"
                  >
                    <PenLine size={16} className="text-foreground" />
                    <span className="text-[10px] font-semibold text-foreground">{t("dashboard.write")}</span>
                  </button>
                  <button
                    onClick={() => navigate("/notes")}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors active:scale-95"
                  >
                    <FileText size={16} className="text-foreground" />
                    <span className="text-[10px] font-semibold text-foreground">{t("dashboard.allNotes")}</span>
                  </button>
                </div>
              </motion.div>
            );

          case "ai_chat":
            return (
              <motion.div key="ai_chat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-primary" />
                  <p className="text-xs font-semibold text-foreground">{t("dashboard.aiAssistant")}</p>
                  <button onClick={() => navigate("/ai")} className="ml-auto text-[10px] font-semibold text-primary flex items-center gap-0.5">
                    {t("dashboard.fullChat")} <ArrowRight size={10} />
                  </button>
                </div>
                <AIChatSection />
              </motion.div>
            );

          case "demo_scan":
            return (
              <motion.button
                key="demo_scan"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/scan?demo=true")}
                className="w-full rounded-2xl p-3 mb-5 flex items-center gap-3 text-left card-elevated border-dashed border-primary/20 hover:border-primary/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Play size={14} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">{t("dashboard.tryDemoScan")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("dashboard.demoScanDesc")}</p>
                </div>
                <ArrowRight size={12} className="text-muted-foreground" />
              </motion.button>
            );

          case "events":
            return <DashboardEventsWidget key="events" />;

          case "recent_contacts":
            if (recentContacts.length === 0) {
              return (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                  <p className="text-callout text-muted-foreground">{t("dashboard.noContacts")}</p>
                </motion.div>
              );
            }
            return (
              <motion.div key="recent_contacts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="section-label">{t("dashboard.recentContacts")}</p>
                  <button onClick={() => navigate("/contacts")} className="text-xs text-primary font-semibold flex items-center gap-0.5">
                    {t("action.all")} <ChevronRight size={13} />
                  </button>
                </div>
                <AnimatedList
                  items={recentContacts}
                  getKey={(c) => c.id}
                  className="space-y-2"
                  staggerDelay={0.05}
                  renderItem={(contact) => {
                    const engagement = getEngagementScore(contact, lastActivities[contact.id]);
                    const lastActivity = lastActivities[contact.id];
                    let lastInteractionLabel = "";
                    try {
                      if (lastActivity) {
                        lastInteractionLabel = formatDistanceToNowStrict(parseISO(lastActivity), { addSuffix: true });
                      } else {
                        lastInteractionLabel = formatDistanceToNowStrict(parseISO(contact.scannedAt), { addSuffix: true });
                      }
                    } catch { /* ignore */ }

                    return (
                      <button onClick={() => navigate(`/contact/${contact.id}`)} className="w-full card-interactive p-3 flex items-center gap-3 text-left">
                        <div className="w-9 h-9 avatar-circle text-2xs shrink-0">
                          {contact.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-headline text-foreground truncate">{contact.name}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${engagement.bgColor} ${engagement.color}`}>
                              {engagement.tier}
                            </span>
                          </div>
                          <p className="text-2xs text-muted-foreground truncate">
                            {contact.title}{contact.company ? ` · ${contact.company}` : ""}
                            {lastInteractionLabel && (
                              <span className="text-muted-foreground/60 tabular-nums"> · {lastInteractionLabel}</span>
                            )}
                          </p>
                        </div>
                        {contact.enriched && <Sparkles size={12} className="text-emerald-500 shrink-0" />}
                      </button>
                    );
                  }}
                />
              </motion.div>
            );

          default:
            return null;
        }
      })}

      {/* Empty state when all sections hidden */}
      {sections.filter((s) => s.visible).length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">{t("dashboard.allSectionsHidden")}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
