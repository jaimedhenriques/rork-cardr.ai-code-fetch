import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, ChevronDown, Building2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Contact } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import CsvPreviewDialog from "@/components/CsvPreviewDialog";

type CrmTarget = "salesforce" | "hubspot" | "pipedrive" | "zoho";

interface CrmDef {
  key: CrmTarget;
  label: string;
  color: string;
  headers: string[];
  mapper: (c: Contact, includeNotes: boolean) => string[];
}

const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;

const splitName = (name: string) => {
  const parts = name.trim().split(" ");
  const last = parts.pop() || "";
  return { first: parts.join(" ") || last, last: parts.length > 0 ? last : "" };
};

const CRM_DEFS: CrmDef[] = [
  {
    key: "salesforce",
    label: "Salesforce",
    color: "text-[#00A1E0]",
    headers: ["First Name", "Last Name", "Title", "Company", "Email", "Phone", "Website", "Mailing Street", "Industry", "Lead Source", "Description"],
    mapper: (c, notes) => {
      const { first, last } = splitName(c.name);
      return [first, last, c.title, c.company, c.email, c.phone, c.website || "", c.location || "", c.industry || "", "Cardr", notes ? c.notes || "" : ""];
    },
  },
  {
    key: "hubspot",
    label: "HubSpot",
    color: "text-[#FF7A59]",
    headers: ["First Name", "Last Name", "Job Title", "Company Name", "Email", "Phone Number", "Website URL", "City", "Industry", "Lead Status", "Notes"],
    mapper: (c, notes) => {
      const { first, last } = splitName(c.name);
      return [first, last, c.title, c.company, c.email, c.phone, c.website || "", c.location || "", c.industry || "", "New", notes ? c.notes || "" : ""];
    },
  },
  {
    key: "pipedrive",
    label: "Pipedrive",
    color: "text-[#017737]",
    headers: ["Name", "Organization", "Title", "Email", "Phone", "LinkedIn", "Website", "Address", "Note"],
    mapper: (c, notes) => [c.name, c.company, c.title, c.email, c.phone, c.linkedin || "", c.website || "", c.location || "", notes ? c.notes || "" : ""],
  },
  {
    key: "zoho",
    label: "Zoho CRM",
    color: "text-[#E42527]",
    headers: ["First Name", "Last Name", "Title", "Company", "Email", "Phone", "Website", "Mailing City", "Industry", "Lead Source", "Description"],
    mapper: (c, notes) => {
      const { first, last } = splitName(c.name);
      return [first, last, c.title, c.company, c.email, c.phone, c.website || "", c.location || "", c.industry || "", "Cardr", notes ? c.notes || "" : ""];
    },
  },
];

interface Props {
  getSelectedContacts: () => Contact[];
  includeNotes: boolean;
  logExportActivity: (contacts: Contact[], method: string) => void;
}

const CrmExportPanel = ({ getSelectedContacts, includeNotes, logExportActivity }: Props) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ csv: string; filename: string; data: Contact[]; def: CrmDef } | null>(null);

  const buildCsv = (def: CrmDef, data: Contact[]) =>
    def.headers.map(esc).join(",") + "\n" +
    data.map((c) => def.mapper(c, includeNotes).map(esc).join(",")).join("\n");

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPreview = (def: CrmDef) => {
    const data = getSelectedContacts();
    if (data.length === 0) { toast.error("Select contacts to export"); return; }
    setPreview({
      csv: buildCsv(def, data),
      filename: `cardscanpro-${def.key}-${format(new Date(), "yyyy-MM-dd")}.csv`,
      data,
      def,
    });
  };

  const confirmExport = () => {
    if (!preview) return;
    downloadCsv(preview.csv, preview.filename);
    toast.success(`Exported ${preview.data.length} contacts for ${preview.def.label}`);
    logExportActivity(preview.data, preview.def.label);
  };

  return (
    <div className="card-elevated overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 text-xs font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <Building2 size={14} className="text-primary" />
          CRM Export
        </span>
        <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 px-3.5 pb-3.5">
              {CRM_DEFS.map((def) => (
                <button
                  key={def.key}
                  onClick={() => openPreview(def)}
                  className="card-interactive p-3 flex items-center justify-center gap-2 text-xs font-semibold text-foreground"
                >
                  <Eye size={13} className={def.color} />
                  {def.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CsvPreviewDialog
        open={!!preview}
        onOpenChange={(v) => !v && setPreview(null)}
        csv={preview?.csv ?? ""}
        filename={preview?.filename}
        rowCount={preview?.data.length ?? 0}
        onConfirmDownload={confirmExport}
      />
    </div>
  );
};

export default CrmExportPanel;
