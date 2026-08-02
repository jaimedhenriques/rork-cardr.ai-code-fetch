import { describe, expect, it } from "vitest";

import path from "node:path";

import {
  isLintable,
  parseAddedLines,
  resolveBase,
  selectAddedLineMessages,
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

describe("selectAddedLineMessages", () => {
  const changed = path.resolve("src/changed.ts");
  const untouched = path.resolve("src/untouched.ts");
  const targets = new Map([[changed, new Set([12, 40])]]);
  const report = [
    {
      filePath: changed,
      messages: [
        // Baseline debt on an untouched line: ignored.
        { line: 5, column: 1, severity: 2, message: "Unexpected any", ruleId: "no-explicit-any" },
        // New debt on an added line: fails the gate.
        { line: 12, column: 3, severity: 2, message: "Unexpected any", ruleId: "no-explicit-any" },
        // Warning on an added line: advisory only.
        { line: 40, column: 1, severity: 1, message: "Fast refresh", ruleId: "react-refresh" },
      ],
    },
    {
      filePath: untouched,
      messages: [{ line: 1, column: 1, severity: 2, message: "Unexpected any", ruleId: "no-explicit-any" }],
    },
  ];

  it("fails only on errors that land on added lines", () => {
    const { failures, advisory } = selectAddedLineMessages(report, targets);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(":12:3");
    expect(failures[0]).toContain("no-explicit-any");
    expect(advisory).toBe(1);
  });

  it("ignores files with no added lines", () => {
    const { failures } = selectAddedLineMessages(report, targets);
    expect(failures.some((entry) => entry.includes("untouched"))).toBe(false);
  });

  it("fails a file-level message that carries no line", () => {
    const fatal = [
      { filePath: changed, messages: [{ severity: 2, fatal: true, message: "Parsing error", ruleId: null }] },
    ];
    const { failures } = selectAddedLineMessages(fatal, targets);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("Parsing error");
  });

  it("passes a clean report", () => {
    expect(selectAddedLineMessages([{ filePath: changed, messages: [] }], targets).failures).toEqual([]);
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
