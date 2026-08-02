import { describe, expect, it } from "vitest";

import { contactWriteSucceeded } from "@/lib/contact-update";

describe("contactWriteSucceeded", () => {
  it("accepts a clean Supabase result", () => {
    expect(contactWriteSucceeded({ error: null })).toBe(true);
    expect(contactWriteSucceeded({})).toBe(true);
  });

  it("rejects a Supabase result carrying an error", () => {
    expect(
      contactWriteSucceeded({ error: { message: "duplicate key value" } }),
    ).toBe(false);
    expect(contactWriteSucceeded({ error: new Error("network") })).toBe(false);
  });

  it("rejects a missing result", () => {
    expect(contactWriteSucceeded(null)).toBe(false);
    expect(contactWriteSucceeded(undefined)).toBe(false);
  });
});
