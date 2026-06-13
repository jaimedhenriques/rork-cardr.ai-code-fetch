import { format, parseISO } from "date-fns";

interface NoteRecord {
  id: string;
  title: string;
  summary: string | null;
  transcript: string | null;
  manual_notes: string | null;
  category: string | null;
  folder_id: string | null;
  duration_seconds: number;
  created_at: string;
  key_topics?: string[];
  action_items?: { task: string; owner?: string; deadline?: string; done?: boolean }[];
  follow_ups?: { description: string; with?: string }[];
  decisions?: string[];
  insights?: string[];
  open_questions?: string[];
}

interface ExportContext {
  folders: { id: string; name: string; emoji: string }[];
  tags: { id: string; name: string; color: string }[];
  noteTagMap: Record<string, string[]>;
}

const folderName = (id: string | null, ctx: ExportContext) =>
  id ? ctx.folders.find(f => f.id === id)?.name ?? "" : "";

const tagNames = (noteId: string, ctx: ExportContext) =>
  (ctx.noteTagMap[noteId] || []).map(tid => ctx.tags.find(t => t.id === tid)?.name).filter(Boolean) as string[];

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportNotesAsJSON = (notes: NoteRecord[], ctx: ExportContext) => {
  const enriched = notes.map(n => ({
    ...n,
    folder: folderName(n.folder_id, ctx),
    tags: tagNames(n.id, ctx),
  }));
  const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: "application/json" });
  triggerDownload(blob, `notes-export-${format(new Date(), "yyyy-MM-dd")}.json`);
};

export const exportNotesAsCSV = (notes: NoteRecord[], ctx: ExportContext) => {
  const headers = [
    "ID", "Title", "Date", "Duration (min)", "Category", "Folder", "Tags",
    "Summary", "Key Topics", "Action Items", "Follow-Ups", "Decisions",
    "Insights", "Open Questions", "Manual Notes", "Transcript",
  ];
  const rows = notes.map(n => [
    n.id,
    n.title || "",
    format(parseISO(n.created_at), "yyyy-MM-dd HH:mm"),
    Math.round((n.duration_seconds || 0) / 60).toString(),
    n.category || "",
    folderName(n.folder_id, ctx),
    tagNames(n.id, ctx).join("; "),
    n.summary || "",
    (n.key_topics || []).join("; "),
    (n.action_items || []).map(a => `${a.done ? "[x] " : "[ ] "}${a.task}${a.owner ? ` (${a.owner})` : ""}${a.deadline ? ` — ${a.deadline}` : ""}`).join(" | "),
    (n.follow_ups || []).map(f => `${f.description}${f.with ? ` w/ ${f.with}` : ""}`).join(" | "),
    (n.decisions || []).join(" | "),
    (n.insights || []).join(" | "),
    (n.open_questions || []).join(" | "),
    n.manual_notes || "",
    n.transcript || "",
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `notes-export-${format(new Date(), "yyyy-MM-dd")}.csv`);
};
