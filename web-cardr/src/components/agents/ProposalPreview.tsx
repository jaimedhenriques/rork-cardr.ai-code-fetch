import { Button } from "@/components/ui/button";
import { Download, Printer, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProposals, type Proposal } from "@/hooks/useProposals";
import { toast } from "sonner";

interface Props {
  proposal: Proposal;
  onClose: () => void;
}

const ProposalPreview = ({ proposal, onClose }: Props) => {
  const { updateProposal } = useProposals();

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup blocked"); return; }
    w.document.write(proposal.html_content);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleDownload = () => {
    const blob = new Blob([proposal.html_content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proposal.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatus = async (status: string) => {
    await updateProposal.mutateAsync({ id: proposal.id, status: status as Proposal["status"] });
    toast.success(`Marked as ${status}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <X size={16} />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{proposal.title}</p>
            <p className="text-xs text-muted-foreground">Proposal preview</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select defaultValue={proposal.status} onValueChange={handleStatus}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download size={14} className="mr-1.5" /> HTML
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer size={14} className="mr-1.5" /> Print / PDF
          </Button>
        </div>
      </div>
      <div className="p-4 sm:p-8">
        <iframe
          title="Proposal preview"
          srcDoc={proposal.html_content}
          className="w-full bg-white rounded-xl border border-border shadow-sm"
          style={{ height: "calc(100vh - 120px)" }}
        />
      </div>
    </div>
  );
};

export default ProposalPreview;
