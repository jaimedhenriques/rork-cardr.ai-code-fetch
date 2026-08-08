// Write-result inspection for authenticated contact updates.
//
// Supabase resolves its query builder with `{ data, error }` instead of
// rejecting, so awaiting an update proves nothing about whether the row
// changed. Kept separate from AppContext so the "did this write land?"
// decision — which gates local state mutation, webhooks, and the success
// toast — can be asserted directly in tests.

export interface ContactWriteResult {
  error?: unknown;
}

/**
 * True only when the store confirmed the write. A missing result, a thrown
 * error captured as a result, or any populated `error` field is a failure.
 */
export function contactWriteSucceeded(
  result: ContactWriteResult | null | undefined,
): boolean {
  if (!result) return false;
  return !result.error;
}
