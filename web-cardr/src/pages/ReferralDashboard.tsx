import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Copy, Check, Send, MessageSquare, Mail, Gift,
  MousePointerClick, UserPlus, Users, Coins,
  Wallet, Clock, Loader2, TrendingUp, ArrowRight,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useReferral } from "@/hooks/useReferral";
import { toast } from "sonner";
import { format } from "date-fns";
import { hidePaidSurfaces } from "@/lib/iosCompliance";

const StatCard = ({ icon: Icon, label, value, accent = false }: {
  icon: typeof Coins;
  label: string;
  value: string | number;
  accent?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="card-elevated p-4"
  >
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? "bg-primary/15" : "bg-secondary"}`}>
        <Icon size={14} className={accent ? "text-primary" : "text-muted-foreground"} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
    <p className={`text-2xl font-display font-bold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
  </motion.div>
);

const ReferralDashboard = () => {
  const navigate = useNavigate();
  const { stats, loading, fetchStats } = useReferral();
  const [copied, setCopied] = useState(false);

  // Phase-1 native compliance: referrals are hidden on iOS/Android.
  useEffect(() => {
    if (hidePaidSurfaces()) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const referralLink = stats?.referral_link || "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const shareMessage = `Hey! I've been using Cardr to manage my contacts and it's been a game changer. Use my link to get 20% off your first 3 months: ${referralLink}`;

  const handleWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank");

  const handleiMessage = () =>
    window.open(`sms:&body=${encodeURIComponent(shareMessage)}`, "_blank");

  const handleEmail = () => {
    const subject = encodeURIComponent("Check out Cardr — 20% off for you!");
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(shareMessage)}`, "_blank");
  };

  const credits = (cents: number) => `${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader back title="Referral Dashboard" />
        <div className="flex items-center justify-center mt-20">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader back title="Referral Dashboard" />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-3">
          <Gift size={24} className="text-primary-foreground" />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground">Refer & Earn Credits</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Earn account credits for every referral — use them toward your subscription
        </p>
      </motion.div>

      {/* Referral Link */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-elevated p-4 mb-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Your Referral Link
        </p>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-secondary text-xs font-mono text-foreground truncate">
            {referralLink || "Loading..."}
          </div>
          <button
            onClick={handleCopy}
            disabled={!referralLink}
            className="shrink-0 w-10 h-10 rounded-xl bg-primary flex items-center justify-center active:scale-95 transition-transform"
          >
            {copied ? (
              <Check size={16} className="text-primary-foreground" />
            ) : (
              <Copy size={16} className="text-primary-foreground" />
            )}
          </button>
        </div>

        {/* Quick share row */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors active:scale-95"
          >
            <Send size={12} className="text-[#25D366]" />
            <span className="text-[11px] font-semibold text-[#25D366]">WhatsApp</span>
          </button>
          <button
            onClick={handleiMessage}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors active:scale-95"
          >
            <MessageSquare size={12} className="text-primary" />
            <span className="text-[11px] font-semibold text-primary">iMessage</span>
          </button>
          <button
            onClick={handleEmail}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors active:scale-95"
          >
            <Mail size={12} className="text-accent" />
            <span className="text-[11px] font-semibold text-accent">Email</span>
          </button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatCard icon={MousePointerClick} label="Link Clicks" value={stats?.total_clicks || 0} />
        <StatCard icon={UserPlus} label="Signups" value={stats?.total_signups || 0} />
        <StatCard icon={Users} label="Active Subs" value={stats?.active_subscribers || 0} />
        <StatCard
          icon={Coins}
          label="Credits Earned"
          value={`$${credits(stats?.total_credits_earned_cents || 0)}`}
          accent
        />
      </div>

      {/* Credit Balance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card-elevated p-4 mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Wallet size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Available Credits
              </p>
              <p className="text-xl font-display font-bold text-foreground tabular-nums">
                ${credits(stats?.available_credits_cents || 0)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Applied to</p>
            <p className="text-xs font-semibold text-foreground">Next invoice</p>
          </div>
        </div>
        {(stats?.available_credits_cents || 0) > 0 && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-secondary">
            <p className="text-[11px] text-muted-foreground">
              Credits are automatically applied to your next subscription invoice. Earn enough and your subscription is free!
            </p>
          </div>
        )}
      </motion.div>

      {/* Credit History */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-elevated p-4 mb-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-muted-foreground" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Credit History
          </p>
        </div>

        {stats?.credit_history && stats.credit_history.length > 0 ? (
          <div className="space-y-2">
            {stats.credit_history.map((payout, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-secondary">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-success/15 flex items-center justify-center">
                    <Check size={10} className="text-success" />
                  </div>
                  <span className="text-xs text-foreground tabular-nums">
                    {format(new Date(payout.applied_at), "MMM d, yyyy")}
                  </span>
                </div>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  ${credits(payout.amount_cents)} applied
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">No credits applied yet</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Credits are auto-applied to your next invoice
            </p>
          </div>
        )}
      </motion.div>

      {/* How It Works */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card-elevated p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          How It Works
        </p>
        <div className="space-y-3">
          {[
            { step: "1", text: "Share your unique referral link with friends & colleagues" },
            { step: "2", text: "They get 20% off their first 3 months on Pro or Business" },
            { step: "3", text: "You earn credits equal to 20% of every payment they make" },
            { step: "4", text: "Credits are applied to your subscription — earn enough and it's free!" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-primary">{step}</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <p className="text-center text-[11px] text-muted-foreground mt-4">
        Credits applied automatically · No cash payouts · Lifetime referral tracking
      </p>
    </div>
  );
};

export default ReferralDashboard;
