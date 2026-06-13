import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AgentCard from "@/components/agents/AgentCard";
import CreateAgentSheet from "@/components/agents/CreateAgentSheet";
import AgentActivityFeed from "@/components/agents/AgentActivityFeed";
import { useAgents } from "@/hooks/useAgents";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Agents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { myAgents, templates, installTemplate } = useAgents();
  const [createOpen, setCreateOpen] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen pb-32">
      <div className="px-4 pt-4">
        <PageHeader title="Agents" />
      </div>
        <div className="px-4 py-12 text-center">
          <Sparkles className="mx-auto mb-3 opacity-40" size={36} />
          <p className="text-muted-foreground mb-4">Sign in to deploy AI agents</p>
          <Button onClick={() => navigate("/auth")}>Sign in</Button>
        </div>
      </div>
    );
  }

  const handleInstall = async (template: any) => {
    try {
      const newAgent = await installTemplate.mutateAsync(template);
      toast.success(`${template.name} added to your agents`);
      if (template.type === "proposal_builder") navigate("/agents/proposal-builder");
      else navigate(`/agents/${newAgent.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to install");
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="px-4 pt-4">
        <PageHeader title="Agents" />
        <p className="text-sm text-muted-foreground -mt-3 mb-4">AI agents that work for you</p>
      </div>

      <div className="px-4 space-y-6 mt-2">
        {/* Live activity feed — realtime agent runs & summaries */}
        <AgentActivityFeed limit={25} />

        {/* My agents */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Your agents</h2>
            <button
              onClick={() => setCreateOpen(true)}
              className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
            >
              <Plus size={14} /> Create custom
            </button>
          </div>

          {myAgents.isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading…</div>
          ) : myAgents.data?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myAgents.data.map((a) => (
                <AgentCard key={a.id} agent={a} badge={a.status === "active" ? "Active" : "Paused"} />
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-dashed border-border text-center">
              <p className="text-sm text-muted-foreground mb-3">You haven't deployed any agents yet.</p>
              <p className="text-xs text-muted-foreground">Pick a template below or create your own.</p>
            </div>
          )}
        </section>

        {/* Templates */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Agent library</h2>
          {templates.isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.data?.map((t) => (
                <AgentCard key={t.id} agent={t} badge="Template" onClick={() => handleInstall(t)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <CreateAgentSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default Agents;
