// Client-side duplicate policy for contact capture.
//
// This runs before insertion so a repeat contact never becomes a second row.
// It is deliberately pure and free of React/Supabase imports so both the
// capture modal and its tests can use it directly. There is no database
// uniqueness constraint behind it, so this protects against ordinary UI
// duplication, not concurrent writes.

import { normalizePhone } from "@/lib/phone-dedup";

/** Fields a freshly captured (scanned or typed) contact can carry. */
export interface DuplicateCandidate {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  workPhone?: string;
  notes?: string;
  linkedin?: string;
  website?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  stageId?: string;
}

export interface ExistingContact extends DuplicateCandidate {
  id: string;
}

export type DuplicateReason = "email" | "phone";

export interface DuplicateMatch {
  contact: ExistingContact;
  reason: DuplicateReason;
}

/** Normalize an email to a comparable key. Empty for blank input. */
export function normalizeEmail(input?: string | null): string {
  return (input ?? "").trim().toLowerCase();
}

/**
 * Every phone slot a contact can occupy. A scanned badge often lands in
 * `phone` while the saved contact carries the same number under `mobilePhone`
 * or `workPhone` after enrichment, so all three have to be compared.
 */
const PHONE_FIELDS = ["phone", "mobilePhone", "workPhone"] as const;

/** Normalized keys for every phone slot on a contact, blanks dropped. */
function phoneKeys(contact: DuplicateCandidate): Set<string> {
  const keys = new Set<string>();
  for (const field of PHONE_FIELDS) {
    const key = normalizePhone(contact[field]);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Find the first saved contact that shares a normalized email or phone with
 * the candidate. Email is checked before phone so the reported reason matches
 * the strongest signal. A phone match counts when any candidate phone field
 * normalizes to any saved phone field.
 */
export function findDuplicateContact(
  candidate: DuplicateCandidate,
  existing: ExistingContact[],
  options: { excludeId?: string } = {},
): DuplicateMatch | null {
  const pool = options.excludeId
    ? existing.filter((c) => c.id !== options.excludeId)
    : existing;

  const email = normalizeEmail(candidate.email);
  if (email) {
    const byEmail = pool.find((c) => normalizeEmail(c.email) === email);
    if (byEmail) return { contact: byEmail, reason: "email" };
  }

  const phones = phoneKeys(candidate);
  if (phones.size > 0) {
    const byPhone = pool.find((c) => {
      for (const key of phoneKeys(c)) if (phones.has(key)) return true;
      return false;
    });
    if (byPhone) return { contact: byPhone, reason: "phone" };
  }

  return null;
}

/** Text fields that a merge is allowed to fill in when they are blank. */
const MERGEABLE_FIELDS = [
  "name",
  "company",
  "title",
  "email",
  "phone",
  "mobilePhone",
  "workPhone",
  "notes",
  "linkedin",
  "website",
  "location",
  "industry",
  "companySize",
] as const;

/**
 * Build the update patch for merging a captured candidate into a contact that
 * already exists. Existing non-empty values always win; only blanks get filled.
 *
 * `stageId` is the exception: it is an explicit buyer choice made during this
 * capture, so a selected stage overrides the current one. Leaving the selector
 * on Unassigned changes nothing.
 */
export function buildMergeUpdates(
  existing: ExistingContact,
  candidate: DuplicateCandidate,
): DuplicateCandidate {
  const updates: DuplicateCandidate = {};

  for (const field of MERGEABLE_FIELDS) {
    const incoming = (candidate[field] ?? "").trim();
    if (!incoming) continue;
    if ((existing[field] ?? "").trim()) continue;
    updates[field] = incoming;
  }

  const stageId = (candidate.stageId ?? "").trim();
  if (stageId && stageId !== existing.stageId) updates.stageId = stageId;

  return updates;
}
