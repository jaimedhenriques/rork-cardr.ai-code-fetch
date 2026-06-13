import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { CRM_OPTIONS, pushNoteToCrm, type CrmTarget, type NoteCrmPayload } from "@/lib/crm-sync";

interface Props { note: NoteCrmPayload; }

const CrmPushButton = ({ note }: Props) => {
  const [open, setOpen] = useState(false);
  const [pushing, setPushing] = useState<CrmTarget | null>(null);
  const [done, setDone] = useState<CrmTarget | null>(null);

  const handlePush = async (target: CrmTarget) => {
    setPushing(target);
    try {
      await pushNoteToCrm(target, note);
      setDone(target);
      toast.success(`Sent to ${CRM_OPTIONS.find(c => c.id === target)?.label}`, {
        description: "Check your Zapier/Pipedream workflow history",
      });
      setTimeout(() => { setOpen(false); setDone(null); }, 1200);
    } catch (e: any) {
      toast.error("Push failed", { description: e?.message || "Unknown error" });
    } finally {
      setPushing(null);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center" aria-label="Sync to CRM">
        <Building2 size={14} className="text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div className="w-full max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-5 m-0 sm:m-4 shadow-xl" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold">Sync to CRM</h3>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"><X size={16} /></button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Pushes this note + linked contacts via your Zapier/Pipedream workflow.</p>
              <div className="space-y-2">
                {CRM_OPTIONS.map(opt => {
                  const isPushing = pushing === opt.id;
                  const isDone = done === opt.id;
                  return (
                    <button key={opt.id} onClick={() => handlePush(opt.id)} disabled={isPushing} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border/60 hover:border-primary/40 hover:shadow-sm transition-all disabled:opacity-60">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: opt.bg }}>
                        <Building2 size={18} style={{ color: opt.color }} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">via webhook</p>
                      </div>
                      {isPushing && <Loader2 size={16} className="animate-spin text-primary" />}
                      {isDone && <Check size={16} className="text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CrmPushButton;
