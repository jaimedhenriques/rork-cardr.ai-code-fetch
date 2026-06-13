import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderPlus, Folder as FolderIcon, X, Plus, ChevronRight, Loader2 } from "lucide-react";
import type { Folder } from "@/context/AppContext";

interface CardHolderProps {
  eventId: string;
  eventTitle: string;
  folders: Folder[];
  onCreate: (name: string) => void;
  onUnlink: (id: string) => void;
  creating?: boolean;
}

/**
 * Card holder for an event: a small dashboard of folders grouped under the
 * current event. Users can spin up multiple folders (e.g. "Day 1", "Booth A",
 * "VIPs") and each acts as a sub-bucket of badges/cards collected for that
 * event. Folders can also be unlinked without deleting them.
 */
const CardHolder = ({ eventId, eventTitle, folders, onCreate, onUnlink, creating }: CardHolderProps) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
    setShowAdd(false);
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FolderIcon size={14} className="text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-foreground truncate">Card holder</h3>
          <span className="text-[11px] text-muted-foreground">
            {folders.length} {folders.length === 1 ? "folder" : "folders"}
          </span>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-primary text-xs font-semibold flex items-center gap-1 hover:opacity-80"
        >
          <Plus size={12} /> New folder
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setShowAdd(false); setName(""); }
            }}
            placeholder={`e.g. ${eventTitle} – Day 1`}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={handleAdd}
            disabled={!name.trim() || creating}
            className="btn-primary px-3 py-2 text-xs disabled:opacity-50"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : "Add"}
          </button>
          <button
            onClick={() => { setShowAdd(false); setName(""); }}
            className="text-muted-foreground p-2 hover:bg-muted rounded-lg"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {folders.length === 0 ? (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-2 px-3 py-3 bg-primary/5 border border-dashed border-primary/30 rounded-xl text-left hover:bg-primary/10 transition-colors"
        >
          <FolderPlus size={14} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Create your first folder</p>
            <p className="text-[11px] text-muted-foreground">Group badges and cards by day, booth, or theme.</p>
          </div>
          <ChevronRight size={14} className="text-primary" />
        </button>
      ) : (
        <ul className="space-y-1.5">
          {folders.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-muted/40 hover:bg-muted transition-colors"
            >
              <span className="text-base shrink-0">{f.emoji || "📁"}</span>
              <Link
                to={`/contacts?folder=${f.id}&event=${eventId}`}
                className="flex-1 min-w-0 text-sm font-medium text-foreground truncate hover:text-primary"
              >
                {f.name}
              </Link>
              {f.eventId === eventId && (
                <button
                  onClick={() => onUnlink(f.id)}
                  className="text-[11px] text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-background"
                  title="Unlink from event (does not delete the folder)"
                >
                  Unlink
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CardHolder;
