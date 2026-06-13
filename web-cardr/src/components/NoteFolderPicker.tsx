import { useEffect, useState, useCallback } from "react";
import { FolderOpen, Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface FolderItem { id: string; name: string; emoji: string }

interface Props {
  noteId: string;
  initialFolderId: string | null;
  onChange?: (folderId: string | null) => void;
  className?: string;
}

const EMOJIS = ["📌", "💼", "🎯", "🤝", "🧠", "🔥", "📞", "🚀", "💡", "📊"];

const NoteFolderPicker = ({ noteId, initialFolderId, onChange, className }: Props) => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📌");

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("folders").select("*").eq("user_id", user.id).order("name");
    setFolders((data || []).map((f: any) => ({ id: f.id, name: f.name, emoji: f.emoji })));
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFolderId(initialFolderId); }, [initialFolderId]);

  const save = async (id: string | null) => {
    setFolderId(id);
    setOpen(false);
    onChange?.(id);
    if (!user) return;
    const { error } = await supabase.from("meeting_notes").update({ folder_id: id }).eq("id", noteId).eq("user_id", user.id);
    if (error) toast.error("Failed to save folder");
  };

  const createFolder = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from("folders").insert({ user_id: user.id, name: newName.trim(), emoji: newEmoji }).select().single();
    if (error) { toast.error("Failed to create folder"); return; }
    if (data) {
      const f = { id: data.id, name: data.name, emoji: data.emoji };
      setFolders(prev => [...prev, f]);
      setNewName("");
      await save(f.id);
    }
  };

  const current = folders.find(f => f.id === folderId);

  return (
    <div className={className}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
          current ? "bg-primary/10 text-primary hover:bg-primary/15" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
        }`}
      >
        {current ? (
          <><span>{current.emoji}</span> {current.name}</>
        ) : (
          <><FolderOpen size={11} /> Add to folder</>
        )}
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-xl bg-card border border-border space-y-2 max-w-xs">
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => save(f.id)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  folderId === f.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <span>{f.emoji}</span> {f.name}
                {folderId === f.id && <Check size={9} />}
              </button>
            ))}
            {folders.length === 0 && <p className="text-xs text-muted-foreground">No folders yet.</p>}
          </div>
          <div className="border-t border-border pt-2 space-y-1.5">
            <div className="flex gap-1">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setNewEmoji(e)} className={`w-6 h-6 rounded-md text-sm ${newEmoji === e ? "bg-primary/15" : "hover:bg-secondary"}`}>{e}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
                placeholder="New folder…"
                className="flex-1 h-8 px-2 rounded-lg bg-background border border-border text-xs"
              />
              <button onClick={createFolder} disabled={!newName.trim()} className="px-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                <Plus size={12} />
              </button>
            </div>
            {folderId && (
              <button onClick={() => save(null)} className="w-full text-[11px] text-muted-foreground py-1 hover:text-destructive flex items-center justify-center gap-1">
                <X size={10} /> Remove from folder
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteFolderPicker;
