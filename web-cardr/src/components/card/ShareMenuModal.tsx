import { motion, AnimatePresence } from "framer-motion";
import {
  X, Share2, Copy, MessageSquare, Mail, CreditCard, Wallet,
  Linkedin, Send, Instagram, Twitter, Nfc, MonitorSmartphone,
  WifiOff, Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { QrStyle } from "@/components/QrCustomizer";

interface ShareMenuModalProps {
  open: boolean;
  onClose: () => void;
  vcardString: string;
  qrStyle: QrStyle;
  isIOS: boolean;
  walletLoading: boolean;
  shareOffline: boolean;
  onShare: () => void;
  onCopyLink: () => void;
  onShareViaText: () => void;
  onShareViaEmail: () => void;
  onSaveVCF: () => void;
  onAddToWallet: () => void;
  onShareViaLinkedIn: () => void;
  onShareViaWhatsApp: () => void;
  onShareViaInstagram: () => void;
  onShareViaX: () => void;
  onNameDrop: () => void;
  onAddToHomeScreen: () => void;
  onToggleShareOffline: () => void;
  onSaveQRImage: () => void;
}

const ShareMenuModal = ({
  open, onClose, vcardString, qrStyle, isIOS, walletLoading, shareOffline,
  onShare, onCopyLink, onShareViaText, onShareViaEmail, onSaveVCF, onAddToWallet,
  onShareViaLinkedIn, onShareViaWhatsApp, onShareViaInstagram, onShareViaX,
  onNameDrop, onAddToHomeScreen, onToggleShareOffline, onSaveQRImage,
}: ShareMenuModalProps) => {
  const shareActions = [
    { label: "Share Your Card", icon: Share2, action: onShare },
    { label: "Copy Card Link", icon: Copy, action: onCopyLink },
    { label: "Share Card via Text", icon: MessageSquare, action: onShareViaText },
    { label: "Share Card via Email", icon: Mail, action: onShareViaEmail },
  ];

  const socialActions = [
    { label: "Share Card via LinkedIn", icon: Linkedin, action: onShareViaLinkedIn, color: "text-[#0A66C2]" },
    { label: "Share Card via WhatsApp", icon: Send, action: onShareViaWhatsApp, color: "text-[#25D366]" },
    { label: "Share Card via Instagram", icon: Instagram, action: onShareViaInstagram, color: "text-[#E4405F]" },
    { label: "Share Card via X", icon: Twitter, action: onShareViaX, color: "text-foreground" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border overflow-hidden max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-lg font-display font-bold text-foreground">Share Card</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pb-4 flex flex-col items-center">
              <div className="rounded-2xl p-5 border border-border" style={{ backgroundColor: qrStyle.bgColor }}>
                <QRCodeSVG value={vcardString} size={160} level="M" bgColor={qrStyle.bgColor} fgColor={qrStyle.fgColor}
                  {...(qrStyle.logoDataUrl ? { imageSettings: { src: qrStyle.logoDataUrl, height: 36, width: 36, excavate: true } } : {})}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-3 text-center">Point a camera at this QR code to share your card</p>
            </div>

            <div className="px-4 pb-3 space-y-1">
              {shareActions.map(({ label, icon: Icon, action }) => (
                <button key={label} onClick={action}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors"
                >
                  <Icon size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-border mx-4" />

            <div className="px-4 py-2 space-y-1">
              <button onClick={onSaveVCF}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors"
              >
                <CreditCard size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Save to Contacts</span>
              </button>
              {isIOS && (
                <button onClick={onAddToWallet} disabled={walletLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors disabled:opacity-50"
                >
                  <Wallet size={16} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {walletLoading ? "Generating…" : "Add to Apple Wallet"}
                  </span>
                </button>
              )}
            </div>

            <div className="h-px bg-border mx-4" />

            <div className="px-4 py-2 space-y-1">
              {socialActions.map(({ label, icon: Icon, action, color }) => (
                <button key={label} onClick={action}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors"
                >
                  <Icon size={16} className={color} />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-border mx-4" />

            <div className="px-4 py-2 space-y-1">
              {isIOS && (
                <button onClick={onNameDrop}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors"
                >
                  <Nfc size={16} className="text-primary" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground block">NameDrop</span>
                    <span className="text-[10px] text-muted-foreground">Tap phones to share</span>
                  </div>
                </button>
              )}
              <button onClick={onAddToHomeScreen}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors"
              >
                <MonitorSmartphone size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Add QR to Home Screen</span>
              </button>
              <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl">
                <WifiOff size={16} className={shareOffline ? "text-primary" : "text-muted-foreground"} />
                <span className="text-sm font-medium text-foreground flex-1">Share Offline</span>
                <button onClick={onToggleShareOffline}
                  className={`relative w-10 h-6 rounded-full transition-colors ${shareOffline ? "bg-primary" : "bg-secondary"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-card shadow transition-transform ${shareOffline ? "translate-x-4" : ""}`} />
                </button>
              </div>
            </div>

            <div className="h-px bg-border mx-4" />

            <div className="px-4 py-2 pb-8 space-y-1">
              <button onClick={onSaveQRImage}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors"
              >
                <Download size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Save QR Code to Photos</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareMenuModal;
