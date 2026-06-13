/**
 * Hybrid feature flags: ship safe static defaults in code, then optionally
 * override at runtime from `public.feature_flags`. One `native` flag covers
 * iOS+Android; web stays separate.
 *
 * Defense-in-depth: all consumers should treat flags as advisory and still
 * fail safe if a code path is reached on a disabled platform.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNative, tap } from "@/lib/native";

export type FeatureKey =
  | "twilioDialer"
  | "pipedreamIntegrations"
  | "agents"
  | "automations"
  | "pipeline"
  | "integrations"
  | "analytics"
  | "mcpTools"
  | "proposals"
  | "meetingRecorder";
export type FlagPlatform = "web" | "native";

export interface FlagState {
  enabled: boolean;
  reason?: string;
}

interface FlagConfig {
  web: FlagState;
  native: FlagState;
}

/**
 * Phase-1 native build ships free-tier-only and gates anything not 100%
 * production-ready so App Store reviewers never hit a broken flow.
 */
export const DEFAULT_FLAGS: Record<FeatureKey, FlagConfig> = {
  twilioDialer: {
    web: { enabled: true },
    native: { enabled: false, reason: "Phone calling is in review for the mobile app." },
  },
  pipedreamIntegrations: {
    web: { enabled: true },
    native: { enabled: false, reason: "Long-tail integrations are coming to mobile soon." },
  },
  agents: {
    web: { enabled: true },
    native: { enabled: false, reason: "AI Agents are launching on mobile in a future update." },
  },
  automations: {
    web: { enabled: true },
    native: { enabled: false, reason: "Automated sequences are coming to mobile soon." },
  },
  pipeline: {
    web: { enabled: true },
    native: { enabled: false, reason: "The full pipeline board is coming to mobile soon." },
  },
  integrations: {
    web: { enabled: true },
    native: { enabled: false, reason: "Manage integrations from cardr.ai on the web for now." },
  },
  analytics: {
    web: { enabled: true },
    native: { enabled: false, reason: "Detailed analytics are coming to mobile soon." },
  },
  mcpTools: {
    web: { enabled: true },
    native: { enabled: false, reason: "MCP tools are managed from the web app." },
  },
  proposals: {
    web: { enabled: true },
    native: { enabled: false, reason: "Proposal builder is coming to mobile soon." },
  },
  meetingRecorder: {
    web: { enabled: true },
    native: { enabled: true },
  },
};

const STORAGE_KEY = "cardr.featureFlags.v1";

type RemoteRow = {
  key: string;
  platform: FlagPlatform;
  enabled: boolean;
  reason: string | null;
};
type RemoteOverrides = Partial<Record<FeatureKey, Partial<FlagConfig>>>;

let remoteCache: RemoteOverrides = loadCache();
let remoteLoaded = false;
const listeners = new Set<() => void>();

function loadCache(): RemoteOverrides {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RemoteOverrides) : {};
  } catch {
    return {};
  }
}

function saveCache(v: RemoteOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* quota / private mode — ignore */
  }
}

function currentPlatform(): FlagPlatform {
  return isNative() ? "native" : "web";
}

function resolve(key: FeatureKey): FlagState & { platform: FlagPlatform } {
  const platform = currentPlatform();
  const base = DEFAULT_FLAGS[key][platform];
  const override = remoteCache[key]?.[platform];
  const merged: FlagState = override
    ? {
        enabled: override.enabled ?? base.enabled,
        reason: override.reason ?? base.reason,
      }
    : base;
  return { ...merged, platform };
}

export function isFeatureEnabled(key: FeatureKey): boolean {
  return resolve(key).enabled;
}

export function getFeatureReason(key: FeatureKey): string | undefined {
  return resolve(key).reason;
}

/** Background refresh of remote overrides. Safe to call multiple times. */
export async function refreshFeatureFlags(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, platform, enabled, reason");
    if (error || !data) return;
    const next: RemoteOverrides = {};
    for (const row of data as RemoteRow[]) {
      const key = row.key as FeatureKey;
      if (!(key in DEFAULT_FLAGS)) continue;
      next[key] = next[key] ?? {};
      (next[key] as FlagConfig)[row.platform] = {
        enabled: row.enabled,
        reason: row.reason ?? undefined,
      };
    }
    remoteCache = next;
    remoteLoaded = true;
    saveCache(next);
    listeners.forEach((l) => l());
  } catch {
    /* offline — keep cached values */
  }
}

/** React hook with cached-first, refresh-in-background semantics. */
export function useFeatureFlag(key: FeatureKey): FlagState & { platform: FlagPlatform } {
  const [, force] = useState(0);
  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    listeners.add(rerender);
    if (!remoteLoaded) void refreshFeatureFlags();
    return () => {
      listeners.delete(rerender);
    };
  }, []);
  return resolve(key);
}

/** Show the standard "Coming soon" toast + light haptic. */
export function notifyComingSoon(reason?: string) {
  toast("Coming soon on mobile", {
    description: reason,
    duration: 3500,
  });
  void tap();
}
