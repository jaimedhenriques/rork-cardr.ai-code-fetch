import { motion } from "framer-motion";
import { Mail, Phone, Linkedin, Globe, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { QrStyle } from "@/components/QrCustomizer";

interface CardPreviewProps {
  profile: {
    name: string;
    title: string;
    company: string;
    email: string;
    phone: string;
    linkedin: string;
    website: string;
  };
  vcardString: string;
  qrStyle: QrStyle;
  qrRef: React.RefObject<HTMLDivElement>;
}

const contactFields = [
  { icon: Mail, key: "email" as const, label: "Email", prefix: "mailto:" },
  { icon: Phone, key: "phone" as const, label: "Call", prefix: "tel:" },
  { icon: Linkedin, key: "linkedin" as const, label: "LinkedIn", prefix: "" },
  { icon: Globe, key: "website" as const, label: "Website", prefix: "" },
] as const;

const CardPreview = ({ profile, vcardString, qrStyle, qrRef }: CardPreviewProps) => {
  const companyMark = profile.company ? profile.company.slice(0, 2).toUpperCase() : "CS";

  const getAction = (key: string, value: string) => {
    if (!value) return undefined;
    if (key === "email") return () => window.open(`mailto:${value}`);
    if (key === "phone") return () => window.open(`tel:${value}`);
    if (key === "linkedin") return () => window.open(value.startsWith("http") ? value : `https://linkedin.com/in/${value}`, "_blank");
    if (key === "website") return () => window.open(value.startsWith("http") ? value : `https://${value}`, "_blank");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
      className="card-elevated p-0 mb-4 relative overflow-hidden"
    >
      <div className="bg-gradient-to-br from-primary to-accent p-[1px]">
        <div className="relative overflow-hidden rounded-[calc(var(--radius)+2px)] bg-card px-5 py-5">
          <div className="absolute inset-x-0 top-0 h-24 bg-primary-light/70" />
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground mb-2">Digital Business Card</p>
                <h2 className="text-xl font-display font-bold text-foreground mb-1">{profile.name || "Your Name"}</h2>
                <p className="text-sm text-primary font-semibold">{profile.title || "Job Title"}</p>
                <p className="text-xs text-muted-foreground mt-1">{profile.company || "Company"}</p>
              </div>
              <div className="h-12 min-w-12 px-3 rounded-2xl bg-foreground text-background flex items-center justify-center text-sm font-bold tracking-[0.18em]">
                {companyMark}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {contactFields.map(({ icon: Icon, key, label }) => {
                const value = profile[key];
                return (
                  <button key={label} onClick={getAction(key, value)} disabled={!value}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/60 transition-colors disabled:opacity-40 disabled:cursor-default text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-sm text-foreground truncate">{value || "—"}</p>
                    </div>
                    {value && <ExternalLink size={11} className="text-muted-foreground/50 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center">
              <div ref={qrRef} className="rounded-2xl border border-border p-3" style={{ backgroundColor: qrStyle.bgColor }}>
                <QRCodeSVG value={vcardString} size={84} level="M" bgColor={qrStyle.bgColor} fgColor={qrStyle.fgColor}
                  {...(qrStyle.logoDataUrl ? { imageSettings: { src: qrStyle.logoDataUrl, height: 20, width: 20, excavate: true } } : {})}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
              <p className="text-[11px] text-muted-foreground">Scan QR to save contact</p>
              <p className="text-[11px] font-semibold text-primary">Cardr</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CardPreview;
