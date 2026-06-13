import { useState, useEffect, useCallback } from "react";

export interface DashboardSection {
  id: string;
  label: string;
  description: string;
  visible: boolean;
}

const ALL_SECTIONS: DashboardSection[] = [
  { id: "greeting", label: "Greeting", description: "Welcome banner with contact stats", visible: true },
  { id: "share_card", label: "Share My Card", description: "One-tap share via email, SMS, WhatsApp", visible: true },
  { id: "usage", label: "Free Plan Usage", description: "Usage bar for free tier users", visible: true },
  { id: "events", label: "Events", description: "Active event + upcoming/recent event folders", visible: true },
  { id: "notes_cta", label: "Notes Spotlight", description: "First-time notes onboarding + quick record", visible: true },
  { id: "health", label: "Network Health", description: "A/B/C engagement breakdown", visible: true },
  { id: "quick_actions", label: "Quick Actions", description: "Shortcut buttons grid", visible: true },
  { id: "ai_chat", label: "AI Chat", description: "Ask your AI assistant", visible: true },
  { id: "demo_scan", label: "Demo Scan", description: "Try a demo badge scan", visible: true },
  { id: "recent_contacts", label: "Recent Contacts", description: "Last 5 scanned contacts", visible: true },
];

export interface DashboardPreset {
  id: string;
  label: string;
  description: string;
  sectionIds: string[];
}

export const PRESETS: DashboardPreset[] = [
  {
    id: "sales",
    label: "Sales Focus",
    description: "Pipeline health, quick actions, recent leads",
    sectionIds: ["greeting", "share_card", "health", "quick_actions", "recent_contacts"],
  },
  {
    id: "networking",
    label: "Networking",
    description: "Full experience with AI chat and demo scan",
    sectionIds: ["greeting", "share_card", "usage", "notes_cta", "health", "quick_actions", "ai_chat", "demo_scan", "recent_contacts"],
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Just the essentials — greeting and contacts",
    sectionIds: ["greeting", "share_card", "quick_actions", "recent_contacts"],
  },
];

const STORAGE_KEY = "cardscanpro_dashboard_sections";

function loadSections(): DashboardSection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_SECTIONS;
    const saved: { id: string; visible: boolean }[] = JSON.parse(raw);
    const savedMap = new Map(saved.map((s) => [s.id, s]));
    const ordered: DashboardSection[] = [];
    for (const s of saved) {
      const def = ALL_SECTIONS.find((d) => d.id === s.id);
      if (def) ordered.push({ ...def, visible: s.visible });
    }
    for (const def of ALL_SECTIONS) {
      if (!savedMap.has(def.id)) ordered.push(def);
    }
    return ordered;
  } catch {
    return ALL_SECTIONS;
  }
}

function saveSections(sections: DashboardSection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sections.map((s) => ({ id: s.id, visible: s.visible }))));
}

export function useDashboardSections() {
  const [sections, setSectionsState] = useState<DashboardSection[]>(loadSections);

  const setSections = useCallback((updater: DashboardSection[] | ((prev: DashboardSection[]) => DashboardSection[])) => {
    setSectionsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveSections(next);
      return next;
    });
  }, []);

  const toggleSection = useCallback((id: string) => {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, visible: !s.visible } : s));
  }, [setSections]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSections((prev) => {
      const inPreset = preset.sectionIds
        .map((id) => prev.find((s) => s.id === id))
        .filter(Boolean) as DashboardSection[];
      const notInPreset = prev.filter((s) => !preset.sectionIds.includes(s.id));
      return [
        ...inPreset.map((s) => ({ ...s, visible: true })),
        ...notInPreset.map((s) => ({ ...s, visible: false })),
      ];
    });
  }, [setSections]);

  const moveSection = useCallback((fromIndex: number, toIndex: number) => {
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [setSections]);

  const visibleSectionIds = sections.filter((s) => s.visible).map((s) => s.id);

  return { sections, setSections, toggleSection, applyPreset, moveSection, visibleSectionIds };
}
