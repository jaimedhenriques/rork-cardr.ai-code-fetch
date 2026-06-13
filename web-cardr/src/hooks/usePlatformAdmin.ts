import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  company: string;
  title: string;
  created_at: string;
  referral_code?: string | null;
}

export interface PlatformSubscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  created_at: string;
  stripe_customer_id: string | null;
}

export interface PlatformUsage {
  id: string;
  user_id: string;
  period_start: string;
  enrichments_used: number;
  notes_created: number;
  transcription_minutes_used: number;
  contacts_count: number;
}

export interface PlatformOrg {
  id: string;
  name: string;
  slug: string;
  max_seats: number | null;
  created_at: string;
  member_count?: number;
}

export interface PlatformLicenseOrder {
  id: string;
  org_id: string;
  plan: string;
  quantity: number;
  discount_pct: number;
  unit_price_cents: number;
  total_cents: number;
  status: string;
  created_at: string;
  org_name?: string;
}

export interface PlatformCoupon {
  id: string;
  code: string;
  discount_pct: number;
  duration: string;
  duration_months: number | null;
  applies_to: string[];
  expires_at: string | null;
  active: boolean;
  max_uses: number | null;
  use_case: string | null;
  created_at: string;
  usage_count?: number;
}

export interface PlatformReferral {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  referral_code: string;
  status: string;
  created_at: string;
  converted_at: string | null;
}

export interface PlatformCommission {
  id: string;
  referrer_id: string;
  referral_id: string;
  amount_cents: number;
  status: string;
  flagged: boolean;
  flag_reason: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface ReferrerLeaderboard {
  referrer_id: string;
  referrer_name: string;
  referrer_email: string;
  total_referrals: number;
  active_referrals: number;
  total_earned_cents: number;
  pending_cents: number;
}

export function usePlatformAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<PlatformSubscription[]>([]);
  const [usageData, setUsageData] = useState<PlatformUsage[]>([]);
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [licenseOrders, setLicenseOrders] = useState<PlatformLicenseOrder[]>([]);
  const [coupons, setCoupons] = useState<PlatformCoupon[]>([]);
  const [referrals, setReferrals] = useState<PlatformReferral[]>([]);
  const [commissions, setCommissions] = useState<PlatformCommission[]>([]);
  const [leaderboard, setLeaderboard] = useState<ReferrerLeaderboard[]>([]);

  const checkAdmin = useCallback(async () => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    const { data } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    setIsAdmin(!!data);
    setLoading(false);
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user || !isAdmin) return;

    const [profilesRes, subsRes, usageRes, orgsRes, ordersRes, couponsRes, couponUsageRes, referralsRes, commissionsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, name, company, title, created_at, referral_code").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("usage_tracking").select("*").order("period_start", { ascending: false }),
      supabase.from("organizations").select("*").order("created_at", { ascending: false }),
      supabase.from("license_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("coupon_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("coupon_usage").select("coupon_id"),
      supabase.from("referrals").select("*").order("created_at", { ascending: false }),
      supabase.from("referral_commissions").select("*").order("created_at", { ascending: false }),
    ]);

    const profilesList = profilesRes.data || [];
    setUsers(profilesList);
    if (subsRes.data) setSubscriptions(subsRes.data);
    if (usageRes.data) setUsageData(usageRes.data);

    if (orgsRes.data) {
      const orgIds = orgsRes.data.map(o => o.id);
      const { data: members } = await supabase
        .from("org_members")
        .select("org_id")
        .in("org_id", orgIds);
      const countMap = new Map<string, number>();
      (members || []).forEach(m => countMap.set(m.org_id, (countMap.get(m.org_id) || 0) + 1));
      setOrgs(orgsRes.data.map(o => ({ ...o, member_count: countMap.get(o.id) || 0 })));
    }

    if (ordersRes.data && orgsRes.data) {
      const orgMap = new Map(orgsRes.data.map(o => [o.id, o.name]));
      setLicenseOrders(ordersRes.data.map(o => ({ ...o, org_name: orgMap.get(o.org_id) || "Unknown" })));
    }

