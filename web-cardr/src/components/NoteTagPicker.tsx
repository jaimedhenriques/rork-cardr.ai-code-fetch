import { useEffect, useState, useCallback } from "react";
import { Tag, X, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface TagItem { id: string; name: string; color: string }

interface Props {
  noteId: string;
  className?: string;
}

const TAG_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#22c55e", "#14b8a6"];

const NoteTagPicker = ({ noteId, className }: Props) => {
  const { user } = useAuth();
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const [tagsRes, linksRes] = await Promise.all([
      supabase.from("tags").select("*").eq("user_id", user.id).order("name"),
      supabase.from("note_tags").select("tag_id").eq("note_id", noteId),
    ]);
    setAllTags((tagsRes.data || []).map((t: any) => ({ id: t.id, name: t.name, color: t.color })));
    setSelected(new Set((linksRes.data || []).map((l: any) => l.tag_id)));
  }, [user, noteId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (tagId: string) => {
    if (selected.has(tagId)) {
      await supabase.from("note_tags").delete().eq("note_id", noteId).eq("tag_id", tagId);
      setSelected(prev => { const n = new Set(prev); n.delete(tagId); return n; });
    } else {
      await supabase.from("note_tags").insert({ note_id: noteId, tag_id: tagId });
      setSelected(prev => new Set(prev).add(tagId));
    }
  };

  const createTag = async () => {
    if (!user || !newName.trim()) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const { data, error } = await supabase.from("tags").insert({ user_id: user.id, name: newName.trim(), color }).select().single();
    if (error) { toast.error("Failed to create tag"); return; }
    if (data) {
      setAllTags(prev => [...prev, { id: data.id, name: data.name, color: data.color }]);
      await supabase.from("note_tags").insert({ note_id: noteId, tag_id: data.id });
      setSelected(prev => new Set(prev).add(data.id));
      setNewName("");
    }
  };

  const selectedTags = allTags.filter(t => selected.has(t.id));

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map(t => (
          <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${t.color}22`, color: t.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.name}
            <button onClick={() => toggle(t.id)} className="ml-0.5 opacity-60 hover:opacity-100"><X size={9} /></button>
          </span>
        ))}
        <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-secondary text-foreground hover:bg-secondary/80">
          <Tag size={10} /> {selectedTags.length === 0 ? "Add tags" : "Edit"}
        </button>
      </div>

      {open && (
        <div className="mt-2 p-3 rounded-xl bg-card border border-border space-y-2">
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createTag()} placeholder="New tag…" className="flex-1 h-8 px-2 rounded-lg bg-background border border-border text-xs" />
            <button onClick={createTag} disabled={!newName.trim()} className="px-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Plus size={12} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {allTags.map(t => (
              <button key={t.id} onClick={() => toggle(t.id)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                selected.has(t.id) ? "border-primary" : "border-border"
              }`} style={{ backgroundColor: selected.has(t.id) ? `${t.color}22` : "transparent", color: selected.has(t.id) ? t.color : undefined }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
                {selected.has(t.id) && <Check size={9} />}
              </button>
            ))}
            {allTags.length === 0 && <p className="text-xs text-muted-foreground">No tags yet — create one above.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteTagPicker;
