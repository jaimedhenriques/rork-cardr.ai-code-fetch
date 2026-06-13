// Mirrors the per-recipient header derivation used by the
// `run-export-schedule` edge function (see
// supabase/functions/run-export-schedule/headers.ts) so the wizard can
// preview exactly what each recipient will see in the To/Cc rows of the
// rendered email and the X-Original-To/X-Original-Cc headers attached
// to their delivery, BEFORE the schedule is saved.
//
// Behaviour contract (must stay in sync with the edge function):
// - visibleTo = comma-joined To list, or null if To is empty.
// - visibleCc = comma-joined Cc list, or null if Cc is empty.
// - For a Bcc delivery, if the recipient's own address ALSO appears in
//   To or Cc, suppress headers entirely (null) so the rendered email
//   never reveals the leak.
// - Address comparison uses canonicalAddress() (display name strip,
//   plus-addressing fold, Gmail dot-fold) to avoid trivially-bypassed
//   leak detection — see headers.ts for the full rationale.

export type DeliveryRole = "to" | "cc" | "bcc";

export interface HeaderInputs {
  toRecipients: string[];
  ccRecipients: string[];
  bccRecipients: string[];
}

export interface VisibleHeaders {
  visibleTo: string | null;
  visibleCc: string | null;
}

// Strip RFC 5322 display names / angle brackets and lowercase. So
// `"Alice" <Alice@Example.COM>` → `alice@example.com`.
export const extractAddress = (raw: string): string => {
  if (!raw) return "";
  let s = raw.trim();
  const angle = s.match(/<([^<>]+)>\s*$/);
  if (angle) s = angle[1];
  s = s.replace(/^['"\s]+|['"\s]+$/g, "");
  return s.toLowerCase();
};

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

// Apply provider-aware folding: drop +tag sub-addressing for all
// providers; for Gmail/Googlemail also remove dots in the local part
// and fold googlemail.com → gmail.com.
export const canonicalAddress = (raw: string): string => {
  const addr = extractAddress(raw);
  const at = addr.lastIndexOf("@");
  if (at < 1 || at === addr.length - 1) return addr;
  let local = addr.slice(0, at);
  let domain = addr.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus !== -1) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  if (!local) return addr;
  return `${local}@${domain}`;
};

export const norm = (e: string): string => canonicalAddress(e);

export function deriveBaseHeaders(inputs: HeaderInputs): VisibleHeaders {
  return {
    visibleTo: inputs.toRecipients.length > 0 ? inputs.toRecipients.join(", ") : null,
    visibleCc: inputs.ccRecipients.length > 0 ? inputs.ccRecipients.join(", ") : null,
  };
}

export function safeHeadersForDelivery(
  inputs: HeaderInputs,
  recipient: string,
  role: DeliveryRole,
): VisibleHeaders {
  const base = deriveBaseHeaders(inputs);
  if (role !== "bcc") return base;
  const toSet = new Set(inputs.toRecipients.map(canonicalAddress));
  const ccSet = new Set(inputs.ccRecipients.map(canonicalAddress));
  const key = canonicalAddress(recipient);
  if (toSet.has(key) || ccSet.has(key)) {
    return { visibleTo: null, visibleCc: null };
  }
  return base;
}

export interface RecipientPreviewRow {
  recipient: string;
  role: DeliveryRole;
  visibleTo: string | null;
  visibleCc: string | null;
  /** True if Bcc headers were suppressed because the recipient also appears in To/Cc. */
  suppressed: boolean;
}

/**
 * Build the per-recipient preview rows. Empty entries are skipped and
 * BCC rows are tagged when their headers are suppressed by the leak guard.
 */
export function buildRecipientHeaderPreview(inputs: HeaderInputs): RecipientPreviewRow[] {
  const rows: RecipientPreviewRow[] = [];
  const push = (recipient: string, role: DeliveryRole) => {
    const trimmed = recipient.trim();
    if (!trimmed) return;
    const headers = safeHeadersForDelivery(inputs, trimmed, role);
    const base = deriveBaseHeaders(inputs);
    const suppressed =
      role === "bcc" && (base.visibleTo !== null || base.visibleCc !== null) &&
      headers.visibleTo === null && headers.visibleCc === null;
    rows.push({ recipient: trimmed, role, ...headers, suppressed });
  };
  inputs.toRecipients.forEach((r) => push(r, "to"));
  inputs.ccRecipients.forEach((r) => push(r, "cc"));
  inputs.bccRecipients.forEach((r) => push(r, "bcc"));
  return rows;
}
