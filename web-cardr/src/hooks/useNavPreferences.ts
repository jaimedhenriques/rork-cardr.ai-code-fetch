import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import {
  ALL_NAV_ITEMS, ALL_QUICK_ACTIONS,
  DEFAULT_NAV_IDS, DEFAULT_QUICK_ACTION_IDS,
  STORAGE_KEY_NAV, STORAGE_KEY_QUICK,
  applyCenter,
  type NavItem,
} from "@/lib/nav-config";

// Shared in-memory state + subscriber pattern for cross-component reactivity
let navIdsCache: string[] = loadFromStorage(STORAGE_KEY_NAV, DEFAULT_NAV_IDS);
let quickIdsCache: string[] = loadFromStorage(STORAGE_KEY_QUICK, DEFAULT_QUICK_ACTION_IDS);
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function loadFromStorage(key: string, defaults: string[]): string[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return defaults;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getNavSnapshot() { return navIdsCache; }
function getQuickSnapshot() { return quickIdsCache; }

export function useNavPreferences() {
  const navIds = useSyncExternalStore(subscribe, getNavSnapshot);
  const quickIds = useSyncExternalStore(subscribe, getQuickSnapshot);

  const setNavIds = useCallback((ids: string[]) => {
    navIdsCache = ids;
    localStorage.setItem(STORAGE_KEY_NAV, JSON.stringify(ids));
    notify();
  }, []);

  const setQuickIds = useCallback((ids: string[]) => {
    quickIdsCache = ids;
    localStorage.setItem(STORAGE_KEY_QUICK, JSON.stringify(ids));
    notify();
  }, []);

  const navItems: NavItem[] = applyCenter(
    navIds
      .map((id) => ALL_NAV_ITEMS.find((i) => i.id === id))
      .filter(Boolean) as NavItem[]
  );

  const quickActions: NavItem[] = quickIds
    .map((id) => ALL_QUICK_ACTIONS.find((i) => i.id === id))
    .filter(Boolean) as NavItem[];

  const resetNav = useCallback(() => setNavIds(DEFAULT_NAV_IDS), [setNavIds]);
  const resetQuick = useCallback(() => setQuickIds(DEFAULT_QUICK_ACTION_IDS), [setQuickIds]);

  return { navIds, setNavIds, quickIds, setQuickIds, navItems, quickActions, resetNav, resetQuick };
}
