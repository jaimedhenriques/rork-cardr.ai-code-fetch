import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { QrStyle } from "@/components/QrCustomizer";

interface QRModalProps {
  open: boolean;
  onClose: () => void;
  vcardString: string;
  qrStyle: QrStyle;
  profileName: string;
  profileTitle: string;
  profileCompany: string;
  onShare: () => void;
  onSaveQRImage: () => void;
}

const QRModal = ({ open, onClose, vcardString, qrStyle, profileName, profileTitle, profileCompany, onShare, onSaveQRImage }: QRModalProps) => (
  <AnimatePresence>
    {open && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="card-elevated p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-display font-bold text-foreground">QR Code</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <X size={15} className="text-muted-foreground" />
            </button>
          </div>
          <div className="rounded-2xl p-6 flex flex-col items-center mb-4 border border-border/60" style={{ backgroundColor: qrStyle.bgColor }}>
            <QRCodeSVG value={vcardString} size={200} level="M" bgColor={qrStyle.bgColor} fgColor={qrStyle.fgColor}
              {...(qrStyle.logoDataUrl ? { imageSettings: { src: qrStyle.logoDataUrl, height: 48, width: 48, excavate: true } } : {})}
            />
            <p className="text-sm font-semibold text-foreground mt-3">{profileName}</p>
            <p className="text-xs text-muted-foreground">{profileTitle} · {profileCompany}</p>
          </div>
          <p className="text-center text-sm text-muted-foreground mb-4">
            Have someone point their camera at this QR code to share your card
          </p>
          <div className="space-y-2">
            <button onClick={onShare} className="w-full btn-primary flex items-center justify-center gap-2">
              <Share2 size={15} /> Share Card
            </button>
            <button onClick={onSaveQRImage} className="w-full btn-secondary flex items-center justify-center gap-2 text-sm">
              <Download size={14} /> Save QR to Photos
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default QRModal;
