import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

interface ScanArtifactRow {
  id: string;
  created_at: string;
  image_path: string | null;
  raw_text: string | null;
  structured: Record<string, unknown> | null;
  confidence: Record<string, number> | null;
  model: string | null;
  scan_mode: string | null;
}

interface Props {
  contactId: string;
  userId: string;
}

const ScanArtifactsPanel = ({ contactId, userId }: Props) => {
  const [rows, setRows] = useState<ScanArtifactRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("scan_artifacts")
        .select("id, created_at, image_path, raw_text, structured, confidence, model, scan_mode")
        .eq("contact_id", contactId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!cancelled) setRows((data as unknown as ScanArtifactRow[]) || []);
    };
    load();
    return () => { cancelled = true; };
  }, [contactId, userId]);

  // Resolve signed URLs lazily when the panel is opened.
  useEffect(() => {
    if (!open || !rows) return;
    const missing = rows.filter((r) => r.image_path && !imageUrls[r.id]);
    if (missing.length === 0) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const r of missing) {
        if (!r.image_path) continue;
        const { data } = await supabase.storage
          .from("scan-artifacts")
          .createSignedUrl(r.image_path, 60 * 30);
        if (data?.signedUrl) next[r.id] = data.signedUrl;
      }
      if (Object.keys(next).length > 0) {
        setImageUrls((prev) => ({ ...prev, ...next }));
      }
    })();
  }, [open, rows, imageUrls]);

  if (rows === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-4 mb-4 flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading scan artifacts…
      </motion.div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated p-4 mb-4"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Scan artifacts</h3>
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "scan" : "scans"} stored
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {rows.map((r) => {
            const url = imageUrls[r.id];
            return (
              <div key={r.id} className="border-t border-border/40 pt-4 first:border-0 first:pt-0">
                <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                  <span>
                    {(() => { try { return format(parseISO(r.created_at), "MMM d, yyyy · HH:mm"); } catch { return r.created_at; } })()}
                  </span>
                  <span className="flex items-center gap-2">
                    {r.scan_mode && <span className="px-2 py-0.5 rounded-full bg-muted">{r.scan_mode}</span>}
                    {r.model && <span className="px-2 py-0.5 rounded-full bg-muted">{r.model}</span>}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3">
                  <div className="aspect-[4/3] bg-muted/40 rounded-lg overflow-hidden flex items-center justify-center">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="Original scan" className="w-full h-full object-cover" />
                      </a>
                    ) : r.image_path ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-2 min-w-0">
                    {r.structured && Object.keys(r.structured).length > 0 && (
                      <details className="text-xs" open>
                        <summary className="cursor-pointer text-muted-foreground mb-1">Structured output</summary>
                        <pre className="bg-muted/40 rounded-lg p-2 overflow-auto max-h-48 text-[11px] leading-relaxed">
{JSON.stringify(r.structured, null, 2)}
                        </pre>
                      </details>
                    )}
                    {r.confidence && Object.keys(r.confidence).length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground mb-1">Confidence scores</summary>
                        <pre className="bg-muted/40 rounded-lg p-2 overflow-auto max-h-32 text-[11px] leading-relaxed">
{JSON.stringify(r.confidence, null, 2)}
                        </pre>
                      </details>
                    )}
                    {r.raw_text && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground mb-1">Raw model output</summary>
                        <pre className="bg-muted/40 rounded-lg p-2 overflow-auto max-h-48 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
{r.raw_text}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default ScanArtifactsPanel;
