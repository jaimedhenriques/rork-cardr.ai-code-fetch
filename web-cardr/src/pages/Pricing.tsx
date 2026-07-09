import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Check, X, Zap, Crown, Building2, Sparkles, Users, Loader2, Settings, Tag,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/context/AppContext";
import { useSubscription } from "@/hooks/useSubscription";
import type { PlanType } from "@/hooks/useSubscription";
import { STRIPE_PLANS } from "@/lib/stripe-config";
import { supabase } from "@/integrations/supabase/client";
import { useReferral } from "@/hooks/useReferral";
import { toast } from "sonner";
import { isIosNative, hidePaidSurfaces, COMPLIANCE_TITLE, COMPLIANCE_BODY } from "@/lib/iosCompliance";
import IosManagePlanNotice from "@/components/IosManagePlanNotice";

/* ── plan metadata (translation keys) ───────────────── */

interface PlanCard {
  id: PlanType;
  nameKey: string;
  icon: typeof Zap;
  badgeKey?: string;
  monthlyPrice: string;
  annualPrice: string;
  annualBilledKey?: string;
  annualSavingsKey?: string;
  perUser?: boolean;
  periodKey: string;
  featureKeys: string[];
  excludedKeys: string[];
  ctaKey: string;
  ctaVariant: "primary" | "secondary";
}

