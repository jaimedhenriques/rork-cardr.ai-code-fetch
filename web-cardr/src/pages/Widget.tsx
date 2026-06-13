import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { QRCodeSVG } from "qrcode.react";
import { ScanLine, Share2, CreditCard } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMemo } from "react";

const Widget = () => {
  const { profile } = useApp();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const vcardString = useMemo(() => {
    return `BEGIN:VCARD\nVERSION:3.0\nFN:${profile.name}\nTITLE:${profile.title}\nORG:${profile.company}\nEMAIL:${profile.email}\nTEL:${profile.phone}\nURL:${profile.website}\nEND:VCARD`;
  }, [profile]);

  const handleShare = async () => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${profile.name}\nTITLE:${profile.title}\nORG:${profile.company}\nEMAIL:${profile.email}\nTEL:${profile.phone}\nURL:${profile.website}\nEND:VCARD`;
    if (navigator.share) {
      await navigator.share({ title: profile.name, text: vcard });
    } else {
      await navigator.clipboard.writeText(vcard);
      toast.success(t("widget.contactCopied"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-8 pt-12 bg-background">
      <div className="w-full max-w-sm mb-6"><PageHeader /></div>
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-3">
          <CreditCard size={22} className="text-primary-foreground" />
        </div>
        <h1 className="text-lg font-display font-bold text-foreground">{profile.name || t("widget.yourCard")}</h1>
        <p className="text-sm text-muted-foreground">{profile.title}{profile.company ? ` · ${profile.company}` : ""}</p>
      </div>

      <div className="card-elevated p-6 mb-6 flex flex-col items-center">
        <QRCodeSVG
          value={vcardString}
          size={200}
          level="M"
          bgColor="hsl(var(--card))"
          fgColor="hsl(var(--foreground))"
        />
        <p className="text-xs text-muted-foreground mt-3">{t("widget.scanToSave")}</p>
      </div>

      <div className="w-full max-w-xs space-y-2.5">
        <button onClick={handleShare} className="w-full btn-primary flex items-center justify-center gap-2 text-sm">
          <Share2 size={16} /> {t("widget.shareContact")}
        </button>
        <button onClick={() => navigate("/scan")} className="w-full btn-secondary flex items-center justify-center gap-2 text-sm">
          <ScanLine size={16} /> {t("widget.scanBadge")}
        </button>
        <button onClick={() => navigate("/")} className="w-full btn-ghost flex items-center justify-center gap-2 text-xs">
          {t("widget.openApp")}
        </button>
      </div>
    </div>
  );
};

export default Widget;