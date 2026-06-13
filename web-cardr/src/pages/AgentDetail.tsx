import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ProposalBuilderForm from "@/components/agents/ProposalBuilderForm";
import ProposalPreview from "@/components/agents/ProposalPreview";
import ProposalsList from "@/components/agents/ProposalsList";
import { useAgents, useAgent } from "@/hooks/useAgents";
import { useProposal, useProposals } from "@/hooks/useProposals";
import { useBranding } from "@/context/BrandingContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";

const AgentDetail = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { myAgents, updateAgent } = useAgents();
  const branding = useBranding();
  const { list } = useProposals();
  const [previewProposalId, setPreviewProposalId] = useState<string | null>(null);
  const { data: previewProposal } = useProposal(previewProposalId ?? undefined);

  // Resolve "proposal-builder" slug to user's installed agent
  const isProposalBuilder = agentId === "proposal-builder";
  const proposalAgent = myAgents.data?.find((a) => a.type === "proposal_builder");
  const resolvedId = isProposalBuilder ? proposalAgent?.id : agentId;
  const { data: agent, isLoading } = useAgent(resolvedId);

  // Auto-redirect to /agents if proposal-builder slug used but agent not installed
  useEffect(() => {
    if (isProposalBuilder && myAgents.data && !proposalAgent) {
      navigate("/agents");
    }
  }, [isProposalBuilder, myAgents.data, proposalAgent, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen pb-32 px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Sign in to use agents</p>
        <Button onClick={() => navigate("/auth")}>Sign in</Button>
      </div>
    );
  }

  if (isLoading || !agent) {
    return <div className="min-h-screen pb-32 px-4 py-12 text-center text-muted-foreground">Loading agent…</div>;
  }

  const isProposal = agent.type === "proposal_builder";

  return (
    <div className="min-h-screen pb-32">
      <div className="px-4 pt-4">
        <PageHeader title={agent.name} back="/agents" />
        <p className="text-sm text-muted-foreground -mt-3 mb-4">{agent.description}</p>
      </div>

      <div className="px-4 mt-2 space-y-5">
        {/* Status + branding banner */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Status</p>
              <p className="text-xs text-muted-foreground">{agent.status === "active" ? "Ready to run" : "Paused"}</p>
            </div>
          </div>
          <Switch
            checked={agent.status === "active"}
            onCheckedChange={(v) =>
              updateAgent.mutate({ id: agent.id, status: v ? "active" : "paused" })
            }
          />
        </div>

        {!branding.isCustom && isProposal && (
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
            <FileText size={18} className="text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Personalize your proposals</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add your logo, colors, and tagline so every proposal carries your brand.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin")}>Set up branding</Button>
          </div>
        )}

        {isProposal ? (
          <>
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Generate proposal</h3>
              <div className="p-5 rounded-2xl bg-card border border-border/60">
                <ProposalBuilderForm agentId={agent.id} onGenerated={(id) => { setPreviewProposalId(id); list.refetch(); }} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Proposals</h3>
              <ProposalsList onSelect={(p) => setPreviewProposalId(p.id)} />
            </section>
          </>
        ) : (
          <section className="p-5 rounded-2xl bg-card border border-border/60">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Instructions</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{agent.system_prompt}</p>
            <p className="text-xs text-muted-foreground mt-4">Custom agent execution UI coming soon — you can edit instructions or pause from here for now.</p>
          </section>
        )}
      </div>

      {previewProposal && (
        <ProposalPreview proposal={previewProposal} onClose={() => setPreviewProposalId(null)} />
      )}
    </div>
  );
};

export default AgentDetail;
