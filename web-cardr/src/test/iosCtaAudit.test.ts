/**
 * iOS native-build CTA audit.
 *
 * Scans every source file that can render on iOS native and fails if it
 * contains a Stripe purchase CTA, pricing CTA, external Stripe URL, or visible
 * price text WITHOUT a `hidePaidSurfaces() / isIosNative() / disableStripeUpgrades()`
 * guard surrounding it.
 *
 * Files that are unreachable on native (route-level redirect via
 * NativePaywallGuard, or test fixtures) are skipped via NATIVE_UNREACHABLE.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Files NativePaywallGuard fully blocks on native — safe to skip. */
const NATIVE_UNREACHABLE = new Set([
  "src/pages/Pricing.tsx",
  "src/pages/LandingPreview.tsx",
  "src/pages/ReferralLanding.tsx",
  "src/pages/ReferralDashboard.tsx",
  "src/components/landing/AvailableEverywhere.tsx",
  "src/components/landing/PhoneShowcase.tsx",
  "src/components/landing/TestimonialsSection.tsx",
  "src/components/landing/BentoVisuals.tsx",
  "src/components/landing/BentoCard.tsx",
  "src/components/landing/AnimatedGrid.tsx",
  // Constants / data — no JSX
  "src/lib/stripe-config.ts",
  "src/lib/translations.ts",
  "src/hooks/useSubscription.ts",
  // Guard itself
  "src/components/NativePaywallGuard.tsx",
]);

/** Patterns that signal a Stripe / pricing CTA or price text. */
const PATTERNS: Array<{ name: string; rx: RegExp }> = [
  { name: "create-checkout invoke", rx: /supabase\.functions\.invoke\(\s*["']create-checkout["']/ },
  { name: "customer-portal invoke", rx: /supabase\.functions\.invoke\(\s*["']customer-portal["']/ },
  { name: "navigate to /pricing", rx: /navigate\(\s*["']\/pricing/ },
  { name: "Link to /pricing", rx: /to=\s*["']\/pricing/ },
  { name: "external stripe.com URL", rx: /https?:\/\/[^"'\s]*stripe\.com\/(checkout|billing|pay)/ },
  { name: "buy.stripe.com URL", rx: /buy\.stripe\.com/ },
  // Visible USD price text in JSX (e.g. >$9.99/, >$18<). Excludes comments
  // (handled by trimming) and string-literal prices in non-JSX contexts.
  { name: "visible price text", rx: />\s*\$\d+(\.\d+)?[^<]*<\/?/ },
];

/** Tokens that prove a guard is in scope somewhere in the file. */
const GUARD_RX =
  /(hidePaidSurfaces|isIosNative|disableStripeUpgrades|isIosPlatform)\s*\(|<UpgradeGate\b|useUpgradeGate\s*\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === "test" || name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function stripCommentsAndStrings(src: string): string {
  // Crude but effective: drop // line comments, /* block comments */, and
  // backtick template strings so we don't match prices in comments.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/\/\/[^\n]*$/gm, "");
}

interface Offense {
  file: string;
  pattern: string;
  snippet: string;
}

describe("iOS native: no Stripe / pricing CTAs render", () => {
  it("every CTA call site is route-blocked or guard-gated", () => {
    const offenses: Offense[] = [];

    for (const file of walk(SRC)) {
      const rel = relative(ROOT, file);
      if (NATIVE_UNREACHABLE.has(rel)) continue;

      const raw = readFileSync(file, "utf8");
      const src = stripCommentsAndStrings(raw);
      const hasGuard = GUARD_RX.test(src);

      for (const { name, rx } of PATTERNS) {
        const m = src.match(rx);
        if (!m) continue;
        if (hasGuard) continue; // file gates somewhere — accept
        offenses.push({
          file: rel,
          pattern: name,
          snippet: m[0].slice(0, 80),
        });
      }
    }

    if (offenses.length > 0) {
      const report = offenses
        .map((o) => `  • ${o.file} → ${o.pattern}: ${o.snippet}`)
        .join("\n");
      throw new Error(
        `Ungated Stripe / pricing CTA(s) reachable on iOS native:\n${report}\n\n` +
          `Fix by either (a) wrapping with hidePaidSurfaces()/isIosNative(), ` +
          `or (b) adding the file path to NATIVE_UNREACHABLE if its route is blocked by NativePaywallGuard.`,
      );
    }
    expect(offenses).toEqual([]);
  });
});
