import { useState } from "react";
import { Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";

interface HelpTip {
  title: string;
  description: string;
}

interface HelpButtonProps {
  tips: HelpTip[];
  screenName: string;
}

const HelpButton = ({ tips, screenName }: HelpButtonProps) => {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
        aria-label={`${t("help.ariaLabel")} ${screenName}`}
      >
        <Info size={14} className="text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="card-elevated w-full max-w-lg rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-light flex items-center justify-center">
                    <Info size={14} className="text-primary" />
                  </div>
                  <h3 className="text-base font-display font-bold text-foreground">{screenName}</h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 pb-5 space-y-3 max-h-[60vh] overflow-y-auto">
                {tips.map((tip, i) => (
                  <div key={i} className="bg-secondary/60 rounded-xl p-3.5">
                    <p className="text-xs font-semibold text-foreground mb-1">{tip.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default HelpButton;