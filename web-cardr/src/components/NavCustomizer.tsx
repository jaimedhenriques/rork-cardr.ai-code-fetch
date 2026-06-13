import { useState } from "react";
import { Check, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { ALL_NAV_ITEMS, ALL_QUICK_ACTIONS, DEFAULT_NAV_IDS, DEFAULT_QUICK_ACTION_IDS, type NavItem } from "@/lib/nav-config";
import { useLanguage } from "@/context/LanguageContext";

const NAV_LABEL_KEYS: Record<string, string> = {
  home: "nav.home",
  notes: "nav.notes",
  scan: "nav.scan",
  ai: "nav.ai",
  contacts: "nav.contacts",
  calendar: "nav.calendar",
  events: "nav.events",
  pipeline: "nav.pipeline",
  settings: "nav.settings",
  card: "nav.myCard",
  admin: "nav.admin",
};

interface NavCustomizerProps {
  navIds: string[];
  setNavIds: (ids: string[]) => void;
  quickIds: string[];
  setQuickIds: (ids: string[]) => void;
}

const NavCustomizer = ({ navIds, setNavIds, quickIds, setQuickIds }: NavCustomizerProps) => {
  const [activeTab, setActiveTab] = useState<"bottom" | "home">("bottom");
  const { t } = useLanguage();

  const allItems = activeTab === "bottom" ? ALL_NAV_ITEMS : ALL_QUICK_ACTIONS;
  const selectedIds = activeTab === "bottom" ? navIds : quickIds;
  const setSelectedIds = activeTab === "bottom" ? setNavIds : setQuickIds;
  const defaults = activeTab === "bottom" ? DEFAULT_NAV_IDS : DEFAULT_QUICK_ACTION_IDS;
  const maxItems = activeTab === "bottom" ? 5 : 9;

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 2) return;
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      if (selectedIds.length >= maxItems) return;
      setSelectedIds([...selectedIds, id]);
    }
  };

  const moveUp = (id: string) => {
    const idx = selectedIds.indexOf(id);
    if (idx <= 0) return;
    const next = [...selectedIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSelectedIds(next);
  };

  const moveDown = (id: string) => {
    const idx = selectedIds.indexOf(id);
    if (idx < 0 || idx >= selectedIds.length - 1) return;
    const next = [...selectedIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setSelectedIds(next);
  };

  const selectedItems = selectedIds
    .map((id) => allItems.find((i) => i.id === id))
    .filter(Boolean) as NavItem[];
  const unselectedItems = allItems.filter((i) => !selectedIds.includes(i.id));

  const getLabel = (item: NavItem) => NAV_LABEL_KEYS[item.id] ? t(NAV_LABEL_KEYS[item.id]) : item.label;

  return (
    <div>
      {/* Tab toggle */}
      <div className="flex items-center bg-secondary rounded-lg p-0.5 mb-4">
        {(["bottom", "home"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            {tab === "bottom" ? t("navCustomizer.bottomNav") : t("navCustomizer.homeActions")}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mb-1">
        {activeTab === "bottom"
          ? t("navCustomizer.chooseTabsHint").replace("{max}", String(maxItems))
          : t("navCustomizer.chooseActionsHint").replace("{max}", String(maxItems))}
      </p>
      {activeTab === "bottom" && selectedItems.length >= 3 && (
        <p className="text-[10px] text-primary font-medium mb-3">
          🎯 "{getLabel(selectedItems[Math.floor(selectedItems.length / 2)])}" {t("navCustomizer.centerButton")}
        </p>
      )}

      {/* Selected items (reorderable) */}
      {selectedItems.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">{t("navCustomizer.active")}</p>
          <div className="space-y-1">
            {selectedItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl p-2.5 bg-primary/10 border border-primary/30"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUp(item.id)}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-primary/20 disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp size={12} className="text-primary" />
                    </button>
                    <button
                      onClick={() => moveDown(item.id)}
                      disabled={idx === selectedItems.length - 1}
                      className="p-0.5 rounded hover:bg-primary/20 disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown size={12} className="text-primary" />
                    </button>
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/20">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <span className="text-sm font-medium flex-1 text-left text-foreground">
                    {getLabel(item)}
                  </span>
                  <button
                    onClick={() => toggle(item.id)}
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

      {/* Unselected items */}
      {unselectedItems.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">{t("navCustomizer.available")}</p>
          <div className="space-y-1">
            {unselectedItems.map((item) => {
              const Icon = item.icon;
              const disabled = selectedIds.length >= maxItems;
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
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
                    {getLabel(item)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={() => setSelectedIds(defaults)}
        className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
      >
        <RotateCcw size={12} /> {t("navCustomizer.resetDefaults")}
      </button>
    </div>
  );
};

export default NavCustomizer;
