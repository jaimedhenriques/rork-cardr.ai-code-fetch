/* Folder name normalization helpers — keep in sync with comparisons used in
 * the contacts/scan flow so we never create duplicates that differ only by
 * whitespace, casing, or Unicode form. */

/**
 * Normalize a folder name for comparison:
 * - trim leading/trailing whitespace
 * - collapse internal runs of whitespace to a single space
 * - case-fold using locale-aware lowercase
 * - apply Unicode NFKC normalization so visually-identical strings compare equal
 *
 * Use this any time you compare or de-duplicate folder names so we never end up
 * with "Acme", "  acme " and "ACME " as three separate folders.
 */
export const normalizeFolderName = (name: string): string =>
  (name ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();

/** Find an existing folder whose name matches `name` after normalization. */
export const findFolderByName = <T extends { name: string }>(
  folders: readonly T[],
  name: string,
): T | undefined => {
  const target = normalizeFolderName(name);
  if (!target) return undefined;
  return folders.find((f) => normalizeFolderName(f.name) === target);
};

/** Pretty form of a folder name: trimmed + whitespace collapsed (preserves casing). */
export const cleanFolderName = (name: string): string =>
  (name ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
