import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, CheckCircle2, XCircle, Clock, Download, Trash2, ChevronDown, Filter, Activity } from "lucide-react";
import { CRM_OPTIONS, type CrmTarget } from "@/lib/crm-sync";
import {
  getSyncLog, clearSyncLog, exportSyncLogCsv, downloadCsv,
  type CrmSyncLogEntry, type CrmSyncStatus,
} from "@/lib/crm-sync-log";
import { toast } from "sonner";

const STATUS_META: Record<CrmSyncStatus, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  success: { label: "Success", color: "text-emerald-600", bg: "bg-emerald-500/10", Icon: CheckCircle2 },
  error:   { label: "Failed",  color: "text-destructive", bg: "bg-destructive/10", Icon: XCircle },
  pending: { label: "Pending", color: "text-amber-600",   bg: "bg-amber-500/10",   Icon: Clock },
};

const formatRelative = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

const CrmSyncLogPanel = () => {
  const [log, setLog] = useState<CrmSyncLogEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<CrmSyncStatus | "all">("all");
  const [crmFilter, setCrmFilter] = useState<CrmTarget | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = () => setLog(getSyncLog());

  useEffect(() => {
    refresh();
    window.addEventListener("crm-sync-log-updated", refresh);
    return () => window.removeEventListener("crm-sync-log-updated", refresh);
  }, []);

  const filtered = useMemo(() => log.filter(e =>
    (statusFilter === "all" || e.status === statusFilter) &&
    (crmFilter === "all" || e.target === crmFilter)
  ), [log, statusFilter, crmFilter]);

  const stats = useMemo(() => ({
    total: log.length,
    success: log.filter(e => e.status === "success").length,
    error: log.filter(e => e.status === "error").length,
  }), [log]);

  const handleExport = () => {
    if (!filtered.length) return toast.error("Nothing to export");
    const csv = exportSyncLogCsv(filtered);
    downloadCsv(`crm-sync-log-${new Date().toISOString().split("T")[0]}.csv`, csv);
    toast.success(`Exported ${filtered.length} entries`);
  };

  const handleClear = () => {
    if (!confirm("Clear all sync log entries? This cannot be undone.")) return;
    clearSyncLog();
    toast.success("Sync log cleared");
  };

  return (
    <div className="card-elevated p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Recent CRM syncs</h3>
            <p className="text-[11px] text-muted-foreground">Last {Math.min(log.length, 200)} sync attempts</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExport}
            disabled={!filtered.length}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={11} /> CSV
          </button>
          <button
            onClick={handleClear}
            disabled={!log.length}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total</p>
          <p className="text-lg font-bold">{stats.total}</p>
        </div>
        <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-bold">Success</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{stats.success}</p>
        </div>
        <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
          <p className="text-[10px] uppercase tracking-wider text-destructive font-bold">Failed</p>
          <p className="text-lg font-bold text-destructive">{stats.error}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
        <Filter size={11} className="text-muted-foreground shrink-0" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CrmSyncStatus | "all")}
          className="text-[11px] px-2 py-1 rounded-md border border-border bg-background"
        >
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={crmFilter}
          onChange={(e) => setCrmFilter(e.target.value as CrmTarget | "all")}
          className="text-[11px] px-2 py-1 rounded-md border border-border bg-background"
        >
          <option value="all">All CRMs</option>
          {CRM_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {/* Log list */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-muted/40 flex items-center justify-center">
            <Activity size={16} className="text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            {log.length === 0 ? "No syncs yet. Push a note to a CRM to see activity." : "No entries match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
          {filtered.map(entry => {
            const meta = STATUS_META[entry.status];
            const crm = CRM_OPTIONS.find(o => o.id === entry.target);
            const isOpen = expanded === entry.id;
            return (
              <div key={entry.id} className="border border-border/60 rounded-lg overflow-hidden bg-background">
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="w-full p-2.5 flex items-center gap-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${meta.bg}`}>
                    <meta.Icon size={13} className={meta.color} />
                  </div>
                  {crm && (
                    <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: crm.bg }}>
                      <Building2 size={11} style={{ color: crm.color }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{entry.entity_name || entry.entity_id}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {entry.entity} · {entry.sync_type} · {formatRelative(entry.timestamp)}
                    </p>
                  </div>
                  <ChevronDown size={12} className={`text-muted-foreground transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-border/40 bg-muted/20">
                        <Detail label="Timestamp" value={new Date(entry.timestamp).toLocaleString()} />
                        <Detail label="Status" value={meta.label} valueClass={meta.color} />
                        <Detail label="Sync type" value={entry.sync_type} />
                        {entry.conflict_policy && <Detail label="Conflict policy" value={entry.conflict_policy} />}
                        {entry.duration_ms != null && <Detail label="Duration" value={`${entry.duration_ms} ms`} />}
                        <Detail label="Entity ID" value={entry.entity_id} mono />
                        {entry.error && (
                          <div className="mt-2 p-2 rounded-md bg-destructive/5 border border-destructive/20">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-destructive mb-0.5">Error</p>
                            <p className="text-[11px] text-destructive font-mono break-all">{entry.error}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Detail = ({ label, value, valueClass, mono }: { label: string; value: string; valueClass?: string; mono?: boolean }) => (
  <div className="flex items-center justify-between gap-2 text-[11px]">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-medium truncate ${valueClass ?? ""} ${mono ? "font-mono text-[10px]" : ""}`}>{value}</span>
  </div>
);

export default CrmSyncLogPanel;
