import { useEffect, useState } from "react";
import { Building2, Check, Settings2, X, Zap } from "lucide-react";
import {
  CRM_OPTIONS,
  getAutoSyncTargets,
  setAutoSyncTargets,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  type CrmTarget,
} from "@/lib/crm-sync";
import CrmFieldMappingEditor from "./CrmFieldMappingEditor";
import CrmSyncLogPanel from "./CrmSyncLogPanel";
import { toast } from "sonner";

const CrmAutoSyncSettings = () => {
  const [targets, setTargets] = useState<CrmTarget[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setTargets(getAutoSyncTargets());
    setEnabled(isAutoSyncEnabled());
  }, []);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    setAutoSyncEnabled(next);
    toast.success(next ? "Auto-sync enabled" : "Auto-sync paused");
  };

  const toggle = (id: CrmTarget) => {
    const next = targets.includes(id) ? targets.filter(t => t !== id) : [...targets, id];
    setTargets(next);
    setAutoSyncTargets(next);
  };

  return (
    <div className="space-y-3 mt-3">
      {/* Global master toggle */}
      <div className={`card-elevated p-4 transition-colors ${enabled ? "border-primary/30" : "border-border/60"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${enabled ? "bg-primary/10" : "bg-muted"}`}>
              <Zap size={15} className={enabled ? "text-primary" : "text-muted-foreground"} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Auto-sync to CRM</h3>
              <p className="text-[11px] text-muted-foreground truncate">
                {enabled
                  ? targets.length
                    ? `Notes auto-push to ${targets.length} CRM${targets.length > 1 ? "s" : ""} on save`
                    : "Enabled — pick CRM targets below"
                  : "Paused — notes will not push automatically"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleEnabled}
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle auto-sync"
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>

      <div className={`card-elevated p-4 transition-opacity ${enabled ? "" : "opacity-50 pointer-events-none"}`}>

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-primary" />
          <h3 className="text-sm font-semibold">Auto-sync notes to CRM</h3>
        </div>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          <Settings2 size={11} /> Field mapping
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">When a note is saved, automatically push it (and linked contacts) to the selected CRMs via your webhook workflow.</p>
      <div className="space-y-2">
        {CRM_OPTIONS.map(opt => {
          const active = targets.includes(opt.id);
          return (
            <button key={opt.id} onClick={() => toggle(opt.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${active ? "border-primary/50 bg-primary/5" : "border-border/60 hover:border-border"}`}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: opt.bg }}>
                <Building2 size={16} style={{ color: opt.color }} />
              </div>
              <span className="flex-1 text-left text-sm font-medium">{opt.label}</span>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {active && <Check size={12} />}
              </span>
            </button>
          );
        })}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm" onClick={() => setEditorOpen(false)}>
          <div className="w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <div>
                <h2 className="text-base font-bold">CRM field mapping</h2>
                <p className="text-[11px] text-muted-foreground">Control what data flows to each CRM and how conflicts are resolved.</p>
              </div>
              <button onClick={() => setEditorOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <CrmFieldMappingEditor onClose={() => setEditorOpen(false)} />
            </div>
          </div>
        </div>
      )}
      </div>

      <CrmSyncLogPanel />
    </div>
  );
};

export default CrmAutoSyncSettings;
