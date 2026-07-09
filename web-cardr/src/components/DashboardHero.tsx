import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Mail, MessageSquare, Send, Copy, ChevronRight, QrCode, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { buildCardLink } from "@/lib/publicOrigin";

/**
 * Premium dashboard hero — combines greeting, identity, and one-tap share
 * into a single cohesive module. Replaces the old separate greeting + share card.
 */
const DashboardHero = ({ contactsCount, enrichedCount }: { contactsCount: number; enrichedCount: number }) => {
  const { profile } = useApp();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("card_slug")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSlug(data?.card_slug ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const cardLink = useMemo(() => {
    const fallback = profile.name ? profile.name.toLowerCase().replace(/\s+/g, "-") : "card";
    return buildCardLink(slug || fallback);
  }, [slug, profile.name]);

  const ready = Boolean(profile.name);
  const firstName = profile.name?.split(" ")[0] || "";
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  const guard = () => {
    if (ready) return true;
    toast.error(t("shareCard.fillInFirst"));
    navigate("/app/card");
    return false;
  };

  const shareText = `${t("shareCard.shareText")} — ${cardLink}`;

  const handleNativeShare = async () => {
    if (!guard()) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: profile.name, text: t("shareCard.shareText"), url: cardLink });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(cardLink);
      toast.success(t("shareCard.copied"));
    }
  };

  const handleEmail = () => {
    if (!guard()) return;
    const subject = encodeURIComponent(`${profile.name} — ${t("shareCard.digitalCard")}`);
    const body = encodeURIComponent(`${t("shareCard.emailIntro")}\n${cardLink}\n\n${t("shareCard.emailSignoff")}\n${profile.name}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const handleSMS = () => {
    if (!guard()) return;
    window.open(`sms:?&body=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleWhatsApp = () => {
    if (!guard()) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleCopy = async () => {
    if (!guard()) return;
    await navigator.clipboard.writeText(cardLink);
    toast.success(t("shareCard.copied"));
  };

  const channels = [
    { id: "email", label: t("shareCard.email"), Icon: Mail, onClick: handleEmail },
    { id: "sms", label: t("shareCard.message"), Icon: MessageSquare, onClick: handleSMS },
    { id: "wa", label: "WhatsApp", Icon: Send, onClick: handleWhatsApp, tint: "text-[#25D366]" },
    { id: "copy", label: t("shareCard.copyLink"), Icon: Copy, onClick: handleCopy },
  ];

  const initial = (firstName || profile.name || "?").charAt(0).toUpperCase();

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative mb-4 overflow-hidden rounded-[28px] border border-border/60 bg-card"
      style={{ boxShadow: "0 1px 2px hsl(0 0% 0% / 0.04), 0 8px 32px -12px hsl(var(--primary) / 0.18)" }}
      aria-labelledby="dash-hero-heading"
    >
      {/* Subtle gradient wash */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.55] pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, hsl(var(--primary) / 0.08), transparent 55%), radial-gradient(80% 60% at 100% 0%, hsl(var(--accent) / 0.07), transparent 60%)",
        }}
      />

      <div className="relative p-5">
        {/* Greeting row */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary mb-1.5 flex items-center gap-1.5">
              <Sparkles size={11} strokeWidth={2.5} />
              {ready ? "Your network" : "Get started"}
            </p>
            <h1
              id="dash-hero-heading"
              className="font-display text-[26px] leading-[1.15] font-semibold tracking-tight text-foreground"
            >
              {greeting}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 tabular-nums">
              <span className="font-semibold text-foreground/80">{contactsCount}</span> contacts ·{" "}
              <span className="font-semibold text-foreground/80">{enrichedCount}</span> enriched
            </p>
          </div>

          {/* Avatar */}
          <button
            onClick={() => navigate("/app/card")}
            className="shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center font-display font-semibold text-lg text-primary-foreground transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
              boxShadow: "0 6px 16px -6px hsl(var(--primary) / 0.5)",
            }}
            aria-label="Open your card"
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="h-full w-full object-cover rounded-2xl" />
            ) : (
              initial
            )}
          </button>
        </div>

        {/* Identity / preview strip */}
        <button
          onClick={() => navigate("/app/card")}
          className="w-full group mb-3 flex items-center gap-3 rounded-2xl bg-secondary/60 hover:bg-secondary transition-colors p-3 text-left"
        >
          <div className="h-10 w-10 rounded-xl bg-card border border-border/70 flex items-center justify-center shrink-0">
            <Share2 size={16} className="text-primary" strokeWidth={2.25} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">
              {ready ? t("shareCard.title") : t("shareCard.notReady")}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {ready ? t("shareCard.subtitle") : "Tap to set up your card"}
            </p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Primary action */}
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={handleNativeShare}
          className="w-full rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 text-primary-foreground font-semibold text-[15px] tracking-tight transition-all"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
            boxShadow: "0 8px 20px -8px hsl(var(--primary) / 0.5)",
          }}
        >
          <Share2 size={16} strokeWidth={2.25} />
          {t("shareCard.shareNow")}
        </motion.button>

        {/* Channels — horizontal pills */}
        <div className="grid grid-cols-4 gap-1.5 mt-2.5">
          {channels.map(({ id, label, Icon, onClick, tint }) => (
            <button
              key={id}
              onClick={onClick}
              className="group rounded-xl py-2.5 px-1 flex flex-col items-center gap-1 bg-secondary/50 hover:bg-secondary transition-colors active:scale-95"
            >
              <Icon size={15} className={tint ?? "text-foreground/75 group-hover:text-foreground transition-colors"} strokeWidth={2.1} />
              <span className="text-[11px] font-medium text-foreground/70 truncate w-full text-center tracking-tight">
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Tertiary */}
        <button
          onClick={() => navigate("/app/card")}
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground transition-colors py-1.5"
        >
          <QrCode size={11} strokeWidth={2.25} />
          {t("shareCard.moreOptions")}
        </button>
      </div>
    </motion.section>
  );
};

export default DashboardHero;
