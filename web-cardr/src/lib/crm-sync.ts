// CRM sync routes through existing webhook system. Users connect HubSpot/Salesforce/Zoho
// in their Zapier or Pipedream workflow and filter on `target_crm`.
import { fireWebhook } from "@/lib/webhooks";
import { applyMapping, getMapping } from "@/lib/crm-field-mapping";
import { appendSyncLog } from "@/lib/crm-sync-log";

export type CrmTarget = "hubspot" | "salesforce" | "zoho";

export const CRM_OPTIONS: { id: CrmTarget; label: string; color: string; bg: string }[] = [
  { id: "hubspot",    label: "HubSpot",    color: "#FF7A59", bg: "linear-gradient(135deg, #FFF1ED 0%, #FFE0D6 100%)" },
  { id: "salesforce", label: "Salesforce", color: "#00A1E0", bg: "linear-gradient(135deg, #E6F5FB 0%, #CFEBF5 100%)" },
  { id: "zoho",       label: "Zoho",       color: "#E42527", bg: "linear-gradient(135deg, #FCE7E8 0%, #F9D2D4 100%)" },
];

const AUTO_SYNC_KEY = "cardr_crm_autosync_targets";
const AUTO_SYNC_ENABLED_KEY = "cardr_crm_autosync_enabled";

export const getAutoSyncTargets = (): CrmTarget[] => {
  try {
    const raw = localStorage.getItem(AUTO_SYNC_KEY);
    return raw ? (JSON.parse(raw) as CrmTarget[]) : [];
  } catch { return []; }
};

export const setAutoSyncTargets = (targets: CrmTarget[]) => {
  try { localStorage.setItem(AUTO_SYNC_KEY, JSON.stringify(targets)); } catch {}
};

/** Global master switch for auto-sync. Defaults to true so existing target selections keep working. */
export const isAutoSyncEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem(AUTO_SYNC_ENABLED_KEY);
    return raw === null ? true : raw === "true";
  } catch { return true; }
};

export const setAutoSyncEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(AUTO_SYNC_ENABLED_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent("crm-autosync-toggled", { detail: { enabled } }));
  } catch {}
};

export interface NoteCrmPayload {
  noteId: string;
  title: string;
  summary: string | null;
  transcript: string | null;
  manual_notes: string | null;
  action_items?: unknown[];
  decisions?: unknown[];
  follow_ups?: unknown[];
  category?: string | null;
  duration_seconds?: number;
  created_at?: string;
  contacts?: { id: string; name: string; email?: string; company?: string; title?: string; phone?: string }[];
}

export async function pushNoteToCrm(
  target: CrmTarget,
  note: NoteCrmPayload,
  syncType: "manual" | "auto" = "manual",
): Promise<void> {
  const mapping = getMapping(target);
  const mappedNote = applyMapping(note as unknown as Record<string, unknown>, mapping.noteFields);

  // Push the note
  const noteStart = performance.now();
  try {
    await fireWebhook("note.created", {
      ...mappedNote,
      noteId: note.noteId,
      target_crm: target,
      sync_type: syncType,
      conflict_policy: mapping.conflictPolicy,
    });
    appendSyncLog({
      target, entity: "note", entity_id: note.noteId, entity_name: note.title,
      status: "success", sync_type: syncType,
      conflict_policy: mapping.conflictPolicy,
      duration_ms: Math.round(performance.now() - noteStart),
    });
  } catch (err) {
    appendSyncLog({
      target, entity: "note", entity_id: note.noteId, entity_name: note.title,
      status: "error", sync_type: syncType,
      conflict_policy: mapping.conflictPolicy,
      duration_ms: Math.round(performance.now() - noteStart),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Push linked contacts so they get upserted in the destination CRM
  if (mapping.pushContacts && note.contacts?.length) {
    await Promise.allSettled(
      note.contacts.map(async (c) => {
        const mappedContact = applyMapping(c as unknown as Record<string, unknown>, mapping.contactFields);
        const start = performance.now();
        try {
          await fireWebhook("contact.updated", {
            ...mappedContact,
            id: c.id,
            target_crm: target,
            source_note_id: note.noteId,
            conflict_policy: mapping.conflictPolicy,
          });
          appendSyncLog({
            target, entity: "contact", entity_id: c.id, entity_name: c.name,
            status: "success", sync_type: syncType,
            conflict_policy: mapping.conflictPolicy,
            duration_ms: Math.round(performance.now() - start),
          });
        } catch (err) {
          appendSyncLog({
            target, entity: "contact", entity_id: c.id, entity_name: c.name,
            status: "error", sync_type: syncType,
            conflict_policy: mapping.conflictPolicy,
            duration_ms: Math.round(performance.now() - start),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );
  }
}

export async function autoSyncNote(note: NoteCrmPayload): Promise<void> {
  if (!isAutoSyncEnabled()) return;
  const targets = getAutoSyncTargets();
  if (!targets.length) return;
  await Promise.allSettled(targets.map(t => pushNoteToCrm(t, note, "auto")));
}
