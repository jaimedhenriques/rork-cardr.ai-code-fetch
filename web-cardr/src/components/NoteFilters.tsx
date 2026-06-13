import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, FolderOpen, Plus, Search, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface NoteFilterState {
  sortBy: "newest" | "oldest" | "longest" | "shortest";
  tagIds: string[];
  categories: string[];
  folderIds: string[];
  hasActions: boolean;
}

export const defaultNoteFilters: NoteFilterState = {
  sortBy: "newest",
  tagIds: [],
  categories: [],
  folderIds: [],
  hasActions: false,
};

interface TagItem { id: string; name: string; color: string }
interface FolderItem { id: string; name: string; emoji: string }

const SORT_OPTIONS = [
  { value: "newest", label: "Date (Newest)" },
  { value: "oldest", label: "Date (Oldest)" },
  { value: "longest", label: "Duration (Longest)" },
  { value: "shortest", label: "Duration (Shortest)" },
];

const TAG_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4"];

interface Props {
  open: boolean;
  onClose: () => void;
  filters: NoteFilterState;
  onApply: (f: NoteFilterState) => void;
  /** All categories already used across the user's notes */
  availableCategories: string[];
}

const NoteFilters = ({ open, onClose, filters, onApply, availableCategories }: Props) => {
  const { user } = useAuth();
  const [local, setLocal] = useState<NoteFilterState>(filters);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newFolderName, setNewFolderName] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    const [tagsRes, foldersRes] = await Promise.all([
      supabase.from("tags").select("*").eq("user_id", user.id).order("name"),
      supabase.from("folders").select("*").eq("user_id", user.id).order("name"),
    ]);
    if (tagsRes.data) setTags(tagsRes.data.map((t: any) => ({ id: t.id, name: t.name, color: t.color })));
    if (foldersRes.data) setFolders(foldersRes.data.map((f: any) => ({ id: f.id, name: f.name, emoji: f.emoji })));
  }, [user]);

  useEffect(() => {
    if (open) { setLocal(filters); loadData(); }
  }, [open, filters, loadData]);

  const toggle = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !user) return;
    const { data, error } = await supabase.from("tags").insert({
      user_id: user.id, name: newTagName.trim(), color: newTagColor,
    }).select().single();
    if (error) { toast.error("Failed to create tag"); return; }
    if (data) {
      setTags(prev => [...prev, { id: data.id, name: data.name, color: data.color }]);
      setNewTagName("");
      toast.success("Tag created");
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    const { data, error } = await supabase.from("folders").insert({
      user_id: user.id, name: newFolderName.trim(), emoji: "📌",
    }).select().single();
    if (error) { toast.error("Failed to create folder"); return; }
    if (data) {
      setFolders(prev => [...prev, { id: data.id, name: data.name, emoji: data.emoji }]);
      setLocal(p => ({ ...p, folderIds: [...p.folderIds, data.id] }));
      setNewFolderName("");
      toast.success("Folder created");
    }
  };

  const apply = () => { onApply(local); onClose(); };
  const clearAll = () => setLocal(defaultNoteFilters);

  const activeCount = local.tagIds.length + local.categories.length + local.folderIds.length + (local.hasActions ? 1 : 0) + (local.sortBy !== "newest" ? 1 : 0);

  if (!open) return null;

  if (showTags) {
    const filteredTags = tags.filter(t => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()));
    return (
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-0 z-50 bg-background">
        <div className="px-5 pt-12 pb-24 h-full overflow-y-auto max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setShowTags(false)} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center">
              <ArrowLeft size={16} />
            </button>
            <button onClick={() => setShowTags(false)} className="px-4 py-2 rounded-full bg-card border border-border/60 text-sm font-semibold">Done</button>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-4">Tags</h1>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Search tags..." className="w-full h-12 pl-11 pr-4 rounded-xl bg-card border border-border text-sm" />
          </div>
          <div className="card-elevated p-3 mb-4 space-y-2">
            <div className="flex gap-2">
              <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateTag()} placeholder="New tag name..." className="flex-1 h-10 px-3 rounded-lg bg-card border border-border text-sm" />
              <button onClick={handleCreateTag} disabled={!newTagName.trim()} className="px-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Plus size={14} /></button>
            </div>
            <div className="flex gap-1.5">
              {TAG_COLORS.map(c => (
                <button key={c} onClick={() => setNewTagColor(c)} className="w-6 h-6 rounded-full border-2" style={{ backgroundColor: c, borderColor: newTagColor === c ? "white" : "transparent" }} />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            {filteredTags.map(tag => (
              <button key={tag.id} onClick={() => setLocal(p => ({ ...p, tagIds: toggle(p.tagIds, tag.id) }))} className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium">{tag.name}</span>
                </div>
                {local.tagIds.includes(tag.id) && <Check size={16} className="text-primary" />}
              </button>
            ))}
            {filteredTags.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No tags yet</p>}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-0 z-50 bg-background">
      <div className="px-5 pt-12 pb-24 h-full overflow-y-auto max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center"><ArrowLeft size={16} /></button>
          <button onClick={apply} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Apply{activeCount > 0 ? ` (${activeCount})` : ""}</button>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-5">Filter Notes</h1>

        <div className="card-elevated p-4 mb-3">
          <button onClick={() => setShowTags(true)} className="w-full flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2"><Tag size={14} /> Tags</span>
            <div className="flex items-center gap-2">
              {local.tagIds.length > 0 && <span className="text-xs text-primary font-semibold">{local.tagIds.length} selected</span>}
              <span className="text-xs text-muted-foreground">View All →</span>
            </div>
          </button>
        </div>

        <div className="card-elevated p-4 mb-3">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><FolderOpen size={14} /> Folders</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {folders.map(f => (
              <button key={f.id} onClick={() => setLocal(p => ({ ...p, folderIds: toggle(p.folderIds, f.id) }))}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  local.folderIds.includes(f.id) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"
                }`}>
                <span>{f.emoji}</span> {f.name}
              </button>
            ))}
            {folders.length === 0 && <p className="text-xs text-muted-foreground">No folders yet.</p>}
          </div>
          <div className="flex gap-2">
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()} placeholder="New folder…" className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-xs" />
            <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="px-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Plus size={12} /></button>
          </div>
        </div>

        {availableCategories.length > 0 && (
          <div className="card-elevated p-4 mb-3">
            <p className="text-sm font-semibold mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {availableCategories.map(cat => (
                <button key={cat} onClick={() => setLocal(p => ({ ...p, categories: toggle(p.categories, cat) }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    local.categories.includes(cat) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card-elevated p-4 mb-3">
          <p className="text-sm font-semibold mb-2">Sort By</p>
          <div className="space-y-1.5">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setLocal(p => ({ ...p, sortBy: opt.value as NoteFilterState["sortBy"] }))}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/50">
                <span className="text-sm">{opt.label}</span>
                {local.sortBy === opt.value && <Check size={14} className="text-primary" />}
              </button>
            ))}
          </div>
        </div>

        <div className="card-elevated p-4 mb-3">
          <button onClick={() => setLocal(p => ({ ...p, hasActions: !p.hasActions }))} className="w-full flex items-center justify-between">
            <span className="text-sm font-semibold">Has open action items</span>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${local.hasActions ? "bg-primary border-primary" : "border-border"}`}>
              {local.hasActions && <Check size={12} className="text-primary-foreground" />}
            </div>
          </button>
        </div>

        {activeCount > 0 && (
          <button onClick={clearAll} className="w-full text-center text-sm text-muted-foreground py-3">Clear All Filters</button>
        )}
      </div>
    </motion.div>
  );
};

export default NoteFilters;
