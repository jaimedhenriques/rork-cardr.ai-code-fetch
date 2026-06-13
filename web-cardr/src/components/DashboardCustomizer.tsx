import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, GripVertical, Eye, EyeOff, Check, X, Sparkles, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { type DashboardSection, PRESETS } from "@/hooks/useDashboardSections";
import { ALL_QUICK_ACTIONS, DEFAULT_QUICK_ACTION_IDS, type NavItem } from "@/lib/nav-config";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  sections: DashboardSection[];
  setSections: (s: DashboardSection[] | ((prev: DashboardSection[]) => DashboardSection[])) => void;
  toggleSection: (id: string) => void;
  applyPreset: (id: string) => void;
  moveSection: (from: number, to: number) => void;
}

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

const DashboardCustomizer = ({ sections, setSections, toggleSection, applyPreset, moveSection }: Props) => {
  const [open, setOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"sections" | "actions">("sections");
  const { quickIds, setQuickIds } = useNavPreferences();
  const { t } = useLanguage();

  const handlePreset = (presetId: string) => {
    applyPreset(presetId);
    const preset = PRESETS.find((p) => p.id === presetId);
    toast.success(`Applied "${preset?.label}" layout`);
  };

  // Quick action helpers
  const maxActions = 9;
  const selectedActions = quickIds
    .map((id) => ALL_QUICK_ACTIONS.find((i) => i.id === id))
    .filter(Boolean) as NavItem[];
  const unselectedActions = ALL_QUICK_ACTIONS.filter((i) => !quickIds.includes(i.id));

  const toggleAction = (id: string) => {
    if (quickIds.includes(id)) {
      if (quickIds.length <= 2) return;
      setQuickIds(quickIds.filter((i) => i !== id));
    } else {
      if (quickIds.length >= maxActions) return;
      setQuickIds([...quickIds, id]);
    }
  };

  const moveActionUp = (id: string) => {
    const idx = quickIds.indexOf(id);
    if (idx <= 0) return;
    const next = [...quickIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setQuickIds(next);
  };

  const moveActionDown = (id: string) => {
    const idx = quickIds.indexOf(id);
    if (idx < 0 || idx >= quickIds.length - 1) return;
    const next = [...quickIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setQuickIds(next);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center hover:border-primary/30 transition-colors"
        title="Customize dashboard"
      >
        <Settings2 size={15} className="text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-md card-elevated p-5 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Settings2 size={15} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{t("dashboardCustomizer.title")}</h3>
                </div>
                <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                  <X size={13} className="text-muted-foreground" />
                </button>
              </div>

              {/* Tab toggle */}
              <div className="flex items-center bg-secondary rounded-lg p-0.5 mb-5">
                {(["sections", "actions"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {tab === "sections" ? t("dashboardCustomizer.sections") : t("dashboardCustomizer.quickActions")}
                  </button>
                ))}
              </div>

              {activeTab === "sections" ? (
                <>
                  {/* Presets */}
                  <div className="mb-5">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2.5">{t("dashboardCustomizer.layoutPresets")}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handlePreset(preset.id)}
                          className="card-elevated p-3 text-left hover:border-primary/30 transition-colors group"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles size={11} className="text-primary" />
                            <span className="text-[11px] font-semibold text-foreground">{preset.label}</span>
                          </div>
                          <p className="text-[9px] text-muted-foreground leading-snug">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual toggle + reorder */}
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2.5">{t("dashboardCustomizer.sections")}</p>
                    <div className="space-y-1.5">
                      {sections.map((section, index) => (
                        <div
                          key={section.id}
                          draggable
                          onDragStart={() => setDragIndex(index)}
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={() => {
                            if (dragIndex !== null && dragIndex !== index) {
                              moveSection(dragIndex, index);
                            }
                            setDragIndex(null);
                          }}
                          onDragEnd={() => setDragIndex(null)}
                          className={cn(
                            "flex items-center gap-2.5 p-2.5 rounded-xl bg-secondary/40 transition-all cursor-grab active:cursor-grabbing",
                            dragIndex === index && "opacity-50",
                            !section.visible && "opacity-50"
                          )}
                        >
                          <GripVertical size={14} className="text-muted-foreground/40 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{section.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{section.description}</p>
                          </div>
                          <button
                            onClick={() => toggleSection(section.id)}
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                              section.visible ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground/40"
                            )}
                          >
                            {section.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Quick Actions reorder */}
                  <p className="text-[10px] text-muted-foreground mb-3">
                    {t("dashboardCustomizer.reorderHint").replace("{max}", String(maxActions))}
                  </p>

                  {/* Selected actions */}
                  {selectedActions.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">{t("navCustomizer.active")}</p>
                      <div className="space-y-1">
                        {selectedActions.map((item, idx) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 rounded-xl p-2.5 bg-primary/10 border border-primary/30"
                            >
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={() => moveActionUp(item.id)}
                                  disabled={idx === 0}
                                  className="p-0.5 rounded hover:bg-primary/20 disabled:opacity-20 transition-colors"
                                >
                                  <ChevronUp size={12} className="text-primary" />
                                </button>
                                <button
                                  onClick={() => moveActionDown(item.id)}
                                  disabled={idx === selectedActions.length - 1}
                                  className="p-0.5 rounded hover:bg-primary/20 disabled:opacity-20 transition-colors"
                                >
                                  <ChevronDown size={12} className="text-primary" />
                                </button>
                              </div>
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/20">
                                <Icon size={16} className="text-primary" />
                              </div>
                              <span className="text-sm font-medium flex-1 text-left text-foreground">
                                {NAV_LABEL_KEYS[item.id] ? t(NAV_LABEL_KEYS[item.id]) : item.label}
                              </span>
                              <button
                                onClick={() => toggleAction(item.id)}
                                className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                              >
                                <Check size={12} className="text-primary-foreground" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Unselected actions */}
                  {unselectedActions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">{t("navCustomizer.available")}</p>
                      <div className="space-y-1">
                        {unselectedActions.map((item) => {
                          const Icon = item.icon;
                          const disabled = quickIds.length >= maxActions;
                          return (
                            <button
                              key={item.id}
                              onClick={() => toggleAction(item.id)}
                              disabled={disabled}
                              className={`w-full flex items-center gap-3 rounded-xl p-2.5 transition-all ${
                                disabled
                                  ? "bg-secondary/30 opacity-40 cursor-not-allowed"
                                  : "bg-secondary/60 hover:bg-secondary"
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-background/60">
                                <Icon size={16} className="text-muted-foreground" />
                              </div>
                              <span className="text-sm font-medium flex-1 text-left text-muted-foreground">
                                {NAV_LABEL_KEYS[item.id] ? t(NAV_LABEL_KEYS[item.id]) : item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Reset */}
                  <button
                    onClick={() => setQuickIds(DEFAULT_QUICK_ACTION_IDS)}
                    className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                  >
                    <RotateCcw size={12} /> {t("navCustomizer.resetDefaults")}
                  </button>
                </>
              )}

              <button onClick={() => setOpen(false)} className="btn-primary w-full mt-5 flex items-center justify-center gap-2 text-sm">
                <Check size={14} /> {t("dashboardCustomizer.done")}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DashboardCustomizer;
