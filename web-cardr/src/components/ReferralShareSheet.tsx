import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, X, Copy, Send, MessageSquare, Mail, Check,
  Users, Coins, Percent, TrendingUp, Loader2, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useReferral } from "@/hooks/useReferral";
import { toast } from "sonner";
import { hidePaidSurfaces } from "@/lib/iosCompliance";

const perks = [
  {
    icon: Coins,
    title: "Earn Account Credits",
    desc: "Get credits equal to 20% of every payment your referrals make.",
  },
  {
    icon: Percent,
    title: "Your Friends Get 20% Off",
    desc: "They get 20% off their first 3 months on Pro or Business.",
  },
  {
    icon: TrendingUp,
    title: "Use It for Free",
    desc: "Earn enough credits and your subscription is completely covered.",
  },
  {
    icon: Users,
    title: "Track Everything",
    desc: "See clicks, signups, active subscribers, and your credit balance.",
  },
];

const ReferralShareSheet = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stats, loading } = useReferral();

  // Phase-1 native compliance: never render the referral share sheet on iOS/Android.
  if (hidePaidSurfaces()) return null;

  const referralLink = stats?.referral_link || `https://scanpro.app/ref/${user?.email?.split("@")[0] || "user"}`;
  const shareMessage = `Hey! I've been using Cardr to manage my contacts and it's been a game changer. Use my link to get 20% off your first 3 months: ${referralLink}`;

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

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank");
  };

  const handleiMessage = () => {
    window.open(`sms:&body=${encodeURIComponent(shareMessage)}`, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent("Check out Cardr — 20% off for you!");
    const body = encodeURIComponent(shareMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors active:scale-95"
        aria-label="Refer & Earn"
      >
        <Gift size={14} className="text-primary" />
        <span className="text-[11px] font-semibold text-primary hidden min-[380px]:inline">
          Refer & Earn
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-card border-t border-border"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="px-5 pb-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Gift size={18} className="text-primary" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">Refer & Earn Credits</h2>
                      <p className="text-[11px] text-muted-foreground">Earn credits toward your subscription</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center"
                  >
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>

                {/* Live Stats (if available) */}
                {stats && !loading && (stats.total_clicks > 0 || stats.total_signups > 0) && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="card-elevated p-2.5 text-center">
                      <p className="text-lg font-bold text-foreground">{stats.total_clicks}</p>
                      <p className="text-[10px] text-muted-foreground">Clicks</p>
                    </div>
                    <div className="card-elevated p-2.5 text-center">
                      <p className="text-lg font-bold text-foreground">{stats.total_signups}</p>
                      <p className="text-[10px] text-muted-foreground">Signups</p>
                    </div>
                    <div className="card-elevated p-2.5 text-center">
                      <p className="text-lg font-bold text-primary">
                        ${(stats.total_credits_earned_cents / 100).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Credits</p>
                    </div>
                  </div>
                )}

                {/* Referral Link */}
                <div className="card-elevated p-3.5 mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Your Referral Link
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 rounded-xl bg-secondary text-xs font-mono text-foreground truncate">
                      {loading ? <Loader2 size={14} className="animate-spin" /> : referralLink}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 w-10 h-10 rounded-xl bg-primary flex items-center justify-center active:scale-95 transition-transform"
                    >
                      {copied ? (
                        <Check size={16} className="text-primary-foreground" />
                      ) : (
                        <Copy size={16} className="text-primary-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Share Buttons */}
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  <button
                    onClick={handleWhatsApp}
                    className="card-elevated p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 flex items-center justify-center">
                      <Send size={16} className="text-[#25D366]" />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground">WhatsApp</span>
                  </button>
                  <button
                    onClick={handleiMessage}
                    className="card-elevated p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <MessageSquare size={16} className="text-primary" />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground">iMessage</span>
                  </button>
                  <button
                    onClick={handleEmail}
                    className="card-elevated p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                      <Mail size={16} className="text-accent" />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground">Email</span>
                  </button>
                </div>

                {/* Perks */}
                <div className="card-elevated p-1 mb-4">
                  <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    How Credits Work
                  </p>
                  {perks.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-3 px-3 py-2.5 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { setOpen(false); navigate("/referrals"); }}
                  className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary flex items-center justify-center gap-1.5 active:scale-95 transition-all mb-3"
                >
                  View Full Dashboard <ArrowRight size={12} />
                </button>

                <p className="text-center text-[10px] text-muted-foreground">
                  Credits applied to your account · No cash payouts · Lifetime referral tracking
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default ReferralShareSheet;
