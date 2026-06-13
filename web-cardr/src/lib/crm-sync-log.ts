// Lightweight client-side log of CRM sync attempts. Stored in localStorage (capped at 200).
// Persisted from crm-sync.ts; rendered by CrmSyncLogPanel.
import type { CrmTarget } from "@/lib/crm-sync";

export type CrmSyncStatus = "success" | "error" | "pending";
export type CrmSyncEntity = "note" | "contact";

export interface CrmSyncLogEntry {
  id: string;
  timestamp: string; // ISO
  target: CrmTarget;
  entity: CrmSyncEntity;
  entity_id: string;
  entity_name: string;
  status: CrmSyncStatus;
  sync_type: "manual" | "auto";
  error?: string;
  duration_ms?: number;
  conflict_policy?: string;
}

const STORAGE_KEY = "cardr_crm_sync_log_v1";
const MAX_ENTRIES = 200;

export const getSyncLog = (): CrmSyncLogEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CrmSyncLogEntry[]) : [];
  } catch { return []; }
};

export const appendSyncLog = (entry: Omit<CrmSyncLogEntry, "id" | "timestamp">) => {
  try {
    const log = getSyncLog();
    const next: CrmSyncLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    log.unshift(next);
    if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    window.dispatchEvent(new CustomEvent("crm-sync-log-updated"));
  } catch {}
};

export const clearSyncLog = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("crm-sync-log-updated"));
  } catch {}
};

export const exportSyncLogCsv = (entries: CrmSyncLogEntry[]): string => {
  const header = ["Timestamp", "CRM", "Entity", "Entity ID", "Entity Name", "Status", "Sync Type", "Conflict Policy", "Duration (ms)", "Error"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = entries.map(e => [
    e.timestamp, e.target, e.entity, e.entity_id, e.entity_name,
    e.status, e.sync_type, e.conflict_policy ?? "", e.duration_ms ?? "", e.error ?? "",
  ].map(escape).join(","));
  return [header.join(","), ...rows].join("\n");
};

export const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
