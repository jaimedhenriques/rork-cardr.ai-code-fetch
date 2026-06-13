import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import InstallAppCard from "./InstallAppCard";

/**
 * Floating "Install app" pill. Tap to expand into the full InstallAppCard.
 * Auto-hides when not applicable (already installed, dismissed, in iframe,
 * or browser doesn't support installation).
 */
export default function InstallAppPill() {
  const { isInstalled, canPrompt, isIos, canPromptIos, recentlyDismissed, inIframe, dismiss } = usePwaInstall();
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  const canShow =
    !hidden &&
    !isInstalled &&
    !recentlyDismissed &&
    !inIframe &&
    (canPrompt || (isIos && canPromptIos));

  if (!canShow) return null;

  const handleDismiss = () => {
    dismiss();
    setHidden(true);
  };

  return (
    <AnimatePresence>
      {expanded ? (
        <motion.div
          key="card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-24 left-4 right-4 z-40 max-w-sm mx-auto"
        >
          <InstallAppCard onDismiss={() => setExpanded(false)} />
        </motion.div>
      ) : (
        <motion.div
          key="pill"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-1.5 bg-card border border-border shadow-lg shadow-black/30 rounded-full pl-3 pr-1 py-1"
        >
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 text-xs font-semibold text-foreground"
          >
            <Download size={13} className="text-primary" />
            Install app
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="w-6 h-6 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center"
          >
            <X size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
