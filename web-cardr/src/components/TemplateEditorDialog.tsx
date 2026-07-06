import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, List, AlignLeft, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import {
  useCustomTemplates,
  makeFieldKey,
  CustomNoteTemplate,
  CustomTemplateField,
} from "@/hooks/useCustomTemplates";

interface EditableField {
  label: string;
  description: string;
  type: "list" | "text";
}

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this template; otherwise it creates a new one. */
  template?: CustomNoteTemplate | null;
  /** Called with the saved template so callers can auto-select it. */
  onSaved?: (tpl: CustomNoteTemplate) => void;
  onDeleted?: (id: string) => void;
}

const EMOJI_CHOICES = ["📝", "🎤", "🧠", "🤝", "🎓", "🩺", "⚖️", "🏗️", "💼", "🔬", "🎨", "🚀"];

/**
 * Meetily-style custom template editor — define your own meeting type and
 * exactly what the AI should extract from the transcript.
 */
const TemplateEditorDialog = ({ open, onOpenChange, template, onSaved, onDeleted }: TemplateEditorDialogProps) => {
  const { t } = useLanguage();
  const { saveTemplate, deleteTemplate, saving, orgId } = useCustomTemplates();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📝");
  const [description, setDescription] = useState("");
  const [guidance, setGuidance] = useState("");
  const [fields, setFields] = useState<EditableField[]>([{ label: "", description: "", type: "list" }]);
  const [shared, setShared] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setEmoji(template.emoji || "📝");
      setDescription(template.description);
      setGuidance(template.guidance);
      setShared(template.isShared);
      setFields(
        template.fields.length > 0
          ? template.fields.map((f) => ({ label: f.label, description: f.description, type: f.type }))
          : [{ label: "", description: "", type: "list" }]
      );
    } else {
      setName("");
      setEmoji("📝");
      setDescription("");
      setGuidance("");
      setShared(false);
      setFields([{ label: "", description: "", type: "list" }]);
    }
  }, [open, template]);

  const updateField = (i: number, patch: Partial<EditableField>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error(t("templates.nameRequired"));
      return;
    }
    const cleanFields: CustomTemplateField[] = [];
    const seen = new Set<string>();
    for (const f of fields) {
      const label = f.label.trim();
      if (!label) continue;
      let key = makeFieldKey(label);
      if (!key) continue;
      while (seen.has(key)) key = `${key}2`.slice(0, 40);
      seen.add(key);
      cleanFields.push({ key, label, description: f.description.trim(), type: f.type });
    }
    if (cleanFields.length === 0 && !guidance.trim()) {
      toast.error(t("templates.fieldRequired"));
      return;
    }
    try {
      const saved = await saveTemplate({
        id: template?.id,
        name: cleanName,
        emoji,
        description: description.trim(),
        fields: cleanFields,
        guidance: guidance.trim(),
        isShared: shared,
      });
      toast.success(t("templates.saved"));
      onOpenChange(false);
      onSaved?.(saved);
    } catch (e) {
      console.error("Template save failed:", e);
      toast.error(t("templates.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    setDeleting(true);
    try {
      await deleteTemplate(template.id);
      toast.success(t("templates.deleted"));
      onOpenChange(false);
      onDeleted?.(template.id);
    } catch (e) {
      console.error("Template delete failed:", e);
      toast.error(t("templates.saveFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {template ? t("templates.editTitle") : t("templates.newTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Emoji picker */}
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${
                  emoji === e ? "bg-primary/15 ring-2 ring-primary/40" : "bg-secondary hover:bg-secondary/70"
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Name + description */}
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t("templates.namePlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
              placeholder={t("templates.descPlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Fields */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1">{t("templates.sections")}</p>
            <p className="text-[11px] text-muted-foreground mb-2">{t("templates.sectionsHint")}</p>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-secondary/50 border border-border/60 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={f.label}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                      maxLength={60}
                      placeholder={t("templates.fieldLabelPlaceholder")}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50 placeholder:font-normal"
                    />
                    <button
                      onClick={() => updateField(i, { type: f.type === "list" ? "text" : "list" })}
                      title={f.type === "list" ? t("templates.typeList") : t("templates.typeText")}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card border border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {f.type === "list" ? <List size={11} /> : <AlignLeft size={11} />}
                      {f.type === "list" ? t("templates.typeList") : t("templates.typeText")}
                    </button>
                    <button
                      onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={fields.length === 1}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <input
                    value={f.description}
                    onChange={(e) => updateField(i, { description: e.target.value })}
                    maxLength={300}
                    placeholder={t("templates.fieldDescPlaceholder")}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                  />
                </div>
              ))}
            </div>
            {fields.length < 12 && (
              <button
                onClick={() => setFields((prev) => [...prev, { label: "", description: "", type: "list" }])}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
              >
                <Plus size={13} />
                {t("templates.addSection")}
              </button>
            )}
          </div>

          {/* Extra guidance */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1">{t("templates.guidance")}</p>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              maxLength={1200}
              rows={3}
              placeholder={t("templates.guidancePlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          {/* Team sharing */}
          {orgId && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/60">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users size={15} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{t("templates.shareWithTeam")}</p>
                <p className="text-[11px] text-muted-foreground">{t("templates.shareWithTeamHint")}</p>
              </div>
              <Switch checked={shared} onCheckedChange={setShared} />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {template && (
              <button
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {t("templates.delete")}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {template ? t("templates.save") : t("templates.create")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateEditorDialog;
