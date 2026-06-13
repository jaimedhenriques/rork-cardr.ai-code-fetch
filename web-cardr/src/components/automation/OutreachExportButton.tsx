import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  downloadOutreachCSV,
  downloadOutreachXLSX,
  fetchOutreachDraftRows,
  fetchSequenceRunRows,
  type OutreachExportRow,
} from "@/lib/outreach-export";

interface Props {
  /** "runs" exports sequence runs + messages; "drafts" exports outreach drafter runs for a contact. */
  source: "runs" | "drafts";
  /** When source = "runs", optional sequence filter. When "drafts", required contactId. */
  sequenceId?: string;
  contactId?: string;
  baseName?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost" | "secondary";
  label?: string;
}

const OutreachExportButton = ({
  source,
  sequenceId,
  contactId,
  baseName,
  size = "sm",
  variant = "outline",
  label = "Export",
}: Props) => {
  const [busy, setBusy] = useState<null | "csv" | "xlsx">(null);

  const run = async (kind: "csv" | "xlsx") => {
    setBusy(kind);
    try {
      let rows: OutreachExportRow[] = [];
      if (source === "drafts") {
        if (!contactId) throw new Error("Missing contact");
        rows = await fetchOutreachDraftRows(contactId);
      } else {
        rows = await fetchSequenceRunRows(sequenceId);
      }
      if (!rows.length) {
        toast.error("Nothing to export yet");
        return;
      }
      const name = baseName || (source === "drafts" ? "outreach-drafts" : "sequence-runs");
      if (kind === "csv") downloadOutreachCSV(rows, name);
      else downloadOutreachXLSX(rows, name);
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} as ${kind.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={!!busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">Choose format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run("csv")} disabled={!!busy}>
          <FileText className="size-4" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">CSV</span>
            <span className="text-[10px] text-muted-foreground">Plain text, universal</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xlsx")} disabled={!!busy}>
          <FileSpreadsheet className="size-4" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">XLSX</span>
            <span className="text-[10px] text-muted-foreground">Excel workbook</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default OutreachExportButton;
