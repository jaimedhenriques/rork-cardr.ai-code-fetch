import { useEffect, useMemo, useState } from "react";
import { Building2, RotateCcw, Check, AlertTriangle, FileText, User as UserIcon } from "lucide-react";
import { CRM_OPTIONS, type CrmTarget } from "@/lib/crm-sync";
import {
  CONFLICT_POLICIES, NOTE_FIELDS, CONTACT_FIELDS,
  defaultMapping, getMapping, saveMapping, resetMapping,
  type CrmFieldMapping, type ConflictPolicy,
} from "@/lib/crm-field-mapping";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Props { onClose?: () => void }

const CrmFieldMappingEditor = ({ onClose }: Props) => {
  const [target, setTarget] = useState<CrmTarget>(CRM_OPTIONS[0].id);
  const [mapping, setMapping] = useState<CrmFieldMapping>(defaultMapping());
  const [section, setSection] = useState<"notes" | "contacts">("notes");

  useEffect(() => { setMapping(getMapping(target)); }, [target]);

  const targetMeta = useMemo(() => CRM_OPTIONS.find(o => o.id === target)!, [target]);

  const updateNoteField = (key: string, patch: Partial<{ enabled: boolean; destField: string }>) => {
    setMapping(m => ({
      ...m,
      noteFields: { ...m.noteFields, [key]: { ...(m.noteFields as any)[key], ...patch } },
    }));
  };
  const updateContactField = (key: string, patch: Partial<{ enabled: boolean; destField: string }>) => {
    setMapping(m => ({
      ...m,
      contactFields: { ...m.contactFields, [key]: { ...(m.contactFields as any)[key], ...patch } },
    }));
  };

  const handleSave = () => {
    saveMapping(target, mapping);
    toast.success(`${targetMeta.label} mapping saved`);
    onClose?.();
  };

  const handleReset = () => {
    resetMapping(target);
    setMapping(defaultMapping());
    toast.success("Reset to defaults");
  };

  const fields = section === "notes" ? NOTE_FIELDS : CONTACT_FIELDS;
  const fieldConfig = section === "notes" ? mapping.noteFields : mapping.contactFields;
  const updater = section === "notes" ? updateNoteField : updateContactField;

  return (
    <div className="space-y-4">
      {/* CRM picker */}
      <div className="grid grid-cols-3 gap-2">
        {CRM_OPTIONS.map(opt => {
          const active = opt.id === target;
          return (
            <button
              key={opt.id}
              onClick={() => setTarget(opt.id)}
              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${active ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}`}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: opt.bg }}>
                <Building2 size={16} style={{ color: opt.color }} />
              </div>
              <span className="text-[11px] font-semibold">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40">
        <button
          onClick={() => setSection("notes")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${section === "notes" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          <FileText size={12} /> Note fields
        </button>
        <button
          onClick={() => setSection("contacts")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${section === "contacts" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          <UserIcon size={12} /> Contact fields
        </button>
      </div>

      {section === "contacts" && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/60">
          <div>
            <p className="text-sm font-semibold">Push linked contacts</p>
            <p className="text-[11px] text-muted-foreground">Upsert contacts attached to the note</p>
          </div>
          <Switch
            checked={mapping.pushContacts}
            onCheckedChange={(v) => setMapping(m => ({ ...m, pushContacts: v }))}
          />
        </div>
      )}

      {/* Field rows */}
      <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
        <div className="grid grid-cols-[auto_1fr_1.2fr] gap-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="w-9">On</span>
          <span>Cardr field</span>
          <span>{targetMeta.label} field name</span>
        </div>
        {fields.map(f => {
          const cfg = (fieldConfig as any)[f.key] ?? { enabled: true, destField: f.key };
          return (
            <div key={f.key} className={`grid grid-cols-[auto_1fr_1.2fr] gap-2 items-center p-2 rounded-lg border transition-all ${cfg.enabled ? "border-border/60 bg-background" : "border-border/40 bg-muted/20 opacity-60"}`}>
              <Switch
                checked={cfg.enabled}
                onCheckedChange={(v) => updater(f.key, { enabled: v })}
                className="scale-75"
              />
              <span className="text-xs font-medium truncate">{f.label}</span>
              <Input
                value={cfg.destField}
                onChange={(e) => updater(f.key, { destField: e.target.value })}
                placeholder={f.key}
                disabled={!cfg.enabled}
                className="h-8 text-xs"
              />
            </div>
          );
        })}
      </div>

      {/* Conflict policy */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={12} className="text-warning" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conflict handling</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CONFLICT_POLICIES.map(p => {
            const active = mapping.conflictPolicy === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setMapping(m => ({ ...m, conflictPolicy: p.id as ConflictPolicy }))}
                className={`text-left p-2.5 rounded-xl border-2 transition-all ${active ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold">{p.label}</span>
                  {active && <Check size={12} className="text-primary" />}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border/60">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <RotateCcw size={11} /> Reset
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Save mapping
        </button>
      </div>
    </div>
  );
};

export default CrmFieldMappingEditor;
