import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Plus, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface FilterState {
  sortBy: "newest" | "oldest" | "name_asc" | "name_az" | "company";
  leadSource: string[];
  missingInfo: string[];
  tagIds: string[];
  enrichmentStatus: string[];
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Date Added (Newest)" },
  { value: "oldest", label: "Date Added (Oldest)" },
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "company", label: "Company (A-Z)" },
];

const LEAD_SOURCES = [
  { value: "badge_scan", label: "Event Badge", icon: "🎫" },
  { value: "business_card", label: "Business Card", icon: "💳" },
  { value: "manual", label: "Manually Added", icon: "👤" },
  { value: "import", label: "Imported", icon: "📥" },
  { value: "enriched", label: "Enriched", icon: "✨" },
];

const MISSING_INFO = [
  { value: "no_email", label: "No Email", icon: "✉️" },
  { value: "no_phone", label: "No Phone", icon: "📞" },
  { value: "no_linkedin", label: "No LinkedIn", icon: "🔗" },
  { value: "no_company", label: "No Company", icon: "🏢" },
];

const ENRICHMENT_STATUS = [
  { value: "enriched", label: "Enriched", icon: "✅" },
  { value: "not_enriched", label: "Not Enriched", icon: "⭕" },
];

const TAG_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

interface ContactFiltersProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
}

export const defaultFilters: FilterState = {
  sortBy: "newest",
  leadSource: [],
  missingInfo: [],
  tagIds: [],
  enrichmentStatus: [],
};

