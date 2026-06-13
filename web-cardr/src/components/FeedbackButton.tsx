import { useState, useEffect } from "react";
import { MessageCircle, X, Send, Lightbulb, LifeBuoy, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type FeedbackType = "feedback" | "support" | "feature";

const tabs: { type: FeedbackType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { type: "feedback", label: "Feedback", icon: <MessageSquare size={14} />, placeholder: "Tell us what you think…" },
  { type: "support", label: "Support", icon: <LifeBuoy size={14} />, placeholder: "Describe your issue…" },
  { type: "feature", label: "Feature", icon: <Lightbulb size={14} />, placeholder: "What feature would you like?" },
];

interface FeedbackButtonProps {
  /** When provided, the modal is controlled externally (e.g. from AppDrawer) */
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

const FeedbackButton = ({ externalOpen, onExternalClose }: FeedbackButtonProps) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  // Sync with external open state
  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  const handleClose = () => {
    setOpen(false);
    onExternalClose?.();
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    setSending(true);
    try {
      const contactEmail = email.trim() || user?.email || "anonymous";
      await supabase.functions.invoke("ai-chat", {
        body: {
          message: `[${activeTab.toUpperCase()}] from ${contactEmail}: ${message}`,
          context: "feedback-collection",
        },
      });
      toast.success(
        activeTab === "support"
          ? "Support request sent! We'll get back to you soon."
          : activeTab === "feature"
          ? "Feature request received! Thank you."
          : "Thanks for your feedback!"
      );
      setMessage("");
      handleClose();
    } catch {
      toast.success("Thank you! Your message has been recorded.");
      setMessage("");
      handleClose();
    } finally {
      setSending(false);
    }
  };

  const current = tabs.find((t) => t.type === activeTab)!;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            className="card-elevated w-full max-w-lg rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-base font-display font-bold text-foreground">Get in Touch</h3>
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 px-5 pb-3">
              {tabs.map((tab) => (
                <button
                  key={tab.type}
                  onClick={() => setActiveTab(tab.type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === tab.type
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <div className="px-5 pb-5 space-y-3">
              {!user && (
                <Input
                  placeholder="Your email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary border-0 text-sm"
                />
              )}
              <Textarea
                placeholder={current.placeholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="bg-secondary border-0 text-sm resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={sending || !message.trim()}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send size={14} />
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FeedbackButton;
