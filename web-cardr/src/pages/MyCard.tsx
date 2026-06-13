import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { Share2, Edit2, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useRef } from "react";
import { toast } from "sonner";
import type { QrStyle } from "@/components/QrCustomizer";
import PageHeader from "@/components/PageHeader";
import CardPreview from "@/components/card/CardPreview";
import SharingActions from "@/components/card/SharingActions";
import QRModal from "@/components/card/QRModal";
import ShareMenuModal from "@/components/card/ShareMenuModal";
import CardEditForm from "@/components/card/CardEditForm";
import { useCardSharing } from "@/hooks/useCardSharing";

const MyCard = () => {
  const { profile, setProfile } = useApp();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showQrCustomizer, setShowQrCustomizer] = useState(false);
  const [qrStyle, setQrStyle] = useState<QrStyle>({ fgColor: "#1a1a2e", bgColor: "#ffffff", logoDataUrl: null });
  const [form, setForm] = useState(profile);
  const qrRef = useRef<HTMLDivElement>(null);

  const sharing = useCardSharing(profile as any);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleSave = () => {
    setProfile(form);
    setEditing(false);
    toast.success(t("card.updated"));
  };

  const saveQRImage = () => sharing.handleSaveQRImage(qrRef, qrStyle);

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-display font-bold text-foreground">{t("card.title")}</h1>
        <div className="flex gap-2">
          <button onClick={() => { setForm(profile); setEditing(!editing); }} className="card-elevated p-2.5 rounded-xl">
            {editing ? <X size={15} className="text-muted-foreground" /> : <Edit2 size={15} className="text-muted-foreground" />}
          </button>
          <button onClick={() => setShowShareMenu(true)} className="btn-primary px-4 py-2.5 flex items-center gap-1.5 text-sm rounded-xl">
            <Share2 size={13} /> {t("card.share")}
          </button>
        </div>
      </motion.div>

      <CardPreview profile={profile} vcardString={sharing.vcardString} qrStyle={qrStyle} qrRef={qrRef} />

      <SharingActions
        isIOS={isIOS}
        walletLoading={sharing.walletLoading}
        shareOffline={sharing.shareOffline}
        showQrCustomizer={showQrCustomizer}
        qrStyle={qrStyle}
        onCopyLink={sharing.handleCopyLink}
        onShowQR={() => setShowQR(true)}
        onSaveVCF={sharing.handleSaveVCF}
        onAddToWallet={sharing.handleAddToWallet}
        onShareViaText={sharing.handleShareViaText}
        onShareViaEmail={sharing.handleShareViaEmail}
        onShareViaLinkedIn={sharing.handleShareViaLinkedIn}
        onShareViaWhatsApp={sharing.handleShareViaWhatsApp}
        onShareViaInstagram={sharing.handleShareViaInstagram}
        onShareViaX={sharing.handleShareViaX}
        onNameDrop={sharing.handleNameDrop}
        onAddToHomeScreen={sharing.handleAddToHomeScreen}
        onToggleShareOffline={sharing.toggleShareOffline}
        onToggleQrCustomizer={() => setShowQrCustomizer(!showQrCustomizer)}
        onSaveQRImage={saveQRImage}
        onQrStyleChange={setQrStyle}
      />

      <QRModal
        open={showQR}
        onClose={() => setShowQR(false)}
        vcardString={sharing.vcardString}
        qrStyle={qrStyle}
        profileName={profile.name}
        profileTitle={profile.title}
        profileCompany={profile.company}
        onShare={sharing.handleShare}
        onSaveQRImage={saveQRImage}
      />

      <ShareMenuModal
        open={showShareMenu}
        onClose={() => setShowShareMenu(false)}
        vcardString={sharing.vcardString}
        qrStyle={qrStyle}
        isIOS={isIOS}
        walletLoading={sharing.walletLoading}
        shareOffline={sharing.shareOffline}
        onShare={sharing.handleShare}
        onCopyLink={sharing.handleCopyLink}
        onShareViaText={sharing.handleShareViaText}
        onShareViaEmail={sharing.handleShareViaEmail}
        onSaveVCF={sharing.handleSaveVCF}
        onAddToWallet={sharing.handleAddToWallet}
        onShareViaLinkedIn={sharing.handleShareViaLinkedIn}
        onShareViaWhatsApp={sharing.handleShareViaWhatsApp}
        onShareViaInstagram={sharing.handleShareViaInstagram}
        onShareViaX={sharing.handleShareViaX}
        onNameDrop={sharing.handleNameDrop}
        onAddToHomeScreen={sharing.handleAddToHomeScreen}
        onToggleShareOffline={sharing.toggleShareOffline}
        onSaveQRImage={saveQRImage}
      />

      <CardEditForm editing={editing} form={form} onFormChange={setForm} onSave={handleSave} />
    </div>
  );
};

export default MyCard;
