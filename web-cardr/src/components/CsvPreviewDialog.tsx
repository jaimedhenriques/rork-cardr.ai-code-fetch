import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Mail, FileSpreadsheet } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  csv: string;
  filename?: string;
  rowCount?: number;
  onConfirmDownload?: () => void;
  onConfirmEmail?: () => void;
  /** Max preview rows shown (default 10) */
  maxRows?: number;
}

/** Minimal CSV parser supporting quoted fields, doubled quotes, and CRLF. */
function parseCSV(input: string, maxLines: number): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length && rows.length < maxLines; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && input[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        rows.push(row); row = [];
      } else cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

const CsvPreviewDialog = ({
  open, onOpenChange, csv, filename, rowCount, onConfirmDownload, onConfirmEmail, maxRows = 10,
}: Props) => {
  const { headers, rows, totalDataRows, sizeKb } = useMemo(() => {
    const parsed = parseCSV(csv, maxRows + 1);
    const headers = parsed[0] ?? [];
    const rows = parsed.slice(1);
    const totalDataRows = rowCount ?? Math.max(0, csv.split("\n").filter((l) => l.trim().length > 0).length - 1);
    const sizeKb = (new Blob([csv]).size / 1024).toFixed(1);
    return { headers, rows, totalDataRows, sizeKb };
  }, [csv, maxRows, rowCount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> CSV Preview
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 items-center">
            {filename && <Badge variant="outline" className="font-mono text-xs">{filename}</Badge>}
            <Badge variant="secondary">{headers.length} columns</Badge>
            <Badge variant="secondary">{totalDataRows} rows</Badge>
            <Badge variant="secondary">{sizeKb} KB</Badge>
            <span className="text-xs text-muted-foreground">Showing first {Math.min(maxRows, rows.length)} rows</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-lg border border-border bg-muted/30">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 font-semibold text-foreground border-b border-border whitespace-nowrap">
                    {h || <span className="text-muted-foreground italic">col {i + 1}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={Math.max(headers.length, 1)} className="px-3 py-6 text-center text-muted-foreground">No data rows</td></tr>
              ) : rows.slice(0, maxRows).map((r, ri) => (
                <tr key={ri} className="hover:bg-muted/50 border-b border-border/50">
                  {headers.map((_, ci) => (
                    <td key={ci} className="px-3 py-2 text-foreground/80 max-w-[220px] truncate" title={r[ci] ?? ""}>
                      {r[ci] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:mr-auto">Cancel</Button>
          {onConfirmEmail && (
            <Button variant="outline" onClick={() => { onConfirmEmail(); onOpenChange(false); }}>
              <Mail className="size-4" /> Email
            </Button>
          )}
          {onConfirmDownload && (
            <Button onClick={() => { onConfirmDownload(); onOpenChange(false); }}>
              <Download className="size-4" /> Download CSV
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CsvPreviewDialog;
