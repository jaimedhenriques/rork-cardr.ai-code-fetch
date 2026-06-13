import { useState, useEffect } from "react";
import { Folder, Check, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Props {
  noteId: string;
  initialCategory: string | null;
  onChange?: (category: string | null) => void;
}

const SUGGESTED = ["Sales call", "Discovery", "Internal", "Standup", "1:1", "Customer feedback", "Brainstorm", "Interview"];

const NoteCategoryPicker = ({ noteId, initialCategory, onChange }: Props) => {
  const { user } = useAuth();
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialCategory || "");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => { setCategory(initialCategory); setDraft(initialCategory || ""); }, [initialCategory]);

  useEffect(() => {
    if (!user) return;
    supabase.from("meeting_notes").select("category").eq("user_id", user.id).not("category", "is", null).limit(50)
      .then(({ data }) => {
        const set = new Set<string>();
        (data || []).forEach((d: any) => d.category && set.add(d.category));
        setRecent(Array.from(set));
      });
  }, [user]);

  const save = async (val: string | null) => {
    setCategory(val);
    setEditing(false);
    onChange?.(val);
    if (!user) return;
    const { error } = await supabase.from("meeting_notes").update({ category: val }).eq("id", noteId).eq("user_id", user.id);
    if (error) toast.error("Failed to save category");
  };

  const allOptions = Array.from(new Set([...recent, ...SUGGESTED]));

  if (!editing && category) {
    return (
      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/15">
        <Folder size={11} /> {category} <Pencil size={9} className="opacity-60" />
      </button>
    );
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground hover:bg-secondary/80">
        <Folder size={11} /> Add category
      </button>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-card border border-border space-y-2">
      <div className="flex gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(draft.trim() || null); if (e.key === "Escape") setEditing(false); }}
          placeholder="Category name…"
          className="flex-1 h-8 px-2 rounded-lg bg-background border border-border text-xs"
        />
        <button onClick={() => save(draft.trim() || null)} className="px-2 rounded-lg bg-primary text-primary-foreground"><Check size={12} /></button>
        {category && <button onClick={() => save(null)} className="px-2 rounded-lg bg-secondary text-xs">Clear</button>}
      </div>
      {allOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allOptions.map(opt => (
            <button key={opt} onClick={() => save(opt)} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary hover:bg-secondary/80">
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NoteCategoryPicker;
