#!/usr/bin/env node
// Changed-line ESLint gate.
//
// Whole-repo ESLint carries a large known baseline, so CI cannot gate on a
// plain `eslint .`. This script runs the existing ESLint config and fails only
// when a message lands on a line this branch added, which keeps the gate
// meaningful without cleaning unrelated debt.
//
// Dependency-free: only node built-ins and the ESLint binary already installed
// in this package.
//
// Usage:
//   node scripts/lint-changed-lines.mjs --base <sha|ref>
//   CHANGED_LINES_BASE=<sha|ref> node scripts/lint-changed-lines.mjs
//
// Exit codes: 0 clean, 1 lint errors on added lines, 2 unusable base or a
// broken ESLint invocation (fail closed).

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const EMPTY_SHA = "0000000000000000000000000000000000000000";
const LINTABLE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Parse `git diff --unified=0` output into added line numbers per file.
 *
 * Hunk headers look like `@@ -a,b +c,d @@`. A missing `d` means one added
 * line; `d === 0` means the hunk only deletes, so it contributes nothing.
 *
 * @param {string} diffText
 * @returns {Map<string, Set<number>>} post-image path -> added line numbers
 */
export function parseAddedLines(diffText) {
  const added = new Map();
  let current = null;
  for (const line of String(diffText).split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      // `/dev/null` marks a deletion; git prefixes the post-image with `b/`.
      current = target === "/dev/null" ? null : target.replace(/^b\//, "");
      if (current && !added.has(current)) added.set(current, new Set());
      continue;
    }
    if (!current || !line.startsWith("@@")) continue;
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    const lines = added.get(current);
    for (let i = 0; i < count; i += 1) lines.add(start + i);
  }
  // Files that only lost lines carry no added lines and are dropped.
  for (const [file, lines] of added) if (lines.size === 0) added.delete(file);
  return added;
}

/** @param {string} file */
export function isLintable(file) {
  return LINTABLE.has(path.extname(file));
}

function git(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/**
 * First candidate that names a reachable commit. Returns null when none does,
 * which the caller must treat as a hard failure rather than a full-tree lint.
 *
 * @param {(string|undefined|null)[]} candidates
 * @param {string} cwd
 */
export function resolveBase(candidates, cwd) {
  for (const candidate of candidates) {
    const ref = (candidate || "").trim();
    if (!ref || ref === EMPTY_SHA || /^0+$/.test(ref)) continue;
    if (git(["cat-file", "-e", `${ref}^{commit}`], cwd).status === 0) return ref;
  }
  return null;
}

function parseArgs(argv) {
  const args = { base: process.env.CHANGED_LINES_BASE || "" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base") args.base = argv[i + 1] || "";
  }
  return args;
}

function main() {
  const cwd = process.cwd();
  const args = parseArgs(process.argv.slice(2));

  const base = resolveBase([args.base, "HEAD^"], cwd);
  if (!base) {
    console.error(
      "changed-line lint: no usable base commit (checked --base/CHANGED_LINES_BASE and HEAD^). " +
        "Ensure the checkout has history (fetch-depth: 0).",
    );
    process.exit(2);
  }

  const diff = git(["diff", "--unified=0", `${base}...HEAD`], cwd);
  if (diff.status !== 0) {
    console.error(`changed-line lint: git diff against ${base} failed.\n${diff.stderr}`);
    process.exit(2);
  }

  const root = git(["rev-parse", "--show-toplevel"], cwd).stdout.trim();
  const added = parseAddedLines(diff.stdout);

  // git reports repo-root-relative paths; this script lints only the files
  // inside its own package directory.
  const targets = new Map();
  for (const [repoPath, lines] of added) {
    const abs = path.resolve(root, repoPath);
    const rel = path.relative(cwd, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
    if (!isLintable(rel)) continue;
    targets.set(abs, lines);
  }

  if (targets.size === 0) {
    console.log(`changed-line lint: no lintable added lines against ${base}.`);
    process.exit(0);
  }

  const eslintBin = path.join(cwd, "node_modules", ".bin", "eslint");
  const run = spawnSync(eslintBin, ["--format", "json", ...targets.keys()], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error) {
    console.error(`changed-line lint: could not run ESLint at ${eslintBin}: ${run.error.message}`);
    process.exit(2);
  }

  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    // A non-JSON body means ESLint itself failed; never treat that as clean.
    console.error(
      `changed-line lint: ESLint produced no parsable report (exit ${run.status}).\n${run.stderr}`,
    );
    process.exit(2);
  }

  const failures = [];
  let advisory = 0;
  for (const result of report) {
    const lines = targets.get(path.resolve(result.filePath));
    if (!lines) continue;
    for (const message of result.messages || []) {
      // A message without a line is a file-level failure (parse/config error).
      const onAddedLine = message.line === undefined || lines.has(message.line);
      if (!onAddedLine) continue;
      if (message.severity === 2 || message.fatal) {
        failures.push(
          `${path.relative(cwd, result.filePath)}:${message.line ?? "?"}:${message.column ?? "?"}` +
            `  ${message.message}  ${message.ruleId ?? "fatal"}`,
        );
      } else {
        advisory += 1;
      }
    }
  }

  console.log(
    `changed-line lint: base ${base}, ${targets.size} changed file(s), ` +
      `${failures.length} error(s) and ${advisory} warning(s) on added lines.`,
  );
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  process.exit(0);
}

const invokedDirectly =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(fileURLToPath(import.meta.url)).href;

if (invokedDirectly) main();
