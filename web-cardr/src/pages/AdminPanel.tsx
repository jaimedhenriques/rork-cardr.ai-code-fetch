import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2, Users, Mail, Shield, Globe, Plus, Trash2, Crown, UserCog,
  User, Check, X, Loader2, Copy, Settings2, Link, ShieldCheck, AlertTriangle,
  BarChart3, CreditCard, TrendingUp, Activity, Paintbrush, Search, Filter, UserPlus, UserMinus,
  Tag, Gift, Award, Pause, Play, Percent, DollarSign, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import BrandingEditor from "@/components/BrandingEditor";
import TypecheckPanel from "@/components/admin/TypecheckPanel";

const ROLE_LABELS: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-400" },
  admin: { label: "Admin", icon: ShieldCheck, color: "text-primary" },
  member: { label: "Member", icon: User, color: "text-muted-foreground" },
};

/* ─── PLATFORM ADMIN DASHBOARD ─── */
const PLAN_OPTIONS: { value: "starter" | "pro" | "business" | "teams"; label: string }[] = [
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "teams", label: "Teams" },
];

const PlatformDashboard = () => {
  const navigate = useNavigate();
  const {
    users, subscriptions, usageData, orgs, licenseOrders,
    coupons, referrals, commissions, leaderboard,
    totalUsers, totalOrgs, paidUsers, totalRevenue,
    totalCommissionsOwed, flaggedCommissions,
    changeUserPlan, toggleCoupon, deleteCoupon, createCoupon, reload,
  } = usePlatformAdmin();
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");

  const [tab, setTab] = useState<"users" | "orgs" | "usage" | "licenses" | "revenue" | "coupons" | "referrals" | "fraud" | "typecheck">("users");
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: "", discount_pct: 20, duration: "once", duration_months: 1, applies_to: ["pro", "business"] as string[], expires_at: "", max_uses: "", use_case: "" });
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const [togglingCoupon, setTogglingCoupon] = useState<string | null>(null);

  const subMap = new Map(subscriptions.map(s => [s.user_id, s]));
  const usageMap = new Map(usageData.map(u => [u.user_id, u]));

  const filteredUsers = useMemo(() => {
    let result = users;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.company || "").toLowerCase().includes(q)
      );
    }
    if (planFilter !== "all") {
      result = result.filter(u => {
        const sub = subMap.get(u.id);
        const plan = sub?.plan || "starter";
        return plan === planFilter;
      });
    }
    return result;
  }, [users, searchQuery, planFilter, subMap]);

  // SaaS metrics
  const PLAN_PRICES: Record<string, number> = { starter: 0, free: 0, pro: 9.99, business: 18, teams: 15 };
  const activeSubs = subscriptions.filter(s => s.status === "active");
  const mrr = activeSubs.reduce((sum, s) => sum + (PLAN_PRICES[s.plan] || 0), 0);
  const arr = mrr * 12;
  const cancelledSubs = subscriptions.filter(s => s.status === "canceled" || s.cancel_at_period_end);
  const churnRate = activeSubs.length > 0 ? (cancelledSubs.length / (activeSubs.length + cancelledSubs.length)) * 100 : 0;
  const arpu = totalUsers > 0 ? mrr / totalUsers : 0;
  const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;
  const avgLifetimeMonths = churnRate > 0 ? 100 / churnRate : 36;
  const ltv = arpu * avgLifetimeMonths;

  // Plan distribution
  const planDist: Record<string, number> = {};
  activeSubs.forEach(s => { planDist[s.plan] = (planDist[s.plan] || 0) + 1; });

  // New users last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const newUsersLast30 = users.filter(u => u.created_at >= thirtyDaysAgo).length;
  const newPaidLast30 = subscriptions.filter(s => s.created_at >= thirtyDaysAgo && s.plan !== "free" && s.plan !== "starter" && s.status === "active").length;

  const stats = [
    { label: "MRR", value: `$${mrr.toFixed(0)}`, icon: TrendingUp, color: "text-green-400" },
    { label: "Paid Users", value: paidUsers, icon: CreditCard, color: "text-amber-400" },
    { label: "Total Users", value: totalUsers, icon: Users, color: "text-primary" },
    { label: "Organizations", value: totalOrgs, icon: Building2, color: "text-emerald-400" },
  ];

  const tabs = [
    { id: "revenue" as const, label: "Revenue", icon: TrendingUp },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "coupons" as const, label: "Coupons", icon: Tag },
    { id: "referrals" as const, label: "Referrals", icon: Gift },
    { id: "fraud" as const, label: "Fraud", icon: AlertTriangle },
    { id: "orgs" as const, label: "Orgs", icon: Building2 },
    { id: "usage" as const, label: "Usage", icon: BarChart3 },
    { id: "licenses" as const, label: "Licenses", icon: CreditCard },
    { id: "typecheck" as const, label: "Type-check", icon: Activity },
  ];

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          <h1 className="text-xl font-display font-bold text-foreground">Super Admin</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Platform-wide overview</p>
      </motion.div>

      {/* Stats grid */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
        className="grid grid-cols-2 gap-2 mb-4">
        {stats.map(s => (
          <div key={s.label} className="card-elevated p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon size={12} className={s.color} />
              <span className="text-[10px] text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.025 }}
        className="mb-4"
      >
        <button
          onClick={() => navigate("/app/admin/email-sender")}
          className="w-full card-elevated p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Mail size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Email sender domain</p>
            <p className="text-[11px] text-muted-foreground truncate">
              Verify your Resend domain & set the From address used for exports
            </p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
        className="flex gap-1 mb-4 bg-secondary/60 rounded-xl p-1 overflow-x-auto no-scrollbar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              "shrink-0 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap",
              tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            <Icon size={12} />
            {label}
          </button>
        ))}
      </motion.div>

      {/* Revenue tab */}
      {tab === "revenue" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Key SaaS Metrics */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "MRR", value: `$${mrr.toFixed(2)}`, sub: "Monthly Recurring Revenue", color: "text-green-400" },
              { label: "ARR", value: `$${arr.toFixed(0)}`, sub: "Annual Recurring Revenue", color: "text-emerald-400" },
              { label: "Churn Rate", value: `${churnRate.toFixed(1)}%`, sub: `${cancelledSubs.length} churned`, color: churnRate > 10 ? "text-red-400" : "text-amber-400" },
              { label: "ARPU", value: `$${arpu.toFixed(2)}`, sub: "Avg Revenue Per User", color: "text-primary" },
              { label: "LTV", value: `$${ltv.toFixed(0)}`, sub: `~${avgLifetimeMonths.toFixed(0)}mo avg lifetime`, color: "text-violet-400" },
              { label: "Conversion", value: `${conversionRate.toFixed(1)}%`, sub: `${paidUsers} of ${totalUsers} users`, color: "text-cyan-400" },
            ].map(m => (
              <div key={m.label} className="card-elevated p-3">
                <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[11px] font-semibold text-foreground">{m.label}</p>
                <p className="text-[9px] text-muted-foreground">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Plan Distribution */}
          <div className="card-elevated p-4">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-3">Plan Distribution</p>
            <div className="space-y-2">
              {Object.entries(PLAN_PRICES).filter(([plan]) => plan !== "free").map(([plan, price]) => {
                const count = planDist[plan] || 0;
                const pct = activeSubs.length > 0 ? (count / activeSubs.length) * 100 : 0;
                const planMrr = count * price;
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground capitalize">{plan}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{count} users</span>
                        <span className="text-[10px] font-semibold text-green-400">${planMrr.toFixed(0)}/mo</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Growth */}
          <div className="card-elevated p-4">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-3">Last 30 Days</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "New Users", value: newUsersLast30 },
                { label: "New Paid", value: newPaidLast30 },
                { label: "License Rev", value: `$${(totalRevenue / 100).toFixed(0)}` },
              ].map(g => (
                <div key={g.label} className="text-center">
                  <p className="text-lg font-bold text-foreground">{g.value}</p>
                  <p className="text-[9px] text-muted-foreground">{g.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {tab === "users" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {/* Search & Filter */}
          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, company…"
                className="input-field pl-9 text-xs h-9"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                  <X size={10} className="text-muted-foreground" />
                </button>
              )}
            </div>
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="text-[11px] font-semibold bg-secondary text-foreground rounded-xl px-3 h-9 border-0 outline-none cursor-pointer"
            >
              <option value="all">All Plans</option>
              {PLAN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <p className="section-label mb-2">{filteredUsers.length} {filteredUsers.length !== users.length ? `of ${users.length} ` : ""}Users</p>
          {filteredUsers.map(u => {
            const sub = subMap.get(u.id);
            const plan = (sub?.plan || "starter") as "starter" | "pro" | "business" | "teams";
            const isChanging = changingPlan === u.id;

            const handlePlanChange = async (newPlan: "starter" | "pro" | "business" | "teams") => {
              if (newPlan === plan) return;
              setChangingPlan(u.id);
              try {
                await changeUserPlan(u.id, newPlan);
                toast.success(`${u.name || u.email} → ${newPlan.toUpperCase()}`);
              } catch { toast.error("Failed to change plan"); }
              finally { setChangingPlan(null); }
            };

            return (
              <div key={u.id} className="card-elevated p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 avatar-circle text-[10px] shrink-0">
                    {(u.name || u.email || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{u.name || "No name"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <select
                    value={plan}
                    onChange={e => handlePlanChange(e.target.value as any)}
                    disabled={isChanging}
                    className={cn(
                      "text-[10px] font-bold uppercase rounded-lg px-2 py-1 border-0 cursor-pointer transition-colors",
                      "bg-secondary text-foreground focus:ring-1 focus:ring-primary outline-none",
                      isChanging && "opacity-50 cursor-wait"
                    )}
                  >
                    {PLAN_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {u.company && <p className="text-[9px] text-muted-foreground mt-1 ml-11 truncate">{u.company}</p>}
              </div>
            );
          })}
          {filteredUsers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              {searchQuery || planFilter !== "all" ? "No users match your filters" : "No users found"}
            </p>
          )}
        </motion.div>
      )}

      {/* Orgs tab */}
      {tab === "orgs" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="section-label mb-2">{orgs.length} Organizations</p>
          {orgs.map(o => (
            <div key={o.id} className="card-elevated p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{o.name}</p>
                <p className="text-[10px] text-muted-foreground">/{o.slug}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-foreground">{o.member_count}/{o.max_seats ?? "∞"}</p>
                <p className="text-[9px] text-muted-foreground">seats</p>
              </div>
            </div>
          ))}
          {orgs.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No organizations</p>}
        </motion.div>
      )}

      {/* Usage tab */}
      {tab === "usage" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="section-label mb-2">Current Period Usage</p>
          {usageData.map(u => {
            const profile = users.find(p => p.id === u.user_id);
            return (
              <div key={u.id} className="card-elevated p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={12} className="text-primary" />
                  <p className="text-xs font-semibold text-foreground truncate flex-1">
                    {profile?.name || profile?.email || u.user_id.slice(0, 8)}
                  </p>
                  <span className="text-[9px] text-muted-foreground">{u.period_start}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Contacts", value: u.contacts_count },
                    { label: "Enrichments", value: u.enrichments_used },
                    { label: "Notes", value: u.notes_created },
                    { label: "Trans. min", value: u.transcription_minutes_used },
                  ].map(m => (
                    <div key={m.label} className="text-center">
                      <p className="text-sm font-bold text-foreground">{m.value}</p>
                      <p className="text-[9px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {usageData.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No usage data yet</p>}
        </motion.div>
      )}

      {/* Licenses tab */}
      {tab === "licenses" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="section-label mb-2">{licenseOrders.length} License Orders</p>
          {licenseOrders.map(o => (
            <div key={o.id} className="card-elevated p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-foreground">{o.org_name}</p>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  o.status === "paid" ? "bg-green-500/10 text-green-400" :
                  o.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                  "bg-muted text-muted-foreground"
                )}>{o.status}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{o.quantity}× {o.plan.replace("_", " ")}</span>
                {o.discount_pct > 0 && <span className="text-primary font-semibold">-{o.discount_pct}%</span>}
                <span className="ml-auto font-semibold text-foreground">${(o.total_cents / 100).toFixed(2)}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">{new Date(o.created_at).toLocaleDateString()}</p>
            </div>
          ))}
          {licenseOrders.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No license orders</p>}
        </motion.div>
      )}

      {tab === "coupons" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">{coupons.length} Coupon Codes</p>
            <button
              onClick={() => setShowCreateCoupon(!showCreateCoupon)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all",
                showCreateCoupon ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"
              )}
            >
              {showCreateCoupon ? <X size={12} /> : <Plus size={12} />}
              {showCreateCoupon ? "Cancel" : "New"}
            </button>
          </div>

          {showCreateCoupon && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="card-elevated p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">Create Coupon Code</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Code</label>
                  <input
                    value={newCoupon.code}
                    onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="LAUNCH50"
                    className="input-field text-xs mt-0.5 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Discount %</label>
                  <input
                    type="number" min={1} max={100}
                    value={newCoupon.discount_pct}
                    onChange={e => setNewCoupon(p => ({ ...p, discount_pct: Number(e.target.value) }))}
                    className="input-field text-xs mt-0.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Duration</label>
                  <select
                    value={newCoupon.duration}
                    onChange={e => setNewCoupon(p => ({ ...p, duration: e.target.value }))}
                    className="input-field text-xs mt-0.5"
                  >
                    <option value="once">Once (1 month)</option>
                    <option value="repeating">Repeating</option>
                    <option value="forever">Forever</option>
                  </select>
                </div>
                {newCoupon.duration === "repeating" && (
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">Months</label>
                    <input
                      type="number" min={1} max={36}
                      value={newCoupon.duration_months}
                      onChange={e => setNewCoupon(p => ({ ...p, duration_months: Number(e.target.value) }))}
                      className="input-field text-xs mt-0.5"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Applies to</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["pro", "business", "teams"].map(plan => (
                    <button
                      key={plan}
                      onClick={() => setNewCoupon(p => ({
                        ...p,
                        applies_to: p.applies_to.includes(plan)
                          ? p.applies_to.filter(x => x !== plan)
                          : [...p.applies_to, plan],
                      }))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize transition-colors",
                        newCoupon.applies_to.includes(plan)
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Expiry date (optional)</label>
                  <input
                    type="date"
                    value={newCoupon.expires_at}
                    onChange={e => setNewCoupon(p => ({ ...p, expires_at: e.target.value }))}
                    className="input-field text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Max uses (optional)</label>
                  <input
                    type="number" min={1}
                    value={newCoupon.max_uses}
                    onChange={e => setNewCoupon(p => ({ ...p, max_uses: e.target.value }))}
                    placeholder="Unlimited"
                    className="input-field text-xs mt-0.5"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Use case / note (optional)</label>
                <input
                  value={newCoupon.use_case}
                  onChange={e => setNewCoupon(p => ({ ...p, use_case: e.target.value }))}
                  placeholder="e.g. Launch promo, Partner deal"
                  className="input-field text-xs mt-0.5"
                />
              </div>
              <button
                disabled={creatingCoupon || !newCoupon.code.trim() || newCoupon.applies_to.length === 0}
                onClick={async () => {
                  setCreatingCoupon(true);
                  try {
                    await createCoupon({
                      code: newCoupon.code,
                      discount_pct: newCoupon.discount_pct,
                      duration: newCoupon.duration,
                      duration_months: newCoupon.duration === "repeating" ? newCoupon.duration_months : null,
                      applies_to: newCoupon.applies_to,
                      expires_at: newCoupon.expires_at ? new Date(newCoupon.expires_at).toISOString() : null,
                      max_uses: newCoupon.max_uses ? Number(newCoupon.max_uses) : null,
                      use_case: newCoupon.use_case || null,
                    });
                    toast.success(`Coupon ${newCoupon.code} created`);
                    setNewCoupon({ code: "", discount_pct: 20, duration: "once", duration_months: 1, applies_to: ["pro", "business"], expires_at: "", max_uses: "", use_case: "" });
                    setShowCreateCoupon(false);
                  } catch (e: any) {
                    toast.error(e?.message?.includes("duplicate") ? "Code already exists" : "Failed to create coupon");
                  } finally { setCreatingCoupon(false); }
                }}
                className="btn-primary w-full flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
              >
                {creatingCoupon ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Create Coupon
              </button>
            </motion.div>
          )}

          {coupons.map(c => {
            const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
            const isToggling = togglingCoupon === c.id;
            return (
              <div key={c.id} className="card-elevated p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.active ? "bg-primary/10" : "bg-muted")}>
                      <Tag size={14} className={c.active ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground font-mono">{c.code}</p>
                      <p className="text-[9px] text-muted-foreground">{c.use_case || "General"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={isToggling}
                      onClick={async () => {
                        setTogglingCoupon(c.id);
                        try {
                          await toggleCoupon(c.id, !c.active);
                          toast.success(c.active ? "Coupon paused" : "Coupon activated");
                        } catch { toast.error("Failed"); }
                        finally { setTogglingCoupon(null); }
                      }}
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                        c.active ? "bg-amber-500/10 hover:bg-amber-500/20" : "bg-emerald-500/10 hover:bg-emerald-500/20"
                      )}
                    >
                      {isToggling ? <Loader2 size={10} className="animate-spin text-muted-foreground" /> :
                        c.active ? <Pause size={10} className="text-amber-400" /> : <Play size={10} className="text-emerald-400" />}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete ${c.code}?`)) return;
                        try {
                          await deleteCoupon(c.id);
                          toast.success("Coupon deleted");
                        } catch { toast.error("Failed"); }
                      }}
                      className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={10} className="text-destructive" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">{c.discount_pct}% off</span>
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium">
                    {c.duration === "once" ? "1 month" : c.duration === "forever" ? "Forever" : `${c.duration_months}mo`}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium">
                    {c.applies_to.join(", ")}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-foreground font-semibold">
                    {c.usage_count} used{c.max_uses ? ` / ${c.max_uses}` : ""}
                  </span>
                  {isExpired && <span className="px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-bold">Expired</span>}
                  {!c.active && !isExpired && <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-bold">Paused</span>}
                </div>
              </div>
            );
          })}
          {coupons.length === 0 && !showCreateCoupon && <p className="text-xs text-muted-foreground text-center py-8">No coupon codes</p>}
        </motion.div>
      )}

      {/* Referrals tab — leaderboard */}
      {tab === "referrals" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="card-elevated p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={12} className="text-amber-400" />
                <span className="text-[10px] text-muted-foreground font-medium">Commissions Owed</span>
              </div>
              <p className="text-lg font-bold text-foreground">${(totalCommissionsOwed / 100).toFixed(2)}</p>
            </div>
            <div className="card-elevated p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Gift size={12} className="text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium">Total Referrals</span>
              </div>
              <p className="text-lg font-bold text-foreground">{referrals.length}</p>
            </div>
          </div>

          <p className="section-label mb-2">Referral Leaderboard</p>
          {leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.referrer_id} className="card-elevated p-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                      i === 0 ? "bg-amber-500/15 text-amber-400" :
                      i === 1 ? "bg-zinc-400/15 text-zinc-400" :
                      i === 2 ? "bg-orange-500/15 text-orange-400" :
                      "bg-secondary text-muted-foreground"
                    )}>
                      {i < 3 ? <Award size={14} /> : `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{entry.referrer_name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{entry.referrer_email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">${(entry.total_earned_cents / 100).toFixed(2)}</p>
                      <p className="text-[9px] text-muted-foreground">{entry.total_referrals} ref · {entry.active_referrals} active</p>
                    </div>
                  </div>
                  {entry.pending_cents > 0 && (
                    <div className="mt-2 px-2 py-1 rounded-lg bg-amber-500/10 text-[10px] font-semibold text-amber-400">
                      ${(entry.pending_cents / 100).toFixed(2)} pending payout
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No referrals yet</p>
          )}
        </motion.div>
      )}

      {/* Fraud detection tab */}
      {tab === "fraud" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="card-elevated p-4 mb-2">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <p className="text-xs font-semibold text-foreground">Self-Referral Detection</p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Flagged accounts share the same device, IP, or payment method as the referrer. 
              Commissions are held and not auto-paid until manually reviewed.
            </p>
          </div>

          <p className="section-label mb-2">
            {flaggedCommissions.length} Flagged Commission{flaggedCommissions.length !== 1 ? "s" : ""}
          </p>

          {flaggedCommissions.length > 0 ? (
            <div className="space-y-2">
              {flaggedCommissions.map(c => {
                const referrer = users.find(u => u.id === c.referrer_id);
                const referral = referrals.find(r => r.id === c.referral_id);
                const referred = referral?.referred_id ? users.find(u => u.id === referral.referred_id) : null;
                return (
                  <div key={c.id} className="card-elevated p-3 border-amber-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                          <AlertTriangle size={12} className="text-amber-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-foreground">${(c.amount_cents / 100).toFixed(2)} commission</p>
                          <p className="text-[9px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 uppercase">
                        {c.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-14 shrink-0">Referrer:</span>
                        <span className="text-foreground font-medium truncate">{referrer?.name || referrer?.email || c.referrer_id.slice(0, 8)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-14 shrink-0">Referred:</span>
                        <span className="text-foreground font-medium truncate">{referred?.name || referred?.email || referral?.referred_id?.slice(0, 8) || "Unknown"}</span>
                      </div>
                      {c.flag_reason && (
                        <div className="flex items-start gap-2 mt-1">
                          <span className="text-muted-foreground w-14 shrink-0">Reason:</span>
                          <span className="text-amber-400 font-medium">{c.flag_reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <Check size={20} className="text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-foreground">All Clear</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">No flagged commissions detected</p>
            </div>
          )}

          {/* Recent commissions overview */}
          <p className="section-label mb-2 mt-4">Recent Commissions</p>
          {commissions.slice(0, 10).map(c => {
            const referrer = users.find(u => u.id === c.referrer_id);
            return (
              <div key={c.id} className="card-elevated p-3 flex items-center gap-3">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                  c.flagged ? "bg-amber-500/15" :
                  c.status === "paid" ? "bg-emerald-500/15" :
                  "bg-primary/10"
                )}>
                  {c.flagged ? <AlertTriangle size={12} className="text-amber-400" /> :
                   c.status === "paid" ? <Check size={12} className="text-emerald-400" /> :
                   <DollarSign size={12} className="text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate">
                    {referrer?.name || referrer?.email || c.referrer_id.slice(0, 8)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-foreground">${(c.amount_cents / 100).toFixed(2)}</p>
                  <span className={cn(
                    "text-[9px] font-bold",
                    c.status === "paid" ? "text-emerald-400" :
                    c.status === "pending" ? "text-amber-400" :
                    "text-muted-foreground"
                  )}>{c.status}</span>
                </div>
              </div>
            );
          })}
          {commissions.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No commissions yet</p>}
        </motion.div>
      )}

      {/* Type-check tab — surfaces the latest CI `deno check` run on
          supabase/functions/* with a realtime subscription so it auto-refreshes
          the moment a new run lands (no polling, no page reload). */}
      {tab === "typecheck" && <TypecheckPanel />}
    </div>
  );
};

/* ─── ORG ADMIN (existing) ─── */
const OrgAdmin = () => {
  const { user } = useAuth();
  const {
    org, members, invitations, domains, myRole, isAdmin, loading,
    createOrg, updateOrg, inviteMember, removeMember, updateMemberRole,
    cancelInvitation, addDomain, removeDomain,
  } = useOrganization();

  const [showCreate, setShowCreate] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [editingOrg, setEditingOrg] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [tab, setTab] = useState<"members" | "domains" | "branding" | "settings">("members");
  const [memberSearch, setMemberSearch] = useState("");

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(m =>
      (m.name || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) { toast.error("Organization name is required"); return; }
    const slug = orgSlug.trim() || orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setCreating(true);
    try {
      await createOrg(orgName.trim(), slug);
      toast.success("Organization created!");
      setShowCreate(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create organization");
    } finally { setCreating(false); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error("Email is required"); return; }
    setInviting(true);
    try {
      const result = await inviteMember(inviteEmail.trim(), inviteRole);
      const joinUrl = result?.joinUrl;
      if (joinUrl) {
        await navigator.clipboard.writeText(joinUrl);
        toast.success("Invitation created! Join link copied.");
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
      }
      setInviteEmail("");
      setShowInvite(false);
    } catch (err: any) {
      toast.error(err.message?.includes("already") ? "Already invited" : err.message || "Failed to invite");
    } finally { setInviting(false); }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    try {
      await addDomain(newDomain.trim().toLowerCase());
      toast.success("Domain added — verify via DNS TXT record");
      setNewDomain("");
      setShowAddDomain(false);
    } catch (err: any) {
      toast.error(err.message?.includes("duplicate") ? "Domain already registered" : err.message || "Failed");
    }
  };

  const handleSaveOrg = async () => {
    try {
      await updateOrg({ name: editName.trim(), slug: editSlug.trim() });
      toast.success("Organization updated");
      setEditingOrg(false);
    } catch (err: any) { toast.error(err.message || "Failed to update"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={20} className="text-primary animate-spin" /></div>;

  if (!org) {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-xl font-display font-bold text-foreground">Admin Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your organization</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-elevated p-6 text-center">
          <Building2 size={32} className="text-primary mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-1">No Organization Yet</h2>
          <p className="text-xs text-muted-foreground mb-5">Create one to manage your team, domains, and SSO.</p>
          {!showCreate ? (
            <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus size={14} /> Create Organization</button>
          ) : (
            <div className="text-left space-y-3 mt-4">
              <div>
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">Organization Name</label>
                <input value={orgName} onChange={e => { setOrgName(e.target.value); if (!orgSlug) setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="Acme Corp" className="input-field" autoFocus />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">Slug</label>
                <input value={orgSlug} onChange={e => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="acme-corp" className="input-field" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80 transition-colors">Cancel</button>
                <button onClick={handleCreateOrg} disabled={creating} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const seatCount = members.length;
  const seatPct = Math.min((seatCount / (org.max_seats || 10)) * 100, 100);

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Building2 size={18} className="text-primary" /></div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-display font-bold text-foreground truncate">{org.name}</h1>
            <p className="text-[11px] text-muted-foreground">/{org.slug} · {myRole && ROLE_LABELS[myRole]?.label}</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="card-elevated p-3 mb-4 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-foreground">Seats</p>
            <p className="text-[10px] text-muted-foreground">{seatCount}/{org.max_seats}</p>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${seatPct}%` }} />
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="flex gap-1 mb-4 bg-secondary/60 rounded-xl p-1">
        {([
          { id: "members" as const, label: "Members", icon: Users },
          { id: "domains" as const, label: "Domains", icon: Globe },
          { id: "branding" as const, label: "Branding", icon: Paintbrush },
          { id: "settings" as const, label: "Settings", icon: Settings2 },
        ]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all", tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </motion.div>

      {tab === "members" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Search members */}
          {members.length > 3 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search members…"
                className="input-field pl-9 text-xs h-9"
              />
              {memberSearch && (
                <button onClick={() => setMemberSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                  <X size={10} className="text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <button onClick={() => setShowInvite(true)} className="w-full card-elevated p-3 flex items-center gap-3 text-left hover:border-primary/25 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><UserPlus size={16} className="text-primary" /></div>
              <div><p className="text-xs font-semibold text-foreground">Invite Member</p><p className="text-[10px] text-muted-foreground">Send an email invitation</p></div>
            </button>
          )}
          {filteredMembers.map(m => {
            const roleInfo = ROLE_LABELS[m.role];
            const RoleIcon = roleInfo.icon;
            const isMe = m.user_id === user?.id;
            return (
              <div key={m.id} className="card-elevated p-3 flex items-center gap-3">
                <div className="w-9 h-9 avatar-circle text-[10px] shrink-0">{(m.name || m.email || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground truncate">{m.name || m.email || "Unknown"}</p>
                    {isMe && <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">You</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <RoleIcon size={10} className={roleInfo.color} />
                    <span className={`text-[10px] font-semibold ${roleInfo.color}`}>{roleInfo.label}</span>
                    {m.email && <span className="text-[10px] text-muted-foreground truncate"> · {m.email}</span>}
                  </div>
                </div>
                {isAdmin && !isMe && m.role !== "owner" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <select value={m.role} onChange={e => updateMemberRole(m.id, e.target.value as any)} className="text-[10px] bg-secondary rounded-lg px-2 py-1.5 border border-border/60 text-foreground outline-none">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => { if (confirm(`Remove ${m.name || m.email}?`)) removeMember(m.id); }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors">
                      <Trash2 size={12} className="text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {invitations.length > 0 && (
            <div className="mt-4">
              <p className="section-label mb-2">Pending Invitations</p>
              {invitations.map(inv => (
                <div key={inv.id} className="card-elevated p-3 flex items-center gap-3 mb-2 border-dashed">
                  <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0"><Mail size={14} className="text-warning" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{inv.email}</p>
                    <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[inv.role]?.label} · Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => cancelInvitation(inv.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"><X size={12} className="text-destructive" /></button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Invite modal */}
          {showInvite && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Invite Member</h3>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@company.com" className="input-field" autoFocus />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} className="input-field text-sm">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80 transition-colors">Cancel</button>
                <button onClick={handleInvite} disabled={inviting} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                  {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {tab === "domains" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2"><Globe size={14} className="text-primary" /><h3 className="text-sm font-semibold text-foreground">Email Domains</h3></div>
            <p className="text-[11px] text-muted-foreground mb-3">Users with matching email domains can auto-join your organization.</p>
            {domains.length === 0 && <p className="text-xs text-muted-foreground/60 text-center py-4">No domains configured.</p>}
            {domains.map(d => (
              <div key={d.id} className="flex items-center gap-3 bg-secondary/40 rounded-xl p-3 mb-2">
                <Link size={13} className={d.verified ? "text-success" : "text-warning"} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{d.domain}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {d.verified ? (
                      <span className="text-[10px] text-success font-semibold flex items-center gap-1"><Check size={10} /> Verified</span>
                    ) : (
                      <span className="text-[10px] text-warning font-semibold flex items-center gap-1"><AlertTriangle size={10} /> Pending</span>
                    )}
                  </div>
                  {!d.verified && d.verification_token && (
                    <div className="mt-2 bg-card rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Add TXT record:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-mono text-foreground bg-secondary px-2 py-1 rounded flex-1 truncate">cardscanpro-verify={d.verification_token}</code>
                        <button onClick={() => { navigator.clipboard.writeText(`cardscanpro-verify=${d.verification_token}`); toast.success("Copied!"); }} className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center shrink-0"><Copy size={10} className="text-muted-foreground" /></button>
                      </div>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <button onClick={() => removeDomain(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors shrink-0"><Trash2 size={12} className="text-destructive" /></button>
                )}
              </div>
            ))}
            {isAdmin && !showAddDomain && (
              <button onClick={() => setShowAddDomain(true)} className="flex items-center gap-1.5 text-xs font-semibold text-primary mt-2"><Plus size={12} /> Add Domain</button>
            )}
            {showAddDomain && (
              <div className="mt-3 flex items-center gap-2">
                <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="example.com" className="input-field flex-1 text-sm" autoFocus onKeyDown={e => e.key === "Enter" && handleAddDomain()} />
                <button onClick={handleAddDomain} className="btn-primary px-3 py-2 text-sm"><Check size={14} /></button>
                <button onClick={() => setShowAddDomain(false)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center"><X size={14} className="text-muted-foreground" /></button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {tab === "branding" && org && (
        <BrandingEditor orgId={org.id} />
      )}

      {tab === "settings" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="card-elevated p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Organization Settings</h3>
            {!editingOrg ? (
              <div className="space-y-2">
                <div><p className="text-[10px] text-muted-foreground">Name</p><p className="text-xs text-foreground font-semibold">{org.name}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Slug</p><p className="text-xs text-foreground font-semibold">/{org.slug}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Max Seats</p><p className="text-xs text-foreground font-semibold">{org.max_seats}</p></div>
                {isAdmin && (
                  <button onClick={() => { setEditName(org.name); setEditSlug(org.slug); setEditingOrg(true); }} className="flex items-center gap-1.5 text-xs font-semibold text-primary mt-2"><Settings2 size={12} /> Edit</button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div><label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Name</label><input value={editName} onChange={e => setEditName(e.target.value)} className="input-field" /></div>
                <div><label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Slug</label><input value={editSlug} onChange={e => setEditSlug(e.target.value)} className="input-field" /></div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingOrg(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80 transition-colors">Cancel</button>
                  <button onClick={handleSaveOrg} className="btn-primary flex-1 text-sm">Save</button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

/* ─── MAIN ─── */
const AdminPanel = () => {
  const { isAdmin, loading } = usePlatformAdmin();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={20} className="text-primary animate-spin" /></div>;

  if (isAdmin) return <PlatformDashboard />;
  return <OrgAdmin />;
};

export default AdminPanel;
