import { useProposals, type Proposal } from "@/hooks/useProposals";
import { FileText, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Props {
  onSelect: (proposal: Proposal) => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  viewed: "bg-accent/10 text-accent-foreground",
  won: "bg-primary/15 text-primary",
  lost: "bg-destructive/10 text-destructive",
};

const ProposalsList = ({ onSelect }: Props) => {
  const { list, deleteProposal } = useProposals();

  if (list.isLoading) return <div className="text-sm text-muted-foreground py-6 text-center">Loading proposals…</div>;
  if (!list.data?.length) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        <FileText className="mx-auto mb-2 opacity-40" size={32} />
        No proposals yet. Generate one above.
      </div>
    );
  }

  const stats = {
    total: list.data.length,
    won: list.data.filter((p) => p.status === "won").length,
    sent: list.data.filter((p) => ["sent", "viewed"].includes(p.status)).length,
  };
  const conversionRate = stats.sent > 0 ? Math.round((stats.won / stats.sent) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Won</p>
          <p className="text-2xl font-bold mt-1 text-primary">{stats.won}</p>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conversion</p>
          <p className="text-2xl font-bold mt-1 text-primary">{conversionRate}%</p>
        </div>
      </div>

      <div className="space-y-2">
        {list.data.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 hover:border-primary/40 transition-colors group">
            <button onClick={() => onSelect(p)} className="flex-1 text-left flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })} · {p.project_type}</p>
              </div>
            </button>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_STYLES[p.status]}`}>
              {p.status}
            </span>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm("Delete this proposal?")) return;
                await deleteProposal.mutateAsync(p.id);
                toast.success("Deleted");
              }}
              className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-destructive transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProposalsList;
