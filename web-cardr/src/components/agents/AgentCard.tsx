import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Sparkles } from "lucide-react";
import type { Agent } from "@/hooks/useAgents";

interface Props {
  agent: Agent;
  badge?: "Template" | "Active" | "Paused";
  onClick?: () => void;
}

const AgentCard = ({ agent, badge, onClick }: Props) => {
  const navigate = useNavigate();
  const IconComp = (Icons as any)[agent.icon || "Sparkles"] || Sparkles;

  const handleClick = () => {
    if (onClick) onClick();
    else if (agent.type === "proposal_builder") navigate("/agents/proposal-builder");
    else navigate(`/agents/${agent.id}`);
  };

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="text-left p-5 rounded-2xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-md transition-all w-full group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          <IconComp size={20} className="text-primary" />
        </div>
        {badge && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
              badge === "Active"
                ? "bg-green-500/10 text-green-600"
                : badge === "Paused"
                ? "bg-muted text-muted-foreground"
                : "bg-accent/10 text-accent-foreground"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-foreground text-base mb-1.5">{agent.name}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{agent.description}</p>
    </motion.button>
  );
};

export default AgentCard;
