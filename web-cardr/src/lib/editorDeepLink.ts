/**
 * Editor deep-link utilities
 * ---------------------------
 * Shared helpers for generating editor-protocol URLs (vscode://, cursor://,
 * etc.) that open a file at a specific line and column. Preferences are stored
 * in localStorage so each operator can pin their own editor + local workspace
 * root once and never think about it again.
 */

export type EditorKind = "vscode" | "vscode-insiders" | "cursor" | "windsurf" | "jetbrains";

export interface EditorPrefs {
  editor: EditorKind;
  /** Absolute path to the repo on the operator's machine, e.g. /Users/me/code/app */
  root: string;
}

const EDITOR_PREFS_KEY = "typecheck.editor-prefs.v1";
const DEFAULT_PREFS: EditorPrefs = { editor: "vscode", root: "" };

export function loadEditorPrefs(): EditorPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(EDITOR_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveEditorPrefs(prefs: EditorPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage may be disabled (private mode); ignore */
  }
}

/**
 * Build an editor-protocol URL that opens the file at the right line/column.
 * Each editor exposes a slightly different scheme; we normalize to a single
 * absolute path joined from the configured workspace root + the relative path
 * the type-checker reported. Returns `null` when the root isn't set, so the
 * UI can render a "configure editor" affordance instead of a broken link.
 */
export function buildEditorUrl(
  prefs: EditorPrefs,
  file: string,
  line?: number,
  column?: number,
): string | null {
  if (!prefs.root) return null;
  // Normalize: strip trailing slash on root, leading slash on file.
  const root = prefs.root.replace(/\/+$/, "");
  const rel = file.replace(/^\/+/, "");
  const abs = `${root}/${rel}`;
  const ln = Math.max(1, line ?? 1);
  const col = Math.max(1, column ?? 1);

  switch (prefs.editor) {
    case "vscode":
      return `vscode://file/${abs}:${ln}:${col}`;
    case "vscode-insiders":
      return `vscode-insiders://file/${abs}:${ln}:${col}`;
    case "cursor":
      return `cursor://file/${abs}:${ln}:${col}`;
    case "windsurf":
      return `windsurf://file/${abs}:${ln}:${col}`;
    case "jetbrains":
      // JetBrains Toolbox URL scheme — works for WebStorm/IDEA/PyCharm.
      return `jetbrains://web-storm/navigate/reference?path=${encodeURIComponent(abs)}:${ln}:${col}`;
    default:
      return null;
  }
}
