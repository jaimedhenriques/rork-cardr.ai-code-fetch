import { forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, ScanLine, Users, Download, Shield, Mic, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hidePaidSurfaces, disableStripeUpgrades } from "@/lib/iosCompliance";
import IosManagePlanNotice from "@/components/IosManagePlanNotice";
import RestorePurchasesButton from "@/components/RestorePurchasesButton";
import { useAutoRestoreOnOpen } from "@/hooks/useAutoRestoreOnOpen";

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
  feature?: "contacts" | "enrichments" | "notes" | "transcription";
}

const FEATURE_MESSAGES: Record<string, string> = {
  contacts: "You're approaching your contact limit on the Starter plan.",
  enrichments: "You're running low on AI enrichments on the Starter plan.",
  notes: "You're approaching the meeting notes limit on the Starter plan.",
  transcription: "You're running low on transcription minutes on the Starter plan.",
};

const UpgradePrompt = forwardRef<HTMLDivElement, UpgradePromptProps>(({ open, onClose, reason, feature }, ref) => {
  const navigate = useNavigate();
  // Silently re-sync subscription state on iOS when the prompt opens —
  // catches background renewals so the user sees the right plan immediately.
  useAutoRestoreOnOpen(open);

  const perks = [
    { icon: ScanLine, text: "Unlimited contacts (Pro+)" },
    { icon: Brain, text: "Up to unlimited AI enrichments" },
    { icon: Mic, text: "Up to unlimited transcription" },
    { icon: Users, text: "Unlimited meeting notes" },
    { icon: Download, text: "All export formats (CSV, PDF, VCF)" },
    { icon: Shield, text: "Priority support & CRM integrations" },
  ];

  const message = feature ? FEATURE_MESSAGES[feature] : reason || "Upgrade to unlock more features.";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="card-elevated p-6 w-full max-w-sm relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <X size={15} className="text-muted-foreground" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center mb-4">
              <Zap size={20} className="text-primary-foreground" />
            </div>

            <h2 className="text-lg font-display font-bold text-foreground mb-1">
              {hidePaidSurfaces() ? "You've hit a Starter limit" : "Upgrade Your Plan"}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {hidePaidSurfaces()
                ? "You're on the free Starter plan. Manage or upgrade your subscription on cardr.ai — your new plan will sync back here automatically."
                : message}
            </p>

            {hidePaidSurfaces() ? (
              <>
                <IosManagePlanNotice className="mb-3" />
                <RestorePurchasesButton variant="primary" autoDismissMs={false} className="mb-2" />
                <button onClick={onClose} className="w-full text-center text-xs text-muted-foreground font-medium py-2">
                  Got it
                </button>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  {perks.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
                        <Icon size={13} className="text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{text}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-baseline gap-1.5 mb-4">
                  <span className="text-lg font-display font-bold text-foreground">Starting at</span>
                  <span className="text-2xl font-display font-bold text-foreground">$9.99</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                <button
                  onClick={() => { if (disableStripeUpgrades()) return; onClose(); navigate("/pricing"); }}
                  disabled={disableStripeUpgrades()}
                  aria-disabled={disableStripeUpgrades()}
                  title={disableStripeUpgrades() ? "Manage your plan at cardr.ai" : undefined}
                  className="btn-primary w-full flex items-center justify-center gap-2 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap size={15} /> View Plans
                </button>
                <button onClick={onClose} className="w-full text-center text-xs text-muted-foreground font-medium py-2">
                  Maybe later
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
UpgradePrompt.displayName = "UpgradePrompt";

export default UpgradePrompt;