const plans: PlanCard[] = [
  {
    id: "starter",
    nameKey: "pricing.plan.starter",
    icon: Sparkles,
    monthlyPrice: "$0",
    annualPrice: "$0",
    periodKey: "pricing.forever",
    featureKeys: [
      "pricing.feat.contacts25",
      "pricing.feat.enrichments15",
      "pricing.feat.notes25",
      "pricing.feat.transcription60",
      "pricing.feat.digitalCard",
      "pricing.feat.qrSharing",
      "pricing.feat.csvExport",
      "pricing.feat.basicContacts",
    ],
    excludedKeys: [
      "pricing.feat.customBranding",
      "pricing.feat.allExportFormats",
      "pricing.feat.crmIntegrations",
      "pricing.feat.prioritySupport",
      "pricing.feat.apiAccess",
      "pricing.feat.whiteLabel",
    ],
    ctaKey: "pricing.cta.getStarted",
    ctaVariant: "secondary",
  },
  {
    id: "pro",
    nameKey: "pricing.plan.pro",
    icon: Zap,
    badgeKey: "pricing.badge.mostPopular",
    monthlyPrice: "$9.99",
    annualPrice: "$7.99",
    annualBilledKey: "pricing.billedYear.pro",
    annualSavingsKey: "pricing.save.pro",
    periodKey: "pricing.perMonth",
    featureKeys: [
      "pricing.feat.unlimitedContacts",
      "pricing.feat.enrichments150",
      "pricing.feat.unlimitedNotes",
      "pricing.feat.transcription10h",
      "pricing.feat.everythingStarter",
      "pricing.feat.customBranding",
      "pricing.feat.allExportFormatsFull",
      "pricing.feat.basicCrm",
      "pricing.feat.prioritySupport",
    ],
    excludedKeys: [
      "pricing.feat.advancedCrm",
      "pricing.feat.apiAccess",
      "pricing.feat.whiteLabel",
      "pricing.feat.sso",
    ],
    ctaKey: "pricing.cta.startTrial",
    ctaVariant: "primary",
  },
  {
    id: "business",
    nameKey: "pricing.plan.business",
    icon: Crown,
    badgeKey: "pricing.badge.bestValue",
    monthlyPrice: "$18",
    annualPrice: "$14",
    annualBilledKey: "pricing.billedYear.business",
    annualSavingsKey: "pricing.save.business",
    periodKey: "pricing.perMonth",
    featureKeys: [
      "pricing.feat.unlimitedContacts",
      "pricing.feat.unlimitedEnrichments",
      "pricing.feat.unlimitedNotes",
      "pricing.feat.unlimitedTranscription",
      "pricing.feat.everythingPro",
      "pricing.feat.advancedCrm",
      "pricing.feat.apiAccess",
      "pricing.feat.whiteLabel",
      "pricing.feat.ssoFull",
      "pricing.feat.prioritySupport",
    ],
    excludedKeys: [],
    ctaKey: "pricing.cta.startTrial",
    ctaVariant: "primary",
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { isGuest } = useApp();
  const { t } = useLanguage();
  const { plan: currentPlan, isPro } = useSubscription();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_pct: number } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const { validateCoupon } = useReferral();

  // Phase-1 native compliance: redirect away from /pricing on iOS/Android.
  useEffect(() => {
    if (hidePaidSurfaces()) {
      toast(COMPLIANCE_TITLE, { description: COMPLIANCE_BODY });
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  // Check for stored referral code
  useEffect(() => {
    const refCode = localStorage.getItem("referral_code");
    const refExpiry = localStorage.getItem("referral_expiry");
    if (refCode && refExpiry && Date.now() < Number(refExpiry)) {
      setAppliedCoupon({ code: `ref:${refCode}`, discount_pct: 20 });
    }
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponValidating(true);
    const result = await validateCoupon(couponInput.trim());
    setCouponValidating(false);
    if (result?.valid) {
      setAppliedCoupon({ code: result.coupon.code, discount_pct: result.coupon.discount_pct });
      toast.success(`${result.coupon.discount_pct}% ${t("pricing.discountApplied")}`);
      setCouponInput("");
    } else {
      toast.error(result?.error || t("pricing.invalidCoupon"));
    }
  };

  const price = (p: PlanCard) =>
    billing === "monthly" ? p.monthlyPrice : p.annualPrice;

  const period = (p: PlanCard) => {
    if (p.id === "starter") return t("pricing.forever");
    if (billing === "annual" && p.annualBilledKey) return `${t("pricing.perMo")} (${t(p.annualBilledKey)})`;
    return t(p.periodKey);
  };

  const handleCheckout = async (planId: PlanType) => {
    // Native compliance hard-stop — Apple/Google forbid external purchase flows.
    if (hidePaidSurfaces()) {
      toast(COMPLIANCE_TITLE, { description: COMPLIANCE_BODY });
      return;
    }
    if (planId === "starter" || planId === "teams") return;
    const planConfig = STRIPE_PLANS[planId as "pro" | "business"];
    const priceId = billing === "monthly" ? planConfig.monthly_price_id : planConfig.annual_price_id;
    setCheckoutLoading(planId);
    try {
      const couponCode = appliedCoupon?.code.startsWith("ref:") 
        ? appliedCoupon.code 
        : appliedCoupon?.code;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, couponCode },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast.error(t("pricing.failedCheckout"));
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    // Native compliance hard-stop — billing portal is an external purchase surface.
    if (hidePaidSurfaces()) {
      toast(COMPLIANCE_TITLE, { description: COMPLIANCE_BODY });
      return;
    }
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast.error(t("pricing.failedPortal"));
    } finally {
      setPortalLoading(false);
    }
  };

  const volumeDiscounts = [
    { rangeKey: "pricing.volume.2to9", discountKey: "pricing.volume.standard" },
    { rangeKey: "pricing.volume.10to49", discountKey: "pricing.volume.10off" },
    { rangeKey: "pricing.volume.50to99", discountKey: "pricing.volume.20off" },
    { rangeKey: "pricing.volume.100plus", discountKey: "pricing.volume.30off" },
  ];

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader />

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-3">
            <Zap size={20} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">{t("pricing.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            {t("pricing.subtitle")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("pricing.startFree")}
          </p>
        </div>

        {/* Billing toggle (hidden on iOS native — Apple compliance) */}
        {!isIosNative() && (
          <>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${billing === "monthly" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {t("pricing.monthly")}
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${billing === "annual" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {t("pricing.annual")}
                <span className="absolute -top-2 -right-2 text-[11px] bg-success text-white px-1.5 py-0.5 rounded-full font-bold">
                  {t("pricing.save20")}
                </span>
              </button>
            </div>

            {/* Coupon Code */}
            <div className="mt-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20">
                  <Tag size={13} className="text-success" />
                  <span className="text-xs font-semibold text-success">
                    {appliedCoupon.code.startsWith("ref:") ? t("pricing.referralDiscount") : appliedCoupon.code}: {appliedCoupon.discount_pct}% {t("pricing.off")}
                  </span>
                  <button onClick={() => setAppliedCoupon(null)} className="ml-1">
                    <X size={12} className="text-success/60 hover:text-success" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder={t("pricing.couponCode")}
                    className="flex-1 px-3 py-2 rounded-xl bg-secondary text-xs text-foreground placeholder:text-muted-foreground/50 border-none outline-none"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={couponValidating || !couponInput.trim()}
                    className="px-3 py-2 rounded-xl bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {couponValidating ? <Loader2 size={12} className="animate-spin" /> : t("pricing.apply")}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>

      {isIosNative() ? (
        /* Apple App Store compliance — no purchase CTAs of any kind. */
        <IosManagePlanNotice className="mt-2" />
      ) : (
        <>
          {/* Plan cards */}
      <div className="space-y-3">
        {plans.map((plan, i) => {
          const isCurrent = plan.id === currentPlan;
          const badgeText = plan.badgeKey ? t(plan.badgeKey) : null;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              className={`card-elevated p-5 relative ${plan.badgeKey === "pricing.badge.mostPopular" ? "ring-2 ring-primary" : ""}`}
            >
              {badgeText && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 badge-pill bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground">
                  {badgeText}
                </div>
              )}

              <div className="flex items-center gap-2 mb-2 mt-1">
                <plan.icon size={16} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">{t(plan.nameKey)}</p>
              </div>

              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-2xl font-display font-bold text-foreground tabular-nums">{price(plan)}</span>
                <span className="text-sm text-muted-foreground">{period(plan)}</span>
              </div>

              {billing === "annual" && plan.annualSavingsKey && (
                <span className="text-[11px] font-semibold text-success">{t(plan.annualSavingsKey)}</span>
              )}

              <div className="space-y-2 mb-4 mt-3">
                {plan.featureKeys.map((fKey) => (
                  <div key={fKey} className="flex items-center gap-2 text-xs">
                    <Check size={13} className="text-success shrink-0" />
                    <span className="text-foreground">{t(fKey)}</span>
                  </div>
                ))}
                {plan.excludedKeys.map((fKey) => (
                  <div key={fKey} className="flex items-center gap-2 text-xs">
                    <X size={13} className="text-muted-foreground/40 shrink-0" />
                    <span className="text-muted-foreground/60">{t(fKey)}</span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <div className="w-full text-center text-xs font-semibold text-muted-foreground py-3 bg-secondary rounded-xl flex items-center justify-center gap-2">
                  {t("pricing.currentPlan")}
                  {isPro && (
                    <button
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                      className="text-primary hover:text-primary/80 ml-1"
                    >
                      {portalLoading ? <Loader2 size={12} className="animate-spin" /> : <Settings size={12} />}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (isGuest) { navigate("/auth"); return; }
                    if (plan.id === "starter") return;
                    handleCheckout(plan.id);
                  }}
                  disabled={checkoutLoading === plan.id}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] flex items-center justify-center gap-2 ${
                    plan.ctaVariant === "primary" ? "btn-primary" : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {checkoutLoading === plan.id && <Loader2 size={14} className="animate-spin" />}
                  {isGuest && plan.id !== "starter" ? t("pricing.createAccount") : t(plan.ctaKey)}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Teams card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card-elevated p-5 mt-3"
      >
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 badge-pill bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground relative">
          {t("pricing.forOrganizations")}
        </div>

        <div className="flex items-center gap-2 mb-2 mt-1">
          <Building2 size={16} className="text-primary" />
          <p className="text-sm font-semibold text-foreground">{t("pricing.teams")}</p>
        </div>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-2xl font-display font-bold text-foreground tabular-nums">
            {billing === "monthly" ? "$15" : "$12"}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("pricing.perUser")}{billing === "monthly" ? t("pricing.perMonth") : `${t("pricing.perMo")} (${t("pricing.billedAnnually")})`}
          </span>
        </div>
        {billing === "annual" && (
          <span className="text-[11px] font-semibold text-success">{t("pricing.savePerUserYear")}</span>
        )}

        <p className="text-xs text-muted-foreground mt-2 mb-3">
          {t("pricing.teamsDesc")}
        </p>

        {/* Volume discounts */}
        <div className="space-y-1.5 mb-4">
          {volumeDiscounts.map(({ rangeKey, discountKey }) => (
            <div key={rangeKey} className="flex items-center justify-between text-xs">
              <span className="text-foreground font-medium flex items-center gap-1.5">
                <Users size={11} className="text-muted-foreground" /> {t(rangeKey)}
              </span>
              <span className="text-muted-foreground">{t(discountKey)}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate("/admin")}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-all active:scale-[0.97]"
        >
          {t("pricing.contactSales")}
        </button>
      </motion.div>
        </>
      )}
    </div>
  );
};

export default Pricing;
