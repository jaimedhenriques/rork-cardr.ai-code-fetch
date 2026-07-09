import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Loader2, X, Send, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useApp, type Contact } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface QuickEmailExportButtonProps {
  /** When provided, "Current filter" scope is shown and uses these contacts. */
  filteredContacts?: Contact[];
  /** Optional human-readable label for what "Current filter" means. */
  filterDescription?: string;
  variant?: "primary" | "secondary" | "tile";
  className?: string;
  label?: string;
}

type Scope = "all" | "filtered";

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export default function QuickEmailExportButton({
  filteredContacts,
  filterDescription,
  variant = "secondary",
  className,
  label,
}: QuickEmailExportButtonProps) {
  const { contacts } = useApp();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState<string>(user?.email ?? "");
  const hasFilteredScope =
    Array.isArray(filteredContacts) &&
    filteredContacts.length !== contacts.length;
  const [scope, setScope] = useState<Scope>(hasFilteredScope ? "filtered" : "all");

  const targetContacts = useMemo(() => {
    if (scope === "filtered" && filteredContacts) return filteredContacts;
    return contacts;
  }, [scope, filteredContacts, contacts]);

  const openDialog = () => {
    if (!user) {
      toast.error("Please sign in to email a CSV export");
      return;
    }
    if (contacts.length === 0) {
      toast.error("You don't have any contacts to export yet");
      return;
    }
    setRecipient(user.email ?? "");
    setScope(hasFilteredScope ? "filtered" : "all");
    setOpen(true);
  };

  const handleSend = async () => {
    const email = recipient.trim();
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (targetContacts.length === 0) {
      toast.error("No contacts in this selection");
      return;
    }

    setSending(true);
    try {
      const scopeLabel =
        scope === "filtered"
          ? filterDescription || `${targetContacts.length} filtered contacts`
          : `all ${targetContacts.length} contacts`;

      const { data, error } = await supabase.functions.invoke(
        "quick-export-contacts",
        {
          body: {
            recipientEmail: email,
            contactIds: scope === "filtered" ? targetContacts.map((c) => c.id) : undefined,
            scopeLabel,
            // Tag export with the browser's IANA timezone so the recipient
            // can later identify which timezone the data was generated in.
            timezone:
              (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
              "UTC",
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        `CSV with ${data?.contactCount ?? targetContacts.length} contacts sent to ${email}`,
        { icon: "📧" },
      );
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send export";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const triggerClass =
    variant === "primary"
      ? "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
      : variant === "tile"
      ? "rounded-2xl p-3 flex flex-col items-center gap-1.5 transition-all active:scale-95 card-elevated hover:border-primary/25"
      : "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-foreground hover:bg-muted transition-colors";

  return (
    <>
      <button onClick={openDialog} className={cn(triggerClass, className)}>
        {variant === "tile" ? (
          <>
            <Mail size={20} className="text-primary" />
            <span className="text-[11px] font-semibold text-foreground">
              {label ?? "Email CSV"}
            </span>
          </>
        ) : (
          <>
            <Mail size={12} /> {label ?? "Email CSV"}
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:pb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !sending && setOpen(false)}
          >
            <motion.div
              className="card-elevated w-full max-w-sm p-5 rounded-2xl max-h-[calc(100vh-7rem-env(safe-area-inset-bottom))] sm:max-h-[85vh] overflow-y-auto"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <FileSpreadsheet size={14} className="text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Email contacts as CSV
                  </p>
                </div>
                <button
                  onClick={() => !sending && setOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scope */}
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">
                What to include
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setScope("all")}
                  className={cn(
                    "p-3 rounded-xl text-left text-xs transition-all border",
                    scope === "all"
                      ? "bg-primary/10 border-primary/40 text-foreground"
                      : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <p className="font-semibold">All contacts</p>
                  <p className="text-[11px] opacity-70 mt-0.5 tabular-nums">
                    {contacts.length} total
                  </p>
                </button>
                <button
                  onClick={() => setScope("filtered")}
                  disabled={!hasFilteredScope}
                  className={cn(
                    "p-3 rounded-xl text-left text-xs transition-all border",
                    scope === "filtered"
                      ? "bg-primary/10 border-primary/40 text-foreground"
                      : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary",
                    !hasFilteredScope && "opacity-40 cursor-not-allowed hover:bg-secondary/40",
                  )}
                >
                  <p className="font-semibold">Current filter</p>
                  <p className="text-[11px] opacity-70 mt-0.5 tabular-nums">
                    {hasFilteredScope
                      ? `${filteredContacts!.length} contacts`
                      : "Same as all"}
                  </p>
                </button>
              </div>

              {/* Recipient */}
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">
                Send to
              </label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="you@example.com"
                className="input-field text-xs mb-1 w-full"
                disabled={sending}
              />
              <p className="text-[11px] text-muted-foreground mb-4">
                Defaults to your account email — change to send anywhere.
              </p>

              <button
                onClick={handleSend}
                disabled={sending || !isValidEmail(recipient)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-primary-foreground bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    Send {scope === "filtered" ? targetContacts.length : contacts.length} contacts
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
