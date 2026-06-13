import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail, Phone, Globe, Linkedin, ExternalLink, Download,
  Loader2, UserX, ScanLine
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

interface PublicProfile {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  avatar: string | null;
  card_slug: string;
}

const PublicCard = () => {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-public-card", {
          body: { slug },
        });
        if (error || !data?.profile) {
          setNotFound(true);
        } else {
          setProfile(data.profile);
        }
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const vcardString = useMemo(() => {
    if (!profile) return "";
    return [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${profile.name}`,
      profile.title ? `TITLE:${profile.title}` : "",
      profile.company ? `ORG:${profile.company}` : "",
      profile.email ? `EMAIL:${profile.email}` : "",
      profile.phone ? `TEL:${profile.phone}` : "",
      profile.website ? `URL:${profile.website}` : "",
      profile.linkedin ? `X-SOCIALPROFILE;type=linkedin:${profile.linkedin}` : "",
      "END:VCARD",
    ].filter(Boolean).join("\n");
  }, [profile]);

  const handleSaveContact = useCallback(() => {
    if (!profile) return;
    const blob = new Blob([vcardString], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.name.replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [profile, vcardString]);

  const companyMark = profile?.company ? profile.company.slice(0, 2).toUpperCase() : "CS";
  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="text-primary animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <UserX size={28} className="text-muted-foreground" />
        </div>
        <h1 className="text-lg font-bold text-foreground">Card Not Found</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          This card link may be invalid or the card has been removed.
        </p>
      </div>
    );
  }

  const contactRows = [
    {
      icon: Mail, value: profile.email, label: "Email",
      action: () => profile.email && window.open(`mailto:${profile.email}`),
    },
    {
      icon: Phone, value: profile.phone, label: "Phone",
      action: () => profile.phone && window.open(`tel:${profile.phone}`),
    },
    {
      icon: Linkedin, value: profile.linkedin, label: "LinkedIn",
      action: () => profile.linkedin && window.open(
        profile.linkedin.startsWith("http") ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`,
        "_blank"
      ),
    },
    {
      icon: Globe, value: profile.website, label: "Website",
      action: () => profile.website && window.open(
        profile.website.startsWith("http") ? profile.website : `https://${profile.website}`,
        "_blank"
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
          {/* Header gradient */}
          <div className="relative h-28 bg-gradient-to-br from-primary to-accent overflow-hidden">
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute -left-6 -bottom-10 w-24 h-24 rounded-full bg-white/5" />
          </div>

          {/* Avatar / Initials */}
          <div className="flex justify-center -mt-12 relative z-10">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-24 h-24 rounded-full border-4 border-card object-cover shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-card bg-primary flex items-center justify-center shadow-md">
                <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
              </div>
            )}
          </div>

          {/* Name + Title */}
          <div className="text-center px-5 pt-3 pb-1">
            <h1 className="text-xl font-bold text-foreground">{profile.name}</h1>
            {profile.title && (
              <p className="text-sm font-semibold text-primary mt-0.5">{profile.title}</p>
            )}
            {profile.company && (
              <p className="text-xs text-muted-foreground mt-0.5">{profile.company}</p>
            )}
          </div>

          {/* Contact rows */}
          <div className="px-4 py-3 space-y-1">
            {contactRows
              .filter((r) => r.value)
              .map(({ icon: Icon, value, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="text-sm text-foreground truncate">{value}</p>
                  </div>
                  <ExternalLink size={12} className="text-muted-foreground/40 shrink-0" />
                </button>
              ))}
          </div>

          {/* QR Code */}
          <div className="flex justify-center pb-4">
            <div className="rounded-xl bg-background border border-border p-2.5">
              <QRCodeSVG
                value={vcardString}
                size={80}
                level="M"
                bgColor="hsl(var(--background))"
                fgColor="hsl(var(--foreground))"
              />
            </div>
          </div>

          {/* Save Contact button */}
          <div className="px-5 pb-5">
            <button
              onClick={handleSaveContact}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors text-sm"
            >
              <Download size={16} />
              Save Contact
            </button>
          </div>
        </div>

        {/* Branding footer */}
        <div className="flex items-center justify-center gap-1.5 mt-6">
          <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
            <ScanLine size={10} className="text-primary-foreground" />
          </div>
          <span className="text-[11px] text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">Cardr</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default PublicCard;
