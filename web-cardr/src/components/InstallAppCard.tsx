import { motion } from "framer-motion";
import { Download, Share, Plus, Smartphone, CheckCircle2, X } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { toast } from "sonner";

interface InstallAppCardProps {
  variant?: "full" | "compact";
  onDismiss?: () => void;
  className?: string;
}

/**
 * Renders the right install affordance for the current device:
 * - Android/desktop Chromium: native install button.
 * - iOS Safari: step-by-step Share → Add to Home Screen instructions.
 * - Already installed: confirmation chip.
 * - Unsupported: friendly fallback note.
 */
export default function InstallAppCard({
  variant = "full",
  onDismiss,
  className = "",
}: InstallAppCardProps) {
  const { isInstalled, canPrompt, isIos, canPromptIos, inIframe, promptInstall } = usePwaInstall();

  if (isInstalled) {
    return (
      <div className={`rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3 ${className}`}>
        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Cardr is installed on this device</p>
          <p className="text-muted-foreground text-xs mt-0.5">Launch it from your home screen — no browser needed.</p>
        </div>
      </div>
    );
  }

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") toast.success("Installing Cardr…", { icon: "📲" });
    else if (outcome === "unavailable") toast.error("Install isn't available in this browser yet");
  };

  if (isIos) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border border-border bg-card p-5 ${className}`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Smartphone size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Add Cardr to your Home Screen</p>
              <p className="text-[11px] text-muted-foreground">Opens like a native app — full screen, one tap.</p>
            </div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
              <X size={14} />
            </button>
          )}
        </div>

        {!canPromptIos && (
          <p className="text-[11px] text-amber-500 mb-3">
            Open this page in <strong>Safari</strong> to install — other iOS browsers can't add to the home screen.
          </p>
        )}

        <ol className="space-y-2.5">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-secondary text-foreground text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <span className="text-sm text-foreground flex items-center gap-1.5 flex-wrap">
              Tap the <Share size={14} className="inline text-primary" /> <strong>Share</strong> button in Safari's toolbar
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-secondary text-foreground text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <span className="text-sm text-foreground flex items-center gap-1.5 flex-wrap">
              Choose <Plus size={14} className="inline text-primary" /> <strong>Add to Home Screen</strong>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-secondary text-foreground text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <span className="text-sm text-foreground">Tap <strong>Add</strong> — Cardr will appear on your home screen.</span>
          </li>
        </ol>
      </motion.div>
    );
  }

  if (canPrompt) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border border-border bg-card p-5 ${className}`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Download size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Install Cardr as an app</p>
              <p className="text-[11px] text-muted-foreground">Quick scan from your home screen — no browser needed.</p>
            </div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Download size={14} /> Install Cardr
        </button>
      </motion.div>
    );
  }

  if (variant === "compact") return null;

  return (
    <div className={`rounded-2xl border border-border bg-muted/30 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Smartphone size={18} className="text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Install on your phone</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {inIframe
              ? "Open Cardr in a new tab to install it — embedded previews can't trigger install."
              : "Open cardr.ai in mobile Safari (iOS) or Chrome (Android) to add Cardr to your home screen."}
          </p>
        </div>
      </div>
    </div>
  );
}
