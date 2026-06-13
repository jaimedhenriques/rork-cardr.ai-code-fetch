import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mic, X } from "lucide-react";

/**
 * Detects when the app regains focus (user returns from a phone call)
 * and shows a prompt asking if they want to record/log the call.
 * Only triggers if the user was away for 5+ seconds (likely a call).
 */
const IncomingCallPrompt = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const [hiddenAt, setHiddenAt] = useState<number | null>(null);

  // Don't show on the recording page or on public marketing/auth pages
  const PUBLIC_ROUTES = ["/", "/landing", "/auth", "/pricing", "/reset-password", "/unsubscribe"];
  const isOnRecordPage = location.pathname === "/notes/record";
  const isPublicRoute =
    PUBLIC_ROUTES.includes(location.pathname) ||
    location.pathname.startsWith("/c/") ||
    location.pathname.startsWith("/n/") ||
    location.pathname.startsWith("/r/");
  const suppressed = isOnRecordPage || isPublicRoute;

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      setHiddenAt(Date.now());
    } else if (hiddenAt) {
      const awaySeconds = (Date.now() - hiddenAt) / 1000;
      // Only show if away for 5-600 seconds (likely a phone call, not a quick app switch)
      if (awaySeconds >= 5 && awaySeconds <= 600 && !suppressed) {
        // Check if dismissed recently
        const lastDismissed = localStorage.getItem("cardscanpro_call_prompt_dismissed");
        if (!lastDismissed || Date.now() - parseInt(lastDismissed) > 60000) {
          setShow(true);
        }
      }
      setHiddenAt(null);
    }
  }, [hiddenAt, suppressed]);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleVisibilityChange]);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("cardscanpro_call_prompt_dismissed", Date.now().toString());
  };

  const startRecording = () => {
    setShow(false);
    navigate("/notes/record", {
      state: {
        prefillTitle: "Phone call",
        templateId: "phone-call",
        autoRecord: false,
      },
    });
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          className="fixed bottom-24 left-4 right-4 z-50 max-w-lg mx-auto"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                <Phone size={18} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Just finished a call?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record a voice memo to capture key points while they're fresh.
                </p>
              </div>
              <button
                onClick={dismiss}
                className="w-7 h-7 rounded-lg hover:bg-muted/60 flex items-center justify-center shrink-0 transition-colors"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={dismiss}
                className="flex-1 h-10 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-muted transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={startRecording}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-semibold hover:opacity-90 transition-opacity active:scale-[0.98]"
              >
                <Mic size={14} />
                Record Notes
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallPrompt;
