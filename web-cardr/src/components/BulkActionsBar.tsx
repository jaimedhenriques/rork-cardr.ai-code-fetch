import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, GitBranch, X, CheckSquare, Tag, AlertTriangle, Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onMoveStage: (stageId: string) => void;
  onTag: (tagId: string) => void;
  onExport: () => void;
  onCancel: () => void;
  stages: { id: string; name: string; color: string }[];
  tags: { id: string; name: string; color: string }[];
}

const BulkActionsBar = ({ selectedCount, onDelete, onMoveStage, onTag, onExport, onCancel, stages, tags }: BulkActionsBarProps) => {
  const [expanded, setExpanded] = useState<"stages" | "tags" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="fixed bottom-24 left-0 right-0 z-50 px-4"
    >
      <div className="bg-card border border-border/60 rounded-2xl shadow-xl p-3 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">{selectedCount} selected</span>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <AnimatePresence>
          {expanded === "stages" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-2"
            >
              <div className="flex flex-wrap gap-1.5 p-2 bg-secondary/50 rounded-xl">
                <button
                  onClick={() => { onMoveStage(""); setExpanded(null); }}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Unassigned
                </button>
                {stages.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { onMoveStage(s.id); setExpanded(null); }}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: s.color + "20", color: s.color }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
          {expanded === "tags" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-2"
            >
              <div className="flex flex-wrap gap-1.5 p-2 bg-secondary/50 rounded-xl">
                {tags.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground px-2 py-1">No tags yet — create tags in Settings</p>
                ) : (
                  tags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { onTag(t.id); setExpanded(null); }}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ backgroundColor: t.color + "20", color: t.color }}
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(expanded === "stages" ? null : "stages")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
          >
            <GitBranch size={13} /> Stage
          </button>
          <button
            onClick={() => setExpanded(expanded === "tags" ? null : "tags")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-accent/30 text-foreground text-xs font-semibold hover:bg-accent/50 transition-colors"
          >
            <Tag size={13} /> Tag
          </button>
          <button
            onClick={onExport}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-colors"
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={16} className="text-destructive" />
              </div>
              <AlertDialogTitle className="text-base font-display">Delete {selectedCount} contact{selectedCount !== 1 ? "s" : ""}?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              This action cannot be undone. All selected contacts and their associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default BulkActionsBar;
