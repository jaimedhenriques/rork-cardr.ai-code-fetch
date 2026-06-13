// Phone number normalization + dedup helpers.
// Used when merging enrichment results into a contact so multiple enrichment
// runs (PDL, Icypeas, AI, Twilio Lookup) can't produce duplicate phone fields.

/** Normalize a phone string to a comparable digit-only key. */
export function normalizePhone(input?: string | null): string {
  if (!input) return "";
  const digits = String(input).replace(/[^\d]/g, "");
  if (!digits) return "";
  // Drop a leading country-code "1" for NANP-style 11-digit numbers so
  // "+1 415 555 1212" and "415 555 1212" dedupe to the same key.
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export interface ContactPhones {
  phone?: string;
  mobilePhone?: string;
  workPhone?: string;
}

/**
 * Given the existing contact phones and an incoming enrichment patch,
 * return a phone-only patch that:
 *  - skips values that already exist on the contact (any field)
 *  - skips values that would duplicate another field in the same patch
 *  - prefers mobile > work > primary when the same number appears in multiple
 *    incoming fields.
 */
export function dedupePhonePatch(
  existing: ContactPhones,
  incoming: ContactPhones,
): ContactPhones {
  const seen = new Set<string>();
  const add = (v?: string | null) => {
    const k = normalizePhone(v);
    if (k) seen.add(k);
  };
  add(existing.phone);
  add(existing.mobilePhone);
  add(existing.workPhone);

  const out: ContactPhones = {};

  // Order matters: mobile is most specific, then work, then generic phone.
  const tryAssign = (
    field: "mobilePhone" | "workPhone" | "phone",
    value?: string,
  ) => {
    if (!value) return;
    const key = normalizePhone(value);
    if (!key || seen.has(key)) return;
    out[field] = value.trim();
    seen.add(key);
  };

  tryAssign("mobilePhone", incoming.mobilePhone);
  tryAssign("workPhone", incoming.workPhone);
  tryAssign("phone", incoming.phone);

  return out;
}
