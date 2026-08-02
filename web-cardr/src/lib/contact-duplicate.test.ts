import { describe, expect, it } from "vitest";

import {
  buildMergeUpdates,
  findDuplicateContact,
  type ExistingContact,
} from "@/lib/contact-duplicate";

const existing: ExistingContact = {
  id: "c1",
  name: "Dana Reed",
  company: "Acme",
  title: "",
  email: "Dana@Acme.com",
  phone: "+1 415 555 1212",
};

describe("findDuplicateContact", () => {
  it("matches on email regardless of case and surrounding whitespace", () => {
    const match = findDuplicateContact(
      { name: "D. Reed", email: "  dana@acme.com " },
      [existing],
    );
    expect(match?.contact.id).toBe("c1");
    expect(match?.reason).toBe("email");
  });

  it("matches a local NANP number against a stored +1 number", () => {
    const match = findDuplicateContact(
      { name: "D. Reed", email: "other@acme.com", phone: "(415) 555-1212" },
      [existing],
    );
    expect(match?.contact.id).toBe("c1");
    expect(match?.reason).toBe("phone");
  });

  it("returns null for a candidate with no shared email or phone", () => {
    expect(
      findDuplicateContact(
        { name: "Sam Cole", email: "sam@globex.com", phone: "+1 212 555 9000" },
        [existing],
      ),
    ).toBeNull();
  });

  it("ignores blank identifiers so empty candidates never match", () => {
    expect(
      findDuplicateContact({ name: "Sam Cole", email: "", phone: "" }, [
        { ...existing, email: "", phone: "" },
      ]),
    ).toBeNull();
  });

  it("skips the contact being edited when an id is excluded", () => {
    expect(
      findDuplicateContact({ name: "Dana", email: "dana@acme.com" }, [existing], {
        excludeId: "c1",
      }),
    ).toBeNull();
  });
});

describe("buildMergeUpdates", () => {
  it("fills blank fields and leaves populated fields untouched", () => {
    const updates = buildMergeUpdates(existing, {
      name: "Dana R.",
      company: "Globex",
      title: "Head of Ops",
      email: "dana@acme.com",
      phone: "4155551212",
      notes: "Met at the keynote",
    });

    expect(updates.title).toBe("Head of Ops");
    expect(updates.notes).toBe("Met at the keynote");
    expect(updates.name).toBeUndefined();
    expect(updates.company).toBeUndefined();
    expect(updates.email).toBeUndefined();
    expect(updates.phone).toBeUndefined();
  });

  it("applies an explicitly selected stage even when the contact already has one", () => {
    const updates = buildMergeUpdates(
      { ...existing, stageId: "stage-new" },
      { name: "Dana R.", stageId: "stage-qualified" },
    );
    expect(updates.stageId).toBe("stage-qualified");
  });

  it("leaves the stage alone when the buyer selected Unassigned", () => {
    const updates = buildMergeUpdates({ ...existing, stageId: "stage-new" }, {
      name: "Dana R.",
      stageId: "",
    });
    expect(updates.stageId).toBeUndefined();
  });

  it("trims incoming values and ignores whitespace-only ones", () => {
    const updates = buildMergeUpdates(existing, {
      title: "  Head of Ops  ",
      notes: "   ",
    });
    expect(updates.title).toBe("Head of Ops");
    expect(updates.notes).toBeUndefined();
  });
});

describe("findDuplicateContact across alternate phone fields", () => {
  const enriched: ExistingContact = {
    id: "c2",
    name: "Ravi Patel",
    email: "ravi@globex.com",
    mobilePhone: "+1 (312) 555-7788",
    workPhone: "212-555-9000",
  };

  it("matches a candidate primary phone against a saved mobile phone", () => {
    const match = findDuplicateContact(
      { name: "R. Patel", phone: "3125557788" },
      [enriched],
    );
    expect(match?.contact.id).toBe("c2");
    expect(match?.reason).toBe("phone");
  });

  it("matches a candidate primary phone against a saved work phone", () => {
    const match = findDuplicateContact({ name: "R. Patel", phone: "+1 212 555 9000" }, [enriched]);
    expect(match?.contact.id).toBe("c2");
  });

  it("matches a candidate mobile phone against a saved primary phone", () => {
    const match = findDuplicateContact(
      { name: "D. Reed", mobilePhone: "(415) 555-1212" },
      [existing],
    );
    expect(match?.contact.id).toBe("c1");
    expect(match?.reason).toBe("phone");
  });

  it("matches a candidate work phone against a saved mobile phone", () => {
    const match = findDuplicateContact({ name: "R. Patel", workPhone: "312 555 7788" }, [enriched]);
    expect(match?.contact.id).toBe("c2");
  });

  it("still returns null when no phone slot overlaps", () => {
    expect(
      findDuplicateContact(
        { name: "Sam Cole", mobilePhone: "+1 646 555 0000", workPhone: "" },
        [existing, enriched],
      ),
    ).toBeNull();
  });

  it("fills a blank alternate phone field on merge without overwriting a populated one", () => {
    const updates = buildMergeUpdates(
      { id: "c2", name: "Ravi Patel", mobilePhone: "+1 (312) 555-7788" },
      { mobilePhone: "999 999 9999", workPhone: "212-555-9000" },
    );
    expect(updates.mobilePhone).toBeUndefined();
    expect(updates.workPhone).toBe("212-555-9000");
  });
});
