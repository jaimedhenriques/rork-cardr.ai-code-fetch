// Per-CRM field mapping + conflict policy. Stored locally (presentation/config only).
// Applied client-side before firing webhooks via crm-sync.ts.
import type { CrmTarget } from "@/lib/crm-sync";

export type ConflictPolicy = "skip" | "overwrite" | "merge" | "ask";

export const CONFLICT_POLICIES: { id: ConflictPolicy; label: string; description: string }[] = [
  { id: "skip",      label: "Skip",      description: "Keep existing CRM values, ignore changes" },
  { id: "overwrite", label: "Overwrite", description: "Always replace CRM values with Cardr values" },
  { id: "merge",     label: "Merge",     description: "Fill empty CRM fields, keep existing where present" },
  { id: "ask",       label: "Ask",       description: "Prompt before pushing on conflict" },
];

/** Source field key -> human label. Keep in sync with NoteCrmPayload + contact shape. */
export const NOTE_FIELDS = [
  { key: "title",            label: "Title" },
  { key: "summary",          label: "AI Summary" },
  { key: "transcript",       label: "Full Transcript" },
  { key: "manual_notes",     label: "Manual Notes" },
  { key: "action_items",     label: "Action Items" },
  { key: "decisions",        label: "Decisions" },
  { key: "follow_ups",       label: "Follow-ups" },
  { key: "category",         label: "Category" },
  { key: "duration_seconds", label: "Duration" },
  { key: "created_at",       label: "Created At" },
] as const;

export const CONTACT_FIELDS = [
  { key: "name",    label: "Name" },
  { key: "email",   label: "Email" },
  { key: "phone",   label: "Phone" },
  { key: "company", label: "Company" },
  { key: "title",   label: "Job Title" },
] as const;

export type NoteFieldKey = typeof NOTE_FIELDS[number]["key"];
export type ContactFieldKey = typeof CONTACT_FIELDS[number]["key"];

export interface CrmFieldMapping {
  /** Source field -> destination CRM field name (empty string = use source key). */
  noteFields: Partial<Record<NoteFieldKey, { enabled: boolean; destField: string }>>;
  contactFields: Partial<Record<ContactFieldKey, { enabled: boolean; destField: string }>>;
  pushContacts: boolean;
  conflictPolicy: ConflictPolicy;
}

const STORAGE_KEY = "cardr_crm_field_mappings_v1";

/** CRM-native default destination names (HubSpot/Salesforce/Zoho all accept these patterns via Zapier). */
const DEFAULT_NOTE_DEST: Record<NoteFieldKey, string> = {
  title:            "subject",
  summary:          "body",
  transcript:       "transcript",
  manual_notes:     "notes",
  action_items:     "action_items",
  decisions:        "decisions",
  follow_ups:       "next_steps",
  category:         "type",
  duration_seconds: "duration",
  created_at:       "activity_date",
};

const DEFAULT_CONTACT_DEST: Record<ContactFieldKey, string> = {
  name:    "full_name",
  email:   "email",
  phone:   "phone",
  company: "company",
  title:   "job_title",
};

export const defaultMapping = (): CrmFieldMapping => ({
  noteFields: Object.fromEntries(
    NOTE_FIELDS.map(f => [f.key, { enabled: true, destField: DEFAULT_NOTE_DEST[f.key] }])
  ) as CrmFieldMapping["noteFields"],
  contactFields: Object.fromEntries(
    CONTACT_FIELDS.map(f => [f.key, { enabled: true, destField: DEFAULT_CONTACT_DEST[f.key] }])
  ) as CrmFieldMapping["contactFields"],
  pushContacts: true,
  conflictPolicy: "merge",
});

const readAll = (): Partial<Record<CrmTarget, CrmFieldMapping>> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export const getMapping = (target: CrmTarget): CrmFieldMapping => {
  const all = readAll();
  return all[target] ?? defaultMapping();
};

export const saveMapping = (target: CrmTarget, mapping: CrmFieldMapping) => {
  const all = readAll();
  all[target] = mapping;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
};

export const resetMapping = (target: CrmTarget) => {
  const all = readAll();
  delete all[target];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
};

/** Transform an outgoing payload by stripping disabled fields and renaming enabled ones. */
export function applyMapping<T extends Record<string, unknown>>(
  source: T,
  fieldConfig: Partial<Record<string, { enabled: boolean; destField: string }>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, cfg] of Object.entries(fieldConfig)) {
    if (!cfg?.enabled) continue;
    if (source[key] === undefined || source[key] === null) continue;
    out[cfg.destField || key] = source[key];
  }
  return out;
}
