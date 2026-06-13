/**
 * Native-build compliance scan.
 *
 * Apple/Google forbid linking out to an external purchase flow from the app.
 * This test fails the build if any source file invokes the Stripe checkout
 * or billing-portal edge functions WITHOUT a `hidePaidSurfaces()` guard in
 * the same file.
 *
 * Allow-list: files whose entire purpose is web-only (the function name
 * itself is fine; the call site is what we gate).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SRC = join(process.cwd(), "src");
// Edge functions that initiate or manage a paid purchase.
const PURCHASE_CALLS = [
  /supabase\.functions\.invoke\(\s*["']create-checkout["']/,
  /supabase\.functions\.invoke\(\s*["']customer-portal["']/,
];
const GUARD = /hidePaidSurfaces\s*\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === "test" || name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe("iOS/Android purchase compliance", () => {
  it("every Stripe checkout / portal call site is gated by hidePaidSurfaces()", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = readFileSync(file, "utf8");
      const hasPurchaseCall = PURCHASE_CALLS.some((rx) => rx.test(src));
      if (hasPurchaseCall && !GUARD.test(src)) {
        offenders.push(file.replace(process.cwd() + "/", ""));
      }
    }
    expect(offenders, `Ungated purchase calls found in:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});
