import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addContact = vi.fn();
const updateContact = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

interface TestContact {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  scannedAt: string;
  notes?: string;
  stageId?: string;
}

let contacts: TestContact[] = [];

vi.mock("@/context/AppContext", () => ({
  useApp: () => ({
    addContact,
    updateContact,
    folders: [],
    canAddContact: true,
    contacts,
    contactLimit: 50,
    isGuest: true,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

vi.mock("@/lib/icypeas", () => ({
  enrichContactViaIcypeas: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/components/UpgradePrompt", () => ({ default: () => null }));
vi.mock("@/components/LinkedInConnectModal", () => ({ default: () => null }));

import AddContactModal from "@/components/AddContactModal";

const STAGES = [
  { id: "stage-new", name: "New", color: "#6366f1", sort_order: 0 },
  { id: "stage-qualified", name: "Qualified", color: "#3b82f6", sort_order: 2 },
];

const EXISTING: TestContact = {
  id: "c1",
  name: "Dana Reed",
  company: "Acme",
  title: "",
  email: "Dana@Acme.com",
  phone: "+1 415 555 1212",
  scannedAt: "2026-07-01T00:00:00.000Z",
};

const onClose = vi.fn();

const openManualTab = () => {
  render(<AddContactModal open onClose={onClose} stages={STAGES} />);
  fireEvent.click(screen.getByText("Manual Entry"));
};

const fill = (placeholder: string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value },
  });

// `company` and `title` are the only inputs rendered without a placeholder,
// in that order.
const fillUnlabelled = (index: 0 | 1, value: string) =>
  fireEvent.change(screen.getAllByPlaceholderText("")[index], {
    target: { value },
  });

const selectStage = (stageId: string) =>
  fireEvent.change(screen.getByTestId("stage-select"), {
    target: { value: stageId },
  });

const save = () => fireEvent.click(screen.getByRole("button", { name: /save contact/i }));

beforeEach(() => {
  vi.clearAllMocks();
  contacts = [];
  addContact.mockResolvedValue({ id: "server-1", name: "Saved" });
  updateContact.mockResolvedValue(true);
});

describe("AddContactModal duplicate gate", () => {
  it("stops a matching-email capture before insertion", async () => {
    contacts = [EXISTING];
    openManualTab();
    fill("John Doe", "Dana Reed");
    fill("john@company.com", "dana@acme.com");
    save();

    expect(await screen.findByTestId("duplicate-decision")).toBeInTheDocument();
    expect(addContact).not.toHaveBeenCalled();
  });

  it("stops a capture whose phone normalizes to an existing number", async () => {
    contacts = [EXISTING];
    openManualTab();
    fill("John Doe", "D. Reed");
    fill("john@company.com", "d.reed@other.com");
    fill("+1 555 0123", "(415) 555-1212");
    save();

    expect(await screen.findByTestId("duplicate-decision")).toBeInTheDocument();
    expect(addContact).not.toHaveBeenCalled();
  });

  it("merges into the existing contact, filling only blanks and applying the chosen stage", async () => {
    contacts = [EXISTING];
    openManualTab();
    fill("John Doe", "Dana R.");
    fillUnlabelled(0, "Globex");
    fillUnlabelled(1, "Head of Ops");
    fill("john@company.com", "dana@acme.com");
    selectStage("stage-qualified");
    save();

    await screen.findByTestId("duplicate-decision");
    fireEvent.click(screen.getByRole("button", { name: /merge into existing/i }));

    await waitFor(() => expect(updateContact).toHaveBeenCalledTimes(1));
    const [id, updates] = updateContact.mock.calls[0];
    expect(id).toBe("c1");
    expect(updates.stageId).toBe("stage-qualified");
    // Existing contact has a blank title, so the merge fills it.
    expect(updates.title).toBe("Head of Ops");
    // Existing name/company/email are already populated and must survive.
    expect(updates.name).toBeUndefined();
    expect(updates.company).toBeUndefined();
    expect(updates.email).toBeUndefined();
    expect(addContact).not.toHaveBeenCalled();
    // A merge that the store accepted must still report success and close.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("keeps the modal open and reports the failure when the merge write is rejected", async () => {
    updateContact.mockResolvedValue(false);
    contacts = [EXISTING];
    openManualTab();
    fill("John Doe", "Dana R.");
    fill("john@company.com", "dana@acme.com");
    save();

    await screen.findByTestId("duplicate-decision");
    fireEvent.click(screen.getByRole("button", { name: /merge into existing/i }));

    await waitFor(() => expect(updateContact).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // The buyer keeps the decision in front of them and can retry.
    expect(screen.getByTestId("duplicate-decision")).toBeInTheDocument();
  });

  it("saves separately when the buyer rejects the merge", async () => {
    contacts = [EXISTING];
    openManualTab();
    fill("John Doe", "Dana Reed");
    fill("john@company.com", "dana@acme.com");
    save();

    await screen.findByTestId("duplicate-decision");
    fireEvent.click(screen.getByRole("button", { name: /save separately/i }));

    await waitFor(() => expect(addContact).toHaveBeenCalledTimes(1));
    expect(updateContact).not.toHaveBeenCalled();
  });
});

describe("AddContactModal pipeline stage", () => {
  it("saves a unique contact once with the selected stage", async () => {
    openManualTab();
    fill("John Doe", "Sam Cole");
    fill("john@company.com", "sam@globex.com");
    selectStage("stage-qualified");
    save();

    await waitFor(() => expect(addContact).toHaveBeenCalledTimes(1));
    expect(addContact.mock.calls[0][0]).toMatchObject({
      name: "Sam Cole",
      email: "sam@globex.com",
      stageId: "stage-qualified",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("defaults to Unassigned and sends no stage when none is picked", async () => {
    openManualTab();
    fill("John Doe", "Sam Cole");
    save();

    await waitFor(() => expect(addContact).toHaveBeenCalledTimes(1));
    expect(addContact.mock.calls[0][0].stageId).toBeUndefined();
    expect((screen.getByTestId("stage-select") as HTMLSelectElement).value).toBe("");
  });
});

describe("AddContactModal persistence result", () => {
  it("does not report success or close when the insert fails", async () => {
    addContact.mockResolvedValue(null);
    openManualTab();
    fill("John Doe", "Sam Cole");
    save();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
