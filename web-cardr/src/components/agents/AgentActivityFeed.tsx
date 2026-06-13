import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Loader2,
  XCircle,
  Sparkles,
  User,
  IdCard,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRecentAgentRuns, type AgentRun, type Agent } from "@/hooks/useAgents";
import EmptyState from "@/components/ui/empty-state";
import { SkeletonRow } from "@/components/ui/skeleton-premium";
import { cn } from "@/lib/utils";

type RunWithAgent = AgentRun & {
  agents: Pick<Agent, "id" | "name" | "icon" | "type"> | null;
};

const statusMeta = {
  pending: {
    icon: Loader2,
    label: "Queued",
    className: "text-muted-foreground bg-muted/60",
    spin: false,
  },
  running: {
    icon: Loader2,
    label: "Running",
    className: "text-primary bg-primary/10",
    spin: true,
  },
  complete: {
    icon: CheckCircle2,
    label: "Complete",
    className: "text-success bg-success/10",
    spin: false,
  },
  error: {
    icon: XCircle,
    label: "Failed",
    className: "text-destructive bg-destructive/10",
    spin: false,
  },
} as const;

/** Pull a short, human summary from the run output (best-effort). */
function extractSummary(run: RunWithAgent): string | null {
  const out = run.output as Record<string, any> | null;
  if (!out || typeof out !== "object") return null;
  const candidate =
    out.summary ??
    out.message ??
    out.result ??
    out.text ??
    out.draft ??
    out.headline ??
    (Array.isArray(out.highlights) ? out.highlights[0] : null);
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
}

/** Subject of the run — link out to the contact or badge when present. */
function RunSubject({ run }: { run: RunWithAgent }) {
  const input = (run.input ?? {}) as Record<string, any>;
  if (run.contact_id) {
    return (
      <Link
        to={`/contacts/${run.contact_id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-primary transition-colors"
      >
        <User size={12} />
        {input.contact_name ?? "Contact"}
      </Link>
    );
  }
  if (input.badge_id || input.event_id) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
        <IdCard size={12} />
        {input.badge_label ?? input.event_title ?? "Badge"}
      </span>
    );
  }
  return null;
}

interface AgentActivityFeedProps {
  limit?: number;
}

const AgentActivityFeed = ({ limit = 25 }: AgentActivityFeedProps) => {
  const { data, isLoading } = useRecentAgentRuns(limit);

  const stats = useMemo(() => {
    const runs = (data ?? []) as RunWithAgent[];
    const running = runs.filter((r) => r.status === "running" || r.status === "pending").length;
    const completedToday = runs.filter((r) => {
      if (r.status !== "complete" || !r.completed_at) return false;
      const d = new Date(r.completed_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    const failed = runs.filter((r) => r.status === "error").length;
    return { running, completedToday, failed };
  }, [data]);

  return (
    <section aria-labelledby="agent-activity-heading" className="card-elevated p-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary"
            style={{ boxShadow: "var(--shadow-ring)" }}
          >
            <Activity size={16} strokeWidth={2.25} />
            {stats.running > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            )}
          </div>
          <div>
            <h2 id="agent-activity-heading" className="font-display text-base font-semibold tracking-tight">
              Live activity
            </h2>
            <p className="text-[11px] text-muted-foreground">Real-time agent runs &amp; summaries</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <span className="flex items-center gap-1 text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {stats.running}
          </span>
          <span className="flex items-center gap-1 text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success" /> {stats.completedToday}
          </span>
          {stats.failed > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> {stats.failed}
            </span>
          )}
        </div>
      </header>

      {isLoading ? (
        <SkeletonRow count={3} />
      ) : !data?.length ? (
        <EmptyState
          compact
          icon={Sparkles}
          title="No agent runs yet"
          description="Once your agents start working on contacts or badges, summaries will appear here in real time."
        />
      ) : (
        <ol className="space-y-2">
          <AnimatePresence initial={false}>
            {(data as RunWithAgent[]).map((run) => {
              const meta = statusMeta[run.status] ?? statusMeta.pending;
              const Icon = meta.icon;
              const summary = extractSummary(run);
              const agentName = run.agents?.name ?? "Agent";
              return (
                <motion.li
                  key={run.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="group rounded-xl border border-border/60 bg-card/60 hover:bg-card transition-colors p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("shrink-0 flex items-center justify-center w-8 h-8 rounded-lg", meta.className)}>
                      <Icon size={14} className={meta.spin ? "animate-spin" : ""} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/agents/${run.agent_id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {agentName}
                        </Link>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">
                          · {meta.label}
                        </span>
                        <RunSubject run={run} />
                        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                          {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {summary && (
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {summary}
                        </p>
                      )}
                      {run.status === "error" && run.error_message && (
                        <p className="mt-1.5 text-xs text-destructive leading-relaxed line-clamp-2">
                          {run.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
};

export default AgentActivityFeed;
