import { describe, expect, it } from "vitest";

import {
  isLintable,
  parseAddedLines,
  resolveBase,
} from "../../scripts/lint-changed-lines.mjs";

const DIFF = [
  "diff --git a/web-cardr/src/a.ts b/web-cardr/src/a.ts",
  "--- a/web-cardr/src/a.ts",
  "+++ b/web-cardr/src/a.ts",
  "@@ -10 +10 @@",
  "-const a = 1;",
  "+const a = 2;",
  "@@ -20,0 +21,3 @@",
  "+one",
  "+two",
  "+three",
  "diff --git a/web-cardr/src/gone.ts b/web-cardr/src/gone.ts",
  "--- a/web-cardr/src/gone.ts",
  "+++ /dev/null",
  "@@ -1,5 +0,0 @@",
  "-removed",
  "diff --git a/web-cardr/src/trimmed.ts b/web-cardr/src/trimmed.ts",
  "--- a/web-cardr/src/trimmed.ts",
  "+++ b/web-cardr/src/trimmed.ts",
  "@@ -4,2 +3,0 @@",
  "-x",
  "-y",
  "diff --git a/web-cardr/src/new.ts b/web-cardr/src/new.ts",
  "--- /dev/null",
  "+++ b/web-cardr/src/new.ts",
  "@@ -0,0 +1,2 @@",
  "+first",
  "+second",
  "",
].join("\n");

describe("parseAddedLines", () => {
  const added = parseAddedLines(DIFF);

  it("reads a single-line hunk with an omitted count", () => {
    expect([...added.get("web-cardr/src/a.ts")!]).toContain(10);
  });

  it("expands a multi-line hunk to every added line", () => {
    expect([...added.get("web-cardr/src/a.ts")!].sort((x, y) => x - y)).toEqual([
      10, 21, 22, 23,
    ]);
  });

  it("ignores deleted files and delete-only hunks", () => {
    expect(added.has("web-cardr/src/gone.ts")).toBe(false);
    expect(added.has("web-cardr/src/trimmed.ts")).toBe(false);
  });

  it("covers a whole new file", () => {
    expect([...added.get("web-cardr/src/new.ts")!]).toEqual([1, 2]);
  });

  it("returns nothing for an empty diff", () => {
    expect(parseAddedLines("").size).toBe(0);
  });
});

describe("isLintable", () => {
  it("accepts JS and TS sources only", () => {
    expect(isLintable("src/a.ts")).toBe(true);
    expect(isLintable("src/a.tsx")).toBe(true);
    expect(isLintable("scripts/a.mjs")).toBe(true);
    expect(isLintable("scripts/schema.sql")).toBe(false);
    expect(isLintable(".github/workflows/ci.yml")).toBe(false);
  });
});

describe("resolveBase", () => {
  it("skips empty and all-zero shas and falls through to the next candidate", () => {
    expect(resolveBase(["", "0000000000000000000000000000000000000000", "HEAD"], process.cwd()))
      .toBe("HEAD");
  });

  it("fails closed when no candidate is reachable", () => {
    expect(resolveBase(["", "deadbee".repeat(6)], process.cwd())).toBeNull();
  });
});