const ContactFilters = ({ open, onClose, filters, onApply }: ContactFiltersProps) => {
  const { user } = useAuth();
  const [local, setLocal] = useState<FilterState>(filters);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const loadTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("tags").select("*").eq("user_id", user.id).order("name");
    if (data) setTags(data.map((t: any) => ({ id: t.id, name: t.name, color: t.color })));
  }, [user]);

  useEffect(() => {
    if (open) {
      setLocal(filters);
      loadTags();
    }
  }, [open, filters, loadTags]);

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const handleApply = () => {
    onApply(local);
    onClose();
  };

  const clearAll = () => {
    setLocal(defaultFilters);
  };

  const activeCount =
    local.leadSource.length + local.missingInfo.length + local.tagIds.length + local.enrichmentStatus.length +
    (local.sortBy !== "newest" ? 1 : 0);

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !user) return;
    const { data, error } = await supabase.from("tags").insert({
      user_id: user.id,
      name: newTagName.trim(),
      color: newTagColor,
    }).select().single();
    if (error) {
      if (error.code === "23505") toast.error("Tag already exists");
      else toast.error("Failed to create tag");
      return;
    }
    if (data) {
      setTags((prev) => [...prev, { id: data.id, name: data.name, color: data.color }]);
      setNewTagName("");
      toast.success("Tag created");
    }
  };

  const filteredTags = tags.filter((t) => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()));

  if (!open) return null;

  if (showTags) {
    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-50 bg-background"
      >
        <div className="px-5 pt-12 pb-24 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setShowTags(false)} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center">
              <ArrowLeft size={16} className="text-foreground" />
            </button>
            <button onClick={() => setShowTags(false)} className="px-4 py-2 rounded-full bg-card border border-border/60 text-sm font-semibold text-foreground">
              Done
            </button>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-4">Tags</h1>

          {/* Search */}
          <div className="relative mb-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search size={15} className="text-muted-foreground/50" />
            </div>
            <input
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              className="input-field h-12 pl-14 pr-4"
            />
          </div>

          {/* Create new tag */}
          <div className="card-elevated p-3 mb-4 space-y-2">
            <div className="flex gap-2">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                placeholder="New tag name..."
                className="input-field flex-1"
              />
              <button onClick={handleCreateTag} disabled={!newTagName.trim()} className="btn-primary px-3 py-2 text-xs rounded-xl disabled:opacity-50">
                <Plus size={14} />
              </button>
            </div>
            <div className="flex gap-1.5">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: newTagColor === c ? "white" : "transparent" }}
                />
              ))}
            </div>
          </div>

          {/* Tags list */}
          <div className="space-y-1.5">
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setLocal((prev) => ({ ...prev, tagIds: toggleArray(prev.tagIds, tag.id) }))}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/60 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium text-foreground">{tag.name}</span>
                </div>
                {local.tagIds.includes(tag.id) && (
                  <Check size={16} className="text-primary" />
                )}
              </button>
            ))}
            {filteredTags.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No tags yet</p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-background"
    >
      <div className="px-5 pt-12 pb-24 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center">
            <ArrowLeft size={16} className="text-foreground" />
          </button>
          <button onClick={handleApply} className="px-4 py-2 rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground text-sm font-semibold">
            Apply Filters
          </button>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-5">Filters</h1>

        {/* Tags */}
        <div className="card-elevated p-4 mb-3">
          <button onClick={() => setShowTags(true)} className="w-full flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Tags</span>
            <div className="flex items-center gap-2">
              {local.tagIds.length > 0 && (
                <span className="text-xs text-primary font-semibold">{local.tagIds.length} selected</span>
              )}
              <span className="text-xs text-muted-foreground">View All →</span>
            </div>
          </button>
        </div>

        {/* Sort By */}
        <div className="card-elevated p-4 mb-3">
          <p className="text-sm font-semibold text-foreground mb-2">Sort By</p>
          <div className="space-y-1.5">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLocal((prev) => ({ ...prev, sortBy: opt.value as FilterState["sortBy"] }))}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <span className="text-sm text-foreground">{opt.label}</span>
                {local.sortBy === opt.value && <Check size={14} className="text-primary" />}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Source */}
        <div className="card-elevated p-4 mb-3">
          <p className="text-sm font-semibold text-foreground mb-2">Lead Source</p>
          <div className="space-y-1.5">
            {LEAD_SOURCES.map((src) => (
              <button
                key={src.value}
                onClick={() => setLocal((prev) => ({ ...prev, leadSource: toggleArray(prev.leadSource, src.value) }))}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{src.icon}</span>
                  <span className="text-sm text-foreground">{src.label}</span>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${local.leadSource.includes(src.value) ? "bg-primary border-primary" : "border-border"}`}>
                  {local.leadSource.includes(src.value) && <Check size={12} className="text-primary-foreground" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Enrichment Status */}
        <div className="card-elevated p-4 mb-3">
          <p className="text-sm font-semibold text-foreground mb-2">Enrichment Status</p>
          <div className="space-y-1.5">
            {ENRICHMENT_STATUS.map((s) => (
              <button
                key={s.value}
                onClick={() => setLocal((prev) => ({ ...prev, enrichmentStatus: toggleArray(prev.enrichmentStatus, s.value) }))}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{s.icon}</span>
                  <span className="text-sm text-foreground">{s.label}</span>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${local.enrichmentStatus.includes(s.value) ? "bg-primary border-primary" : "border-border"}`}>
                  {local.enrichmentStatus.includes(s.value) && <Check size={12} className="text-primary-foreground" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Missing Info */}
        <div className="card-elevated p-4 mb-3">
          <p className="text-sm font-semibold text-foreground mb-2">Missing Info</p>
          <div className="space-y-1.5">
            {MISSING_INFO.map((m) => (
              <button
                key={m.value}
                onClick={() => setLocal((prev) => ({ ...prev, missingInfo: toggleArray(prev.missingInfo, m.value) }))}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{m.icon}</span>
                  <span className="text-sm text-foreground">{m.label}</span>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${local.missingInfo.includes(m.value) ? "bg-primary border-primary" : "border-border"}`}>
                  {local.missingInfo.includes(m.value) && <Check size={12} className="text-primary-foreground" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Clear All */}
        {activeCount > 0 && (
          <button onClick={clearAll} className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-3 transition-colors">
            Clear All Filters
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ContactFilters;
