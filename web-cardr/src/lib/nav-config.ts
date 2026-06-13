import { ScanLine, CreditCard, CalendarDays, Flag, Users, FileText, Sparkles, Home, Settings, BarChart3, Building2, Bot, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  path: string;
  icon: LucideIcon;
  label: string;
  center?: boolean;
}

// All available items for bottom nav — center is assigned dynamically based on position
export const ALL_NAV_ITEMS: NavItem[] = [
  { id: "home", path: "/app", icon: Home, label: "Home" },
  { id: "notes", path: "/app/notes", icon: FileText, label: "Notes" },
  { id: "scan", path: "/app/scan", icon: ScanLine, label: "Scan" },
  { id: "ai", path: "/app/ai", icon: Sparkles, label: "AI" },
  { id: "agents", path: "/app/agents", icon: Bot, label: "Agents" },
  { id: "contacts", path: "/app/contacts", icon: Users, label: "Contacts" },
  { id: "calendar", path: "/app/calendar", icon: CalendarDays, label: "Calendar" },
  { id: "events", path: "/app/events", icon: Flag, label: "Events" },
  { id: "pipeline", path: "/app/pipeline", icon: BarChart3, label: "Leads" },
  { id: "settings", path: "/app/settings", icon: Settings, label: "Settings" },
  { id: "card", path: "/app/card", icon: CreditCard, label: "My Card" },
  { id: "automations", path: "/app/automations", icon: Workflow, label: "Automations" },
  { id: "admin", path: "/app/admin", icon: Building2, label: "Admin" },
];

// All available items for dashboard quick actions
export const ALL_QUICK_ACTIONS: NavItem[] = [
  { id: "scan", path: "/app/scan", icon: ScanLine, label: "Scan" },
  { id: "card", path: "/app/card", icon: CreditCard, label: "My Card" },
  { id: "calendar", path: "/app/calendar", icon: CalendarDays, label: "Calendar" },
  { id: "events", path: "/app/events", icon: Flag, label: "Events" },
  { id: "contacts", path: "/app/contacts", icon: Users, label: "Contacts" },
  { id: "notes", path: "/app/notes", icon: FileText, label: "Notes" },
  { id: "ai", path: "/app/ai", icon: Sparkles, label: "AI" },
  { id: "agents", path: "/app/agents", icon: Bot, label: "Agents" },
  { id: "pipeline", path: "/app/pipeline", icon: BarChart3, label: "Leads" },
  { id: "automations", path: "/app/automations", icon: Workflow, label: "Automations" },
  { id: "settings", path: "/app/settings", icon: Settings, label: "Settings" },
  { id: "admin", path: "/app/admin", icon: Building2, label: "Admin" },
];

export const DEFAULT_NAV_IDS = ["home", "notes", "scan", "pipeline", "contacts"];
export const DEFAULT_QUICK_ACTION_IDS = ["scan", "card", "calendar", "events", "pipeline", "notes"];

export const STORAGE_KEY_NAV = "cardscanpro_nav_items";
export const STORAGE_KEY_QUICK = "cardscanpro_quick_actions";

/**
 * Apply center flag to the middle item in the nav array.
 * This makes whichever item is in the center position the "raised" button.
 */
export function applyCenter(items: NavItem[]): NavItem[] {
  if (items.length === 0) return items;
  const midIdx = Math.floor(items.length / 2);
  return items.map((item, i) => ({
    ...item,
    center: i === midIdx,
  }));
}
