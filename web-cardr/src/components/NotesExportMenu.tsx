import { useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { exportNotesAsCSV, exportNotesAsJSON } from "@/lib/note-export";

interface Props {
  notes: any[];
  folders: { id: string; name: string; emoji: string }[];
  tags: { id: string; name: string; color: string }[];
  noteTagMap: Record<string, string[]>;
}

const NotesExportMenu = ({ notes, folders, tags, noteTagMap }: Props) => {
  const [open, setOpen] = useState(false);

  const handle = (kind: "csv" | "json") => {
    if (!notes.length) {
      toast.error("No notes to export");
      return;
    }
    const ctx = { folders, tags, noteTagMap };
    if (kind === "csv") exportNotesAsCSV(notes, ctx);
    else exportNotesAsJSON(notes, ctx);
    toast.success(`Exported ${notes.length} note${notes.length > 1 ? "s" : ""} as ${kind.toUpperCase()}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        aria-label="Export notes"
      >
        <Download size={15} className="text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              className="absolute right-0 top-11 z-50 w-56 bg-card border border-border/60 rounded-2xl shadow-xl p-1.5"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2.5 py-1.5">
                Export {notes.length} note{notes.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => handle("csv")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-secondary text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <FileSpreadsheet size={14} className="text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">CSV</p>
                  <p className="text-[10px] text-muted-foreground">For Excel, Sheets</p>
                </div>
              </button>
              <button
                onClick={() => handle("json")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-secondary text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileJson size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">JSON</p>
                  <p className="text-[10px] text-muted-foreground">For dev tools, APIs</p>
                </div>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotesExportMenu;
