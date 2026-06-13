import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

/** Row shape used for both outreach drafts and sequence-run messages. */
export interface OutreachExportRow {
  contact_name: string;
  contact_company: string;
  contact_email: string;
  sequence: string;
  channel: string;
  step: number | string;
  status: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at: string;
  created_at: string;
}

const HEADERS: { key: keyof OutreachExportRow; label: string }[] = [
  { key: "contact_name", label: "Contact" },
  { key: "contact_company", label: "Company" },
  { key: "contact_email", label: "Email" },
  { key: "sequence", label: "Sequence" },
  { key: "channel", label: "Channel" },
  { key: "step", label: "Step" },
  { key: "status", label: "Status" },
  { key: "subject", label: "Subject" },
  { key: "body", label: "Body" },
  { key: "scheduled_at", label: "Scheduled At" },
  { key: "sent_at", label: "Sent At" },
  { key: "created_at", label: "Created At" },
];

const fmtDate = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "yyyy-MM-dd HH:mm") : "";

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const buildOutreachCSV = (rows: OutreachExportRow[]): string => {
  const headerRow = HEADERS.map((h) => h.label);
  const dataRows = rows.map((r) =>
    HEADERS.map((h) => {
      const v = r[h.key];
      return v === null || v === undefined ? "" : String(v);
    })
  );
  return [headerRow, ...dataRows]
    .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
};

export const downloadOutreachCSV = (rows: OutreachExportRow[], baseName = "outreach-export") => {
  const csv = buildOutreachCSV(rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${baseName}-${format(new Date(), "yyyy-MM-dd")}.csv`);
};

export const downloadOutreachXLSX = (rows: OutreachExportRow[], baseName = "outreach-export") => {
  const aoa: (string | number)[][] = [HEADERS.map((h) => h.label)];
  rows.forEach((r) => {
    aoa.push(
      HEADERS.map((h) => {
        const v = r[h.key];
        return v === null || v === undefined ? "" : (typeof v === "number" ? v : String(v));
      })
    );
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Reasonable default column widths.
  ws["!cols"] = HEADERS.map((h) =>
    h.key === "body"
      ? { wch: 60 }
      : h.key === "subject" || h.key === "sequence" || h.key === "contact_name"
      ? { wch: 26 }
      : { wch: 18 }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Outreach");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${baseName}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
};

/** Fetch all sequence runs (with their messages) for the current user. */
export const fetchSequenceRunRows = async (sequenceId?: string): Promise<OutreachExportRow[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let runsQ: any = supabase
    .from("automation_sequence_runs")
    .select("id,sequence_id,contact_id,status,current_step,created_at,contacts(name,company,email),automation_sequences(name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (sequenceId) runsQ = runsQ.eq("sequence_id", sequenceId);
  const { data: runs, error: runsErr } = await runsQ;
  if (runsErr) throw runsErr;
  if (!runs?.length) return [];

  const runIds = runs.map((r: any) => r.id);
  const { data: msgs, error: msgsErr } = await supabase
    .from("automation_sequence_messages")
    .select("id,run_id,step_id,channel,subject,body,status,scheduled_at,sent_at,created_at")
    .in("run_id", runIds)
    .order("created_at", { ascending: true });
  if (msgsErr) throw msgsErr;

  // Look up step ordering separately so types stay simple.
  const stepIds = Array.from(new Set((msgs || []).map((m: any) => m.step_id).filter(Boolean)));
  const stepOrderById: Record<string, number> = {};
  if (stepIds.length) {
    const { data: steps } = await supabase
      .from("automation_sequence_steps")
      .select("id,step_order")
      .in("id", stepIds as string[]);
    (steps || []).forEach((s: any) => (stepOrderById[s.id] = s.step_order));
  }

  const byRun: Record<string, any> = {};
  runs.forEach((r: any) => (byRun[r.id] = r));

  const rows: OutreachExportRow[] = [];
  (msgs || []).forEach((m: any) => {
    const r = byRun[m.run_id];
    if (!r) return;
    rows.push({
      contact_name: r.contacts?.name ?? "",
      contact_company: r.contacts?.company ?? "",
      contact_email: r.contacts?.email ?? "",
      sequence: r.automation_sequences?.name ?? "",
      channel: m.channel ?? "",
      step: stepOrderById[m.step_id] ?? "",
      status: m.status ?? "",
      subject: m.subject ?? "",
      body: m.body ?? "",
      scheduled_at: fmtDate(m.scheduled_at),
      sent_at: fmtDate(m.sent_at),
      created_at: fmtDate(m.created_at),
    });
  });
  return rows;
};

/** Fetch outreach-drafter agent runs for a specific contact and convert to rows. */
export const fetchOutreachDraftRows = async (contactId: string): Promise<OutreachExportRow[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "draft_outreach")
    .maybeSingle();
  if (!agent) return [];

  const { data: runs } = await supabase
    .from("agent_runs")
    .select("id,created_at,status,input,output,contacts(name,company,email)")
    .eq("agent_id", agent.id)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (runs || []).map((r: any) => {
    const out = r.output || {};
    return {
      contact_name: r.contacts?.name ?? "",
      contact_company: r.contacts?.company ?? "",
      contact_email: r.contacts?.email ?? "",
      sequence: "Ad-hoc draft",
      channel: out.channel || r.input?.channel || "",
      step: "",
      status: r.status ?? "",
      subject: out.subject || "",
      body: out.body || out.message || "",
      scheduled_at: "",
      sent_at: "",
      created_at: fmtDate(r.created_at),
    };
  });
};
