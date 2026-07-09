import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Mail, MessageSquare, Send, Copy, QrCode, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { buildCardLink } from "@/lib/publicOrigin";

/**
 * One-click share section for the dashboard.
 * Lets the user send their digital business card via Email, SMS, WhatsApp,
 * the native Share Sheet, or copy link — without leaving the dashboard.
 */
const ShareMyCardSection = () => {
  const { profile } = useApp();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [slug, setSlug] = useState<string | null>(null);

  // Pull the card slug so the share link is always canonical.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("card_slug")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSlug(data?.card_slug ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const cardLink = useMemo(() => {
    const fallback = profile.name
      ? profile.name.toLowerCase().replace(/\s+/g, "-")
      : "card";
    return buildCardLink(slug || fallback);
  }, [slug, profile.name]);

  const ready = Boolean(profile.name);
  const guard = () => {
    if (ready) return true;
    toast.error(t("shareCard.fillInFirst") || "Fill in your card details first");
    navigate("/card");
    return false;
  };

  const shareText = `${t("shareCard.shareText") || "Here's my digital business card"} — ${cardLink}`;

  const handleNativeShare = async () => {
    if (!guard()) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile.name,
          text: t("shareCard.shareText") || "Here's my digital business card",
          url: cardLink,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(cardLink);
      toast.success(t("shareCard.copied") || "Card link copied");
    }
  };

  const handleEmail = () => {
    if (!guard()) return;
    const subject = encodeURIComponent(
      `${profile.name} — ${t("shareCard.digitalCard") || "Digital Business Card"}`,
    );
    const body = encodeURIComponent(
      `${t("shareCard.emailIntro") || "Hi,\n\nHere's my digital business card:"}\n${cardLink}\n\n${
        t("shareCard.emailSignoff") || "Best,"
      }\n${profile.name}`,
    );
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
    toast.success(t("shareCard.copied") || "Card link copied");
  };

  const actions: {
    id: string;
    label: string;
    icon: typeof Mail;
    onClick: () => void;
    accent?: string;
  }[] = [
    { id: "email", label: t("shareCard.email") || "Email", icon: Mail, onClick: handleEmail },
    { id: "sms", label: t("shareCard.message") || "Message", icon: MessageSquare, onClick: handleSMS },
    { id: "whatsapp", label: "WhatsApp", icon: Send, onClick: handleWhatsApp, accent: "text-[#25D366]" },
    { id: "copy", label: t("shareCard.copyLink") || "Copy link", icon: Copy, onClick: handleCopy },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated p-4 mb-3"
      aria-labelledby="share-card-heading"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--accent) / 0.18))",
          }}
        >
          <Share2 size={14} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="share-card-heading" className="text-xs font-semibold text-foreground">
            {t("shareCard.title") || "Share your card"}
          </h2>
          <p className="text-[11px] text-muted-foreground truncate">
            {ready
              ? t("shareCard.subtitle") || "Send via message, email, or one tap"
              : t("shareCard.notReady") || "Set up your card to start sharing"}
          </p>
        </div>
        <button
          onClick={() => navigate("/card")}
          className="text-[11px] font-semibold text-primary flex items-center gap-0.5"
        >
          {t("shareCard.preview") || "Preview"}
          <ArrowRight size={10} />
        </button>
      </div>

      {/* Primary one-tap share — uses native share sheet on mobile */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleNativeShare}
        className="w-full rounded-2xl py-3 px-4 flex items-center justify-center gap-2 text-primary-foreground font-semibold text-sm transition-all"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
          boxShadow: "var(--shadow-brand)",
        }}
      >
        <Share2 size={15} />
        {t("shareCard.shareNow") || "Share my card"}
      </motion.button>

      {/* Secondary channels */}
      <div className="grid grid-cols-4 gap-2 mt-2">
        {actions.map(({ id, label, icon: Icon, onClick, accent }) => (
          <button
            key={id}
            onClick={onClick}
            className="rounded-xl py-2.5 px-1 flex flex-col items-center gap-1 bg-secondary hover:bg-secondary/80 transition-colors active:scale-95"
          >
            <Icon size={15} className={accent ?? "text-foreground"} />
            <span className="text-[11px] font-medium text-foreground truncate w-full text-center">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Tertiary: QR / more options live on /card */}
      <button
        onClick={() => navigate("/card")}
        className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors py-1.5"
      >
        <QrCode size={11} />
        {t("shareCard.moreOptions") || "QR code, Wallet, NameDrop & more"}
      </button>
    </motion.section>
  );
};

export default ShareMyCardSection;
