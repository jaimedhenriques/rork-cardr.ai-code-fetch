import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { hidePaidSurfaces } from "@/lib/iosCompliance";

export type PlanType = "starter" | "pro" | "business" | "teams";

export interface PlanLimits {
  contacts: number;
  enrichments: number;
  notes: number;
  transcriptionMinutes: number;
  /** true = lifetime caps (Starter), false = monthly reset */
  lifetime: boolean;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  starter:  { contacts: 10,  enrichments: 10,  notes: 10,  transcriptionMinutes: 60,  lifetime: true },
  pro:      { contacts: -1,  enrichments: 150, notes: -1,  transcriptionMinutes: 600, lifetime: false },
  business: { contacts: -1,  enrichments: -1,  notes: -1,  transcriptionMinutes: -1,  lifetime: false },
  teams:    { contacts: -1,  enrichments: -1,  notes: -1,  transcriptionMinutes: -1,  lifetime: false },
};

export const PLAN_PRICES = {
  starter:  { monthly: 0,    annual: 0 },
  pro:      { monthly: 999,  annual: 7992 },   // $9.99/mo or $7.99/mo billed $95.88/yr
  business: { monthly: 1800, annual: 14400 },  // $18/mo or $14/mo billed $168/yr
  teams:    { monthly: 1500, annual: 12000 },   // per user: $15/mo or $12/mo
};

export const VOLUME_DISCOUNTS = [
  { minQty: 1, maxQty: 9, pct: 0 },
  { minQty: 10, maxQty: 49, pct: 10 },
  { minQty: 50, maxQty: 99, pct: 20 },
  { minQty: 100, maxQty: Infinity, pct: 30 },
];

export const getVolumeDiscount = (qty: number) =>
  VOLUME_DISCOUNTS.find((d) => qty >= d.minQty && qty <= d.maxQty)?.pct ?? 0;

/** Trigger upgrade prompt at 80% of any limit */
export const UPGRADE_THRESHOLD = 0.8;

export interface UsageData {
  enrichmentsUsed: number;
  notesCreated: number;
  transcriptionMinutesUsed: number;
  contactsCount: number;
}

export interface SubscriptionData {
  plan: PlanType;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

// Map legacy DB plan names to new plan types
const normalisePlan = (raw: string | null | undefined): PlanType => {
  if (!raw) return "starter";
  const lower = raw.toLowerCase();
  if (lower === "free") return "starter";
  if (lower === "pro_plus") return "business";
  if (lower === "pro" || lower === "business" || lower === "teams" || lower === "starter") return lower as PlanType;
  return "starter";
};

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    plan: "starter", status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: null,
  });
  const [usage, setUsage] = useState<UsageData>({
    enrichmentsUsed: 0, notesCreated: 0, transcriptionMinutesUsed: 0, contactsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Phase-1 native compliance: free-tier users on iOS/Android get unlimited
  // usage so paywall triggers never fire. Existing paid users keep their plan.
  const nativeFreeOverride = hidePaidSurfaces() && subscription.plan === "starter";
  const limits: PlanLimits = nativeFreeOverride
    ? { contacts: -1, enrichments: -1, notes: -1, transcriptionMinutes: -1, lifetime: false }
    : PLAN_LIMITS[subscription.plan];
  const isUnlimited = (field: keyof Omit<PlanLimits, "lifetime">) => limits[field] === -1;

  const canUse = useCallback((field: keyof Omit<PlanLimits, "lifetime">, current?: number) => {
    if (isUnlimited(field)) return true;
    const used = current ?? (
      field === "contacts" ? usage.contactsCount :
      field === "enrichments" ? usage.enrichmentsUsed :
      field === "notes" ? usage.notesCreated :
      usage.transcriptionMinutesUsed
    );
    return used < limits[field];
  }, [limits, usage]);

  const usagePercent = useCallback((field: keyof Omit<PlanLimits, "lifetime">) => {
    if (isUnlimited(field)) return 0;
    const used =
      field === "contacts" ? usage.contactsCount :
      field === "enrichments" ? usage.enrichmentsUsed :
      field === "notes" ? usage.notesCreated :
      usage.transcriptionMinutesUsed;
    return Math.min(Math.round((used / limits[field]) * 100), 100);
  }, [limits, usage]);

  /** Returns true if any Starter limit is at or above 80%. Always false on native. */
  const shouldShowUpgradePrompt = useCallback(() => {
    if (hidePaidSurfaces()) return false;
    if (subscription.plan !== "starter") return false;
    const fields: (keyof Omit<PlanLimits, "lifetime">)[] = ["contacts", "enrichments", "notes", "transcriptionMinutes"];
    return fields.some((f) => usagePercent(f) >= UPGRADE_THRESHOLD * 100);
  }, [subscription.plan, usagePercent]);

  const load = useCallback(async () => {
    if (!user) {
      setSubscription({ plan: "starter", status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: null });
      setUsage({ enrichmentsUsed: 0, notesCreated: 0, transcriptionMinutesUsed: 0, contactsCount: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    const [subRes, usageRes] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("usage_tracking").select("*").eq("user_id", user.id)
        .eq("period_start", new Date().toISOString().slice(0, 7) + "-01")
        .maybeSingle(),
    ]);

    if (subRes.data) {
      setSubscription({
        plan: normalisePlan(subRes.data.plan),
        status: subRes.data.status,
        cancelAtPeriodEnd: subRes.data.cancel_at_period_end || false,
        currentPeriodEnd: subRes.data.current_period_end,
      });
    }

    if (usageRes.data) {
      setUsage({
        enrichmentsUsed: usageRes.data.enrichments_used,
        notesCreated: usageRes.data.notes_created,
        transcriptionMinutesUsed: usageRes.data.transcription_minutes_used,
        contactsCount: usageRes.data.contacts_count,
      });
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for restore-purchases / Apple webhook updates so the tier
  // reflects in the UI without requiring a page reload.
  useEffect(() => {
    if (!user) return;
    const onRefresh = () => { void load(); };
    window.addEventListener("subscription:refresh", onRefresh);
    return () => window.removeEventListener("subscription:refresh", onRefresh);
  }, [user, load]);


  const incrementUsage = useCallback(async (field: "enrichments_used" | "notes_created" | "transcription_minutes_used", amount = 1) => {
    if (!user) return;
    const periodStart = new Date().toISOString().slice(0, 7) + "-01";

    const { data: existing } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("period_start", periodStart)
      .maybeSingle();

    if (existing) {
      const currentVal = (existing as any)[field] ?? 0;
      const updatePayload: any = { [field]: currentVal + amount, updated_at: new Date().toISOString() };
      await supabase.from("usage_tracking")
        .update(updatePayload)
        .eq("id", existing.id);
    } else {
      const insertPayload: any = { user_id: user.id, period_start: periodStart, [field]: amount };
      await supabase.from("usage_tracking")
        .insert(insertPayload);
    }

    setUsage((prev) => {
      const key = field === "enrichments_used" ? "enrichmentsUsed" :
        field === "notes_created" ? "notesCreated" : "transcriptionMinutesUsed";
      return { ...prev, [key]: (prev[key as keyof UsageData] as number) + amount };
    });
  }, [user]);

  return {
    subscription, usage, limits, loading,
    canUse, usagePercent, incrementUsage, shouldShowUpgradePrompt,
    refresh: load,
    isPro: subscription.plan === "pro" || subscription.plan === "business" || subscription.plan === "teams",
    isBusiness: subscription.plan === "business" || subscription.plan === "teams",
    isTeams: subscription.plan === "teams",
    plan: subscription.plan,
  };
};
