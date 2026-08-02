import { describe, expect, it } from "vitest";

import { buildContactInsert } from "@/lib/contact-insert";

const base = {
  id: "local-1",
  name: "Dana Reed",
  company: "Acme",
  title: "Head of Ops",
  email: "dana@acme.com",
  phone: "4155551212",
  scannedAt: "2026-08-02T00:00:00.000Z",
};

describe("buildContactInsert", () => {
  it("maps the selected pipeline stage to stage_id", () => {
    const row = buildContactInsert("user-1", { ...base, stageId: "stage-qualified" });
    expect(row.stage_id).toBe("stage-qualified");
    expect(row.user_id).toBe("user-1");
  });

  it("sends a null stage_id when the contact is unassigned", () => {
    expect(buildContactInsert("user-1", base).stage_id).toBeNull();
    expect(buildContactInsert("user-1", { ...base, stageId: "" }).stage_id).toBeNull();
  });

  it("keeps the existing folder and enrichment mapping", () => {
    const row = buildContactInsert("user-1", {
      ...base,
      folderId: "folder-9",
      companySize: "51-200",
      enriched: true,
      enrichedAt: "2026-08-02T01:00:00.000Z",
    });
    expect(row.folder_id).toBe("folder-9");
    expect(row.company_size).toBe("51-200");
    expect(row.enriched).toBe(true);
    expect(row.enriched_at).toBe("2026-08-02T01:00:00.000Z");
    expect(row.scanned_at).toBe(base.scannedAt);
  });
});
