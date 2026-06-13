import { supabase } from "@/integrations/supabase/client";

/**
 * Typed helpers for the Export Schedules CSV preview.
 *
 * The preview must select a *dynamic* set of columns chosen by the user
 * (e.g. "name,email,company,…"). With supabase-js's generated types, a
 * dynamic string literal in `.select(...)` resolves to `GenericStringError`,
 * which forces every caller to do `as unknown as Record<string, unknown>[]`.
 *
 * These helpers centralise that boundary in one place: callers get back
 * plain `PreviewRow[]` values with no `any`/`unknown` casts at the call
 * site, and the only unsafe cast lives here, where it is provably safe
 * (the rows really are JSON objects keyed by the requested columns).
 */

export type PreviewRow = Record<string, unknown>;

const PREVIEW_REQUIRED_COLS = ["id", "scanned_at", "created_at"] as const;

/** Build the column list we always need for a preview (user cols + identity). */
export function buildPreviewColumnList(columns: string[]): string {
  return Array.from(new Set([...columns, ...PREVIEW_REQUIRED_COLS])).join(",");
}

/**
 * Build the count-only query (HEAD request, no rows).
 * Strictly typed by supabase-js — chain `.eq`, `.in`, `.or`, etc. as usual.
 */
export function buildPreviewCountQuery(userId: string) {
  return supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
}

/**
 * Build the row-sample query for the preview using a dynamic column list.
 * Returns the supabase-js builder so callers can keep chaining filters.
 *
 * The single, isolated cast widens the row type to `PreviewRow`, so the
 * awaited `data` is `PreviewRow[] | null` — no cast needed at the call site.
 */
export function buildPreviewSampleQuery(columns: string[], userId: string) {
  const queryCols = buildPreviewColumnList(columns);

  type SampleBuilder = ReturnType<typeof buildPreviewCountQuery> extends infer _
    ? PreviewSampleBuilder
    : never;

  const builder = supabase
    .from("contacts")
    .select(queryCols)
    .eq("user_id", userId)
    .order("scanned_at", { ascending: false });

  return builder as unknown as SampleBuilder;
}

/**
 * Structural type for the preview sample builder: anything we await on it
 * yields `{ data: PreviewRow[] | null; error: ... }`, and every chain
 * method returns the same builder so the call site stays fluent.
 *
 * We intentionally type only the methods this component uses; if more are
 * needed later, add them here rather than reaching for `as any`.
 */
export interface PreviewSampleBuilder
  extends PromiseLike<{ data: PreviewRow[] | null; error: { message: string } | null; count: number | null }> {
  limit(count: number): PreviewSampleBuilder;
  range(from: number, to: number): PreviewSampleBuilder;
  eq(column: string, value: unknown): PreviewSampleBuilder;
  in(column: string, values: readonly unknown[]): PreviewSampleBuilder;
  gte(column: string, value: unknown): PreviewSampleBuilder;
  lte(column: string, value: unknown): PreviewSampleBuilder;
  or(filters: string, options?: { foreignTable?: string; referencedTable?: string }): PreviewSampleBuilder;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): PreviewSampleBuilder;
}
