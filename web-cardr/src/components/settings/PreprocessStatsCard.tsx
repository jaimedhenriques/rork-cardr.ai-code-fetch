import { useEffect, useState } from "react";
import { Activity, RotateCcw } from "lucide-react";
import {
  clearPreprocessStats,
  getAverageDurationMs,
  getPreprocessStats,
  getSkippedPercent,
  subscribePreprocessStats,
  type PreprocessStats,
} from "@/lib/preprocess-stats";
import { toast } from "sonner";

/**
 * Read-only diagnostic card showing local preprocessing performance:
 * average duration of completed runs and how often the pipeline skipped
 * (slow-device flag, timeout, max-pixels, etc.). Stored only on this
 * device — nothing is sent to the server.
 */
export default function PreprocessStatsCard() {
  const [stats, setStats] = useState<PreprocessStats>(() => getPreprocessStats());

  useEffect(() => {
    const refresh = () => setStats(getPreprocessStats());
    refresh();
    return subscribePreprocessStats(refresh);
  }, []);

  const avgMs = getAverageDurationMs(stats);
  const skippedPct = getSkippedPercent(stats);
  const guardEntries = Object.entries(stats.guardCounts).sort((a, b) => b[1] - a[1]);

  const handleReset = () => {
    clearPreprocessStats();
    toast.success("Preprocessing stats cleared");
  };

  return (
    <div className="card-elevated p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity size={14} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Scan preprocessing</p>
            <p className="text-[10px] text-muted-foreground">Local-only performance stats</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
          aria-label="Reset preprocessing stats"
          disabled={stats.totalRuns === 0}
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Runs" value={stats.totalRuns.toString()} />
        <Stat
          label="Avg duration"
          value={stats.completedRuns > 0 ? `${Math.round(avgMs)} ms` : "—"}
          hint={stats.completedRuns > 0 ? `${stats.completedRuns} completed` : undefined}
        />
        <Stat
          label="Skipped"
          value={stats.totalRuns > 0 ? `${skippedPct.toFixed(0)}%` : "—"}
          hint={stats.totalRuns > 0 ? `${stats.skippedRuns} of ${stats.totalRuns}` : undefined}
        />
      </div>

      {guardEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Guard breakdown
          </p>
          <ul className="space-y-1">
            {guardEntries.map(([guard, count]) => (
              <li key={guard} className="flex items-center justify-between text-[11px]">
                <span className="text-foreground/80 font-mono">{guard}</span>
                <span className="text-muted-foreground tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.lastUpdated && (
        <p className="text-[10px] text-muted-foreground/70 mt-2 text-right">
          Updated {new Date(stats.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[9px] text-muted-foreground/70 mt-0.5">{hint}</p>}
    </div>
  );
}
