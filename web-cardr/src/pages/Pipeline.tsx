import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Plus, Settings2, ChevronDown, Phone, Mail, Calendar, Loader2, GripVertical, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { format, parseISO } from "date-fns";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

const DEFAULT_STAGES = [
  { name: "New", color: "#6366f1", sort_order: 0 },
  { name: "Contacted", color: "#f59e0b", sort_order: 1 },
  { name: "Qualified", color: "#3b82f6", sort_order: 2 },
  { name: "Proposal", color: "#8b5cf6", sort_order: 3 },
  { name: "Negotiation", color: "#ec4899", sort_order: 4 },
  { name: "Won", color: "#10b981", sort_order: 5 },
  { name: "Lost", color: "#ef4444", sort_order: 6 },
];

const Pipeline = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { contacts, updateContact } = useApp();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const STAGE_COLORS = ["#6366f1", "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

  const fetchStages = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order");

    if (data && data.length > 0) {
      setStages(data);
    } else {
      // Create default stages
      const inserts = DEFAULT_STAGES.map((s) => ({ ...s, user_id: user.id }));
      const { data: created } = await supabase.from("pipeline_stages").insert(inserts).select();
      if (created) setStages(created);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchStages(); }, [fetchStages]);

  const addStage = async () => {
    if (!newStageName.trim() || !user) return;
    const { data } = await supabase.from("pipeline_stages").insert({
      user_id: user.id,
      name: newStageName.trim(),
      color: newStageColor,
      sort_order: stages.length,
    }).select().single();
    if (data) {
      setStages((prev) => [...prev, data]);
      setNewStageName("");
      toast.success(t("pipeline.stageAdded"));
    }
  };

  const deleteStage = async (id: string) => {
    if (!user) return;
    await supabase.from("pipeline_stages").delete().eq("id", id).eq("user_id", user.id);
    setStages((prev) => prev.filter((s) => s.id !== id));
    toast.success(t("pipeline.stageRemoved"));
  };

  const moveContact = async (contactId: string, stageId: string | null) => {
    updateContact(contactId, { stageId: stageId || undefined } as any);
    if (user) {
      await supabase.from("contacts").update({ stage_id: stageId }).eq("id", contactId).eq("user_id", user.id);
    }
    // Log activity
    if (user && stageId) {
      const stage = stages.find((s) => s.id === stageId);
      const contact = contacts.find((c) => c.id === contactId);
      if (stage && contact) {
        await supabase.from("contact_activities").insert({
          user_id: user.id,
          contact_id: contactId,
          type: "stage_change",
          title: `Moved to ${stage.name}`,
          description: `${contact.name} moved to ${stage.name} stage`,
        });
      }
    }
    toast.success(t("pipeline.contactMoved"));
  };

  const getContactsForStage = (stageId: string | null) => {
    if (stageId === null) {
      return contacts.filter((c) => !(c as any).stageId && !(c as any).stage_id);
    }
    return contacts.filter((c) => (c as any).stageId === stageId || (c as any).stage_id === stageId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">{t("pipeline.signInRequired")}</p>
      </div>
    );
  }

  const unstaged = getContactsForStage(null);

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader rightContent={
        <button onClick={() => setShowSettings(!showSettings)} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center">
          <Settings2 size={16} className="text-muted-foreground" />
        </button>
      } />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">{t("pipeline.title")}</h1>
          <p className="text-xs text-muted-foreground tabular-nums">{contacts.length} {t("pipeline.leads")} · {stages.length} {t("pipeline.stages")}</p>
        </div>
      </motion.div>

      {/* Horizontal stage indicator with progress */}
      {stages.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {stages.map((stage) => {
              const count = getContactsForStage(stage.id).length;
              const total = contacts.filter((c) => (c as any).stageId || (c as any).stage_id).length || 1;
              const pct = Math.min(100, Math.round((count / total) * 100));
              const isExpanded = expandedStage === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                  className={`shrink-0 min-w-[88px] rounded-xl border p-2.5 text-left transition-all ${
                    isExpanded ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-[11px] font-semibold text-foreground truncate">{stage.name}</span>
                  </div>
                  <p className="text-base font-bold text-foreground leading-none mb-1.5 tabular-nums">{count}</p>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: stage.color }} />
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Stage Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="card-elevated p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("pipeline.manageStages")}</h3>
              {stages.map((stage) => (
                <div key={stage.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm text-foreground flex-1">{stage.name}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{getContactsForStage(stage.id).length}</span>
                  <button onClick={() => deleteStage(stage.id)} className="text-destructive"><X size={14} /></button>
                </div>
              ))}
              <div className="flex gap-2 pt-2 border-t border-border/60">
                <div className="flex gap-1">
                  {STAGE_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewStageColor(c)} className={`w-5 h-5 rounded-full border-2 ${newStageColor === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStage()} placeholder={t("pipeline.newStageName")} className="input-field flex-1" />
                <button onClick={addStage} className="btn-primary px-3 py-2 text-xs rounded-xl">{t("pipeline.add")}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pipeline Stages */}
      <div className="space-y-3">
        {/* Unstaged */}
        {unstaged.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
            <button onClick={() => setExpandedStage(expandedStage === "unstaged" ? null : "unstaged")} className="w-full flex items-center gap-3 p-3 card-elevated">
              <div className="w-3 h-3 rounded-full bg-muted shrink-0" />
              <span className="text-sm font-semibold text-foreground flex-1 text-left">{t("pipeline.unassigned")}</span>
              <span className="text-xs text-muted-foreground mr-1 tabular-nums">{unstaged.length}</span>
              <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedStage === "unstaged" ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {expandedStage === "unstaged" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-6 pt-1 space-y-1.5">
                    {unstaged.map((contact) => (
                      <ContactCard key={contact.id} contact={contact} stages={stages} onMove={moveContact} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {stages.map((stage, i) => {
          const stageContacts = getContactsForStage(stage.id);
          return (
            <motion.div key={stage.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <button onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)} className="w-full flex items-center gap-3 p-3 card-elevated">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="text-sm font-semibold text-foreground flex-1 text-left">{stage.name}</span>
                <span className="text-xs text-muted-foreground mr-1 tabular-nums">{stageContacts.length}</span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedStage === stage.id ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {expandedStage === stage.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pl-6 pt-1 space-y-1.5">
                      {stageContacts.length === 0 ? (
                        <div className="text-center py-8 px-4">
                          <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: stage.color + "15" }}>
                            <Plus size={16} style={{ color: stage.color }} />
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">{t("pipeline.noContacts")}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">Move contacts here from other stages</p>
                        </div>
                      ) : (
                        stageContacts.map((contact) => (
                          <ContactCard key={contact.id} contact={contact} stages={stages} onMove={moveContact} currentStageId={stage.id} />
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const ContactCard = ({ contact, stages, onMove, currentStageId }: {
  contact: any;
  stages: PipelineStage[];
  onMove: (contactId: string, stageId: string | null) => void;
  currentStageId?: string;
}) => {
  const { t } = useLanguage();
  const [showMove, setShowMove] = useState(false);

  return (
    <div className="card-elevated p-3 relative">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 avatar-circle text-[11px] shrink-0">
          {contact.name.split(" ").map((n: string) => n[0]).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{contact.title} · {contact.company}</p>
        </div>
        <button onClick={() => setShowMove(!showMove)} className="text-xs font-semibold text-primary">{t("pipeline.move")}</button>
      </div>
      {contact.follow_up_date && (
        <div className="flex items-center gap-1 mt-1.5">
          <Calendar size={10} className="text-warning" />
          <span className="text-[11px] text-warning font-medium tabular-nums">Follow-up: {format(parseISO(contact.follow_up_date), "MMM d")}</span>
        </div>
      )}
      <AnimatePresence>
        {showMove && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2 pt-2 border-t border-border/60">
            <div className="flex flex-wrap gap-1.5">
              {stages.filter((s) => s.id !== currentStageId).map((s) => (
                <button key={s.id} onClick={() => { onMove(contact.id, s.id); setShowMove(false); }} className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border/60 hover:bg-secondary transition-colors" style={{ borderColor: s.color + "40", color: s.color }}>
                  {s.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Pipeline;
