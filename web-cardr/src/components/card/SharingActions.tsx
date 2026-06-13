import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, QrCode, Smartphone, MessageSquare, Mail, Send, Wallet,
  Linkedin, Instagram, Twitter, Nfc, MonitorSmartphone, WifiOff,
  Palette, Download, X,
} from "lucide-react";
import QrCustomizer, { type QrStyle } from "@/components/QrCustomizer";

interface SharingActionsProps {
  isIOS: boolean;
  walletLoading: boolean;
  shareOffline: boolean;
  showQrCustomizer: boolean;
  qrStyle: QrStyle;
  onCopyLink: () => void;
  onShowQR: () => void;
  onSaveVCF: () => void;
  onAddToWallet: () => void;
  onShareViaText: () => void;
  onShareViaEmail: () => void;
  onShareViaLinkedIn: () => void;
  onShareViaWhatsApp: () => void;
  onShareViaInstagram: () => void;
  onShareViaX: () => void;
  onNameDrop: () => void;
  onAddToHomeScreen: () => void;
  onToggleShareOffline: () => void;
  onToggleQrCustomizer: () => void;
  onSaveQRImage: () => void;
  onQrStyleChange: (style: QrStyle) => void;
}

const SharingActions = ({
  isIOS, walletLoading, shareOffline, showQrCustomizer, qrStyle,
  onCopyLink, onShowQR, onSaveVCF, onAddToWallet,
  onShareViaText, onShareViaEmail, onShareViaLinkedIn, onShareViaWhatsApp,
  onShareViaInstagram, onShareViaX, onNameDrop, onAddToHomeScreen,
  onToggleShareOffline, onToggleQrCustomizer, onSaveQRImage, onQrStyleChange,
}: SharingActionsProps) => {
  const socialItems = [
    { label: "Share via LinkedIn", icon: Linkedin, action: onShareViaLinkedIn, color: "text-[#0A66C2]" },
    { label: "Share via WhatsApp", icon: Send, action: onShareViaWhatsApp, color: "text-[#25D366]" },
    { label: "Share via Instagram", icon: Instagram, action: onShareViaInstagram, color: "text-[#E4405F]" },
    { label: "Share via X", icon: Twitter, action: onShareViaX, color: "text-foreground" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
      className="space-y-2.5 mb-5"
    >
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={onCopyLink} className="card-interactive p-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
          <Copy size={14} className="text-primary" /> Copy Link
        </button>
        <button onClick={onShowQR} className="card-interactive p-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
          <QrCode size={14} className="text-primary" /> QR Code
        </button>
      </div>

      <button onClick={onSaveVCF} className="w-full card-interactive p-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
        <Smartphone size={15} className="text-primary" /> Save to Phone Contacts
      </button>

      {isIOS && (
        <button onClick={onAddToWallet} disabled={walletLoading}
          className="w-full card-interactive p-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-foreground disabled:opacity-50"
        >
          <Wallet size={15} className="text-primary" />
          {walletLoading ? "Generating…" : "Add to Apple Wallet"}
        </button>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={onShareViaText} className="card-interactive p-3 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquare size={14} className="text-primary" /> Via Text
        </button>
        <button onClick={onShareViaEmail} className="card-interactive p-3 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
          <Mail size={14} className="text-primary" /> Via Email
        </button>
      </div>

      <div className="card-elevated p-1 space-y-0.5">
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Share via Social</p>
        {socialItems.map(({ label, icon: Icon, action, color }) => (
          <button key={label} onClick={action}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors"
          >
            <Icon size={16} className={color} />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </button>
        ))}
      </div>

      <div className="card-elevated p-1 space-y-0.5">
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">More Options</p>
        {isIOS && (
          <button onClick={onNameDrop}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors"
          >
            <Nfc size={16} className="text-primary" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground block">NameDrop</span>
              <span className="text-[10px] text-muted-foreground">Tap phones to share</span>
            </div>
          </button>
        )}
        <button onClick={onAddToHomeScreen}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors"
        >
          <MonitorSmartphone size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Add QR to Home Screen</span>
        </button>
        <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <WifiOff size={16} className={shareOffline ? "text-primary" : "text-muted-foreground"} />
          <span className="text-sm font-medium text-foreground flex-1">Share Offline</span>
          <button onClick={onToggleShareOffline}
            className={`relative w-10 h-6 rounded-full transition-colors ${shareOffline ? "bg-primary" : "bg-secondary"}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-card shadow transition-transform ${shareOffline ? "translate-x-4" : ""}`} />
          </button>
        </div>
      </div>

      <div className="card-elevated p-1 space-y-0.5">
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">QR Code</p>
        <button onClick={onToggleQrCustomizer}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors"
        >
          <Palette size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Customize QR Code</span>
        </button>
        <button onClick={onSaveQRImage}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors"
        >
          <Download size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Save QR Code to Photos</span>
        </button>
      </div>

      <AnimatePresence>
        {showQrCustomizer && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="card-elevated p-4 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Customize QR</h3>
              <button onClick={onToggleQrCustomizer} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                <X size={13} />
              </button>
            </div>
            <QrCustomizer style={qrStyle} onChange={onQrStyleChange} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SharingActions;
