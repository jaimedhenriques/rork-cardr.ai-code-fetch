import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildCardLink } from "@/lib/publicOrigin";
import { trackCardEvent } from "@/lib/cardAnalytics";
import type { QrStyle } from "@/components/QrCustomizer";

interface Profile {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  card_slug?: string;
}

export function useCardSharing(profile: Profile) {
  const [walletLoading, setWalletLoading] = useState(false);
  const [shareOffline, setShareOffline] = useState(false);

  const vcardString = useMemo(() => {
    return [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${profile.name}`, `TITLE:${profile.title}`, `ORG:${profile.company}`,
      `EMAIL:${profile.email}`, `TEL:${profile.phone}`, `URL:${profile.website}`,
      profile.linkedin ? `X-SOCIALPROFILE;type=linkedin:${profile.linkedin}` : "",
      "END:VCARD",
    ].filter(Boolean).join("\n");
  }, [profile]);

  const slug = useMemo(
    () => profile.card_slug || (profile.name ? profile.name.toLowerCase().replace(/\s+/g, "-") : "card"),
    [profile],
  );

  const cardLink = useMemo(() => buildCardLink(slug), [slug]);

  const track = useCallback(
    (source: string) => { void trackCardEvent(slug, "share", source); },
    [slug],
  );

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: profile.name, text: `Check out ${profile.name}'s digital card`, url: cardLink });
        track("native_share");
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(cardLink);
      track("copy_link");
      toast.success("Card link copied");
    }
  }, [profile.name, cardLink, track]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(cardLink);
    track("copy_link");
    toast.success("Card link copied");
  }, [cardLink, track]);

  const handleSaveVCF = useCallback(() => {
    if (!profile.name) { toast.error("Fill in your card details first"); return; }
    const blob = new Blob([vcardString], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.name.replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Contact card downloaded — open it to add to Contacts");
  }, [profile.name, vcardString]);

  const handleAddToWallet = useCallback(async () => {
    if (!profile.name) { toast.error("Fill in your card details first"); return; }
    setWalletLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-wallet-pass", { body: {} });
      if (error) throw error;
      const blob = data instanceof Blob ? data : new Blob([data], { type: "application/vnd.apple.pkpass" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${profile.name.replace(/\s+/g, "_")}.pkpass`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Wallet pass downloaded — open it to add to Apple Wallet");
    } catch (e: any) {
      console.error("Wallet pass error:", e);
      toast.error(e?.message || "Failed to generate wallet pass");
    } finally {
      setWalletLoading(false);
    }
  }, [profile.name]);

  const handleShareViaText = useCallback(() => {
    const body = encodeURIComponent(`Hey! Here's my digital business card: ${cardLink}`);
    window.open(`sms:?&body=${body}`, "_blank");
    track("sms");
  }, [cardLink, track]);

  const handleShareViaEmail = useCallback(() => {
    const subject = encodeURIComponent(`${profile.name} — Digital Business Card`);
    const body = encodeURIComponent(`Hi,\n\nHere's my digital business card:\n${cardLink}\n\nBest,\n${profile.name}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    track("email");
  }, [profile.name, cardLink, track]);

  const handleShareViaWhatsApp = useCallback(() => {
    const text = encodeURIComponent(`Hey! Here's my digital business card: ${cardLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
    track("whatsapp");
  }, [cardLink, track]);

  const handleShareViaLinkedIn = useCallback(() => {
    const url = encodeURIComponent(cardLink);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
    track("linkedin");
  }, [cardLink, track]);

  const handleShareViaInstagram = useCallback(() => {
    navigator.clipboard.writeText(cardLink);
    window.open("instagram://story-camera", "_blank");
    track("instagram");
    toast.success("Card link copied — paste it in your Instagram Story");
  }, [cardLink, track]);

  const handleShareViaX = useCallback(() => {
    const text = encodeURIComponent(`Check out my digital business card! ${cardLink}`);
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
    track("x");
  }, [cardLink, track]);

  const handleNameDrop = useCallback(() => {
    toast("NameDrop requires NFC hardware — hold your phone near another iPhone to share", { icon: "📡", duration: 4000 });
  }, []);

  const handleAddToHomeScreen = useCallback(() => {
    if ((window as any).deferredPrompt) {
      (window as any).deferredPrompt.prompt();
    } else {
      toast("To add to Home Screen:\n• Safari: Tap Share → Add to Home Screen\n• Chrome: Tap ⋮ → Add to Home Screen", { icon: "📱", duration: 6000 });
    }
  }, []);

  const toggleShareOffline = useCallback(() => {
    setShareOffline((prev) => {
      toast.success(!prev ? "Offline sharing enabled — QR code works without internet" : "Online sharing mode");
      return !prev;
    });
  }, []);

  const handleSaveQRImage = useCallback((qrRef: React.RefObject<HTMLDivElement>, qrStyle: QrStyle) => {
    const svgEl = qrRef.current?.querySelector("svg");
    if (!svgEl) { toast.error("QR code not found"); return; }
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = qrStyle.bgColor;
      ctx.fillRect(0, 0, 600, 600);
      ctx.drawImage(img, 50, 50, 500, 500);
      const link = document.createElement("a");
      link.download = `${profile.name.replace(/\s+/g, "_")}_QR.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("QR code saved to photos");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [profile.name]);

  return {
    vcardString, cardLink, walletLoading, shareOffline,
    handleShare, handleCopyLink, handleSaveVCF, handleAddToWallet,
    handleShareViaText, handleShareViaEmail, handleShareViaWhatsApp,
    handleShareViaLinkedIn, handleShareViaInstagram, handleShareViaX,
    handleNameDrop, handleAddToHomeScreen, toggleShareOffline, handleSaveQRImage,
  };
}