    // Coupons with usage counts
    if (couponsRes.data) {
      const usageCounts = new Map<string, number>();
      (couponUsageRes.data || []).forEach(u => usageCounts.set(u.coupon_id, (usageCounts.get(u.coupon_id) || 0) + 1));
      setCoupons(couponsRes.data.map(c => ({ ...c, usage_count: usageCounts.get(c.id) || 0 })));
    }

    // Referrals
    const referralList = referralsRes.data || [];
    setReferrals(referralList);

    // Commissions
    const commissionList = commissionsRes.data || [];
    setCommissions(commissionList);

    // Build leaderboard
    const profileMap = new Map(profilesList.map(p => [p.id, p]));
    const referrerMap = new Map<string, ReferrerLeaderboard>();
    referralList.forEach(r => {
      if (!referrerMap.has(r.referrer_id)) {
        const profile = profileMap.get(r.referrer_id);
        referrerMap.set(r.referrer_id, {
          referrer_id: r.referrer_id,
          referrer_name: profile?.name || "Unknown",
          referrer_email: profile?.email || "",
          total_referrals: 0,
          active_referrals: 0,
          total_earned_cents: 0,
          pending_cents: 0,
        });
      }
      const entry = referrerMap.get(r.referrer_id)!;
      entry.total_referrals++;
      if (r.status === "active") entry.active_referrals++;
    });
    commissionList.forEach(c => {
      const entry = referrerMap.get(c.referrer_id);
      if (entry) {
        entry.total_earned_cents += c.amount_cents;
        if (c.status === "pending") entry.pending_cents += c.amount_cents;
      }
    });
    const sorted = Array.from(referrerMap.values()).sort((a, b) => b.total_earned_cents - a.total_earned_cents);
    setLeaderboard(sorted);
  }, [user, isAdmin]);

  useEffect(() => { checkAdmin(); }, [checkAdmin]);
  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin, loadData]);

  // Stats
  const totalUsers = users.length;
  const totalOrgs = orgs.length;
  const paidUsers = subscriptions.filter(s => s.plan !== "free" && s.plan !== "starter" && s.status === "active").length;
  const totalRevenue = licenseOrders
    .filter(o => o.status === "paid")
    .reduce((sum, o) => sum + o.total_cents, 0);

  // Referral stats
  const totalCommissionsOwed = commissions
    .filter(c => c.status === "pending")
    .reduce((sum, c) => sum + c.amount_cents, 0);
  const flaggedCommissions = commissions.filter(c => c.flagged);

  const changeUserPlan = useCallback(async (userId: string, newPlan: "starter" | "pro" | "business" | "teams") => {
    const existing = subscriptions.find(s => s.user_id === userId);
    if (existing) {
      await supabase.from("subscriptions").update({ plan: newPlan, status: "active", updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("subscriptions").insert({ user_id: userId, plan: newPlan, status: "active" });
    }
    await loadData();
  }, [subscriptions, loadData]);

  const toggleCoupon = useCallback(async (couponId: string, active: boolean) => {
    await supabase.from("coupon_codes").update({ active, updated_at: new Date().toISOString() }).eq("id", couponId);
    await loadData();
  }, [loadData]);

  const deleteCoupon = useCallback(async (couponId: string) => {
    await supabase.from("coupon_codes").delete().eq("id", couponId);
    await loadData();
  }, [loadData]);

  const createCoupon = useCallback(async (coupon: {
    code: string;
    discount_pct: number;
    duration: string;
    duration_months: number | null;
    applies_to: string[];
    expires_at: string | null;
    max_uses: number | null;
    use_case: string | null;
  }) => {
    const { error } = await supabase.from("coupon_codes").insert({
      code: coupon.code.toUpperCase(),
      discount_pct: coupon.discount_pct,
      duration: coupon.duration,
      duration_months: coupon.duration_months,
      applies_to: coupon.applies_to,
      expires_at: coupon.expires_at,
      max_uses: coupon.max_uses,
      use_case: coupon.use_case,
      active: true,
    });
    if (error) throw error;
    await loadData();
  }, [loadData]);

  return {
    isAdmin, loading, users, subscriptions, usageData, orgs, licenseOrders,
    coupons, referrals, commissions, leaderboard,
    totalUsers, totalOrgs, paidUsers, totalRevenue,
    totalCommissionsOwed, flaggedCommissions,
    reload: loadData, changeUserPlan, toggleCoupon, deleteCoupon, createCoupon,
  };
}
