/**
 * Tests for the typed Supabase preview-query helpers used by
 * ExportSchedulesPanel. We mock `@/integrations/supabase/client` so the
 * helpers run in jsdom without a network, and we render a small ad-hoc
 * consumer component that mirrors the panel's success / empty / error
 * branches. This keeps the test focused on the contract (rows in →
 * rows rendered) without dragging the whole 2k-line panel into jsdom.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";

// ── Mock the Supabase client BEFORE importing the helpers ────────────────
const limitMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  // Build a chainable thenable: every filter method returns the same
  // builder, and `await`-ing it resolves with whatever `limit()` was
  // configured to return for this test.
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const passthrough = () => builder;
    for (const m of ["eq", "in", "gte", "lte", "or", "order"]) {
      builder[m] = passthrough;
    }
    builder.limit = (...args: unknown[]) => limitMock(...args);
    return builder;
  };

  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => makeBuilder()),
      })),
    },
  };
});

import { buildPreviewSampleQuery, type PreviewRow } from "./exportPreviewQuery";

// ── Minimal consumer that mirrors the panel's render branches ────────────
function PreviewProbe({ columns }: { columns: string[] }) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = buildPreviewSampleQuery(columns, "user-1").limit(10);
        const res = await q;
        if (cancelled) return;
        if (res.error) {
          setError(res.error.message);
        } else {
          setRows(res.data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [columns]);

  if (loading) return <div>Loading preview…</div>;
  if (error) return <div role="alert">Couldn't load preview: {error}</div>;
  if (rows.length === 0) return <div>No contacts match the current filters.</div>;
  return (
    <table>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} data-testid="preview-row">
            {columns.map((c) => (
              <td key={c} data-testid={`cell-${c}`}>{String(r[c] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe("Supabase CSV preview helper", () => {
  beforeEach(() => {
    limitMock.mockReset();
  });

  it("renders rows from a successful select", async () => {
    limitMock.mockResolvedValueOnce({
      data: [
        { id: "1", name: "Ada Lovelace", email: "ada@example.com" },
        { id: "2", name: "Alan Turing", email: "alan@example.com" },
      ],
      error: null,
      count: 2,
    });

    render(<PreviewProbe columns={["name", "email"]} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("preview-row")).toHaveLength(2);
    });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("alan@example.com")).toBeInTheDocument();
  });

  it("shows the empty state when the select returns no rows", async () => {
    limitMock.mockResolvedValueOnce({ data: [], error: null, count: 0 });

    render(<PreviewProbe columns={["name", "email"]} />);

    await waitFor(() => {
      expect(
        screen.getByText("No contacts match the current filters."),
      ).toBeInTheDocument();
    });
    expect(screen.queryAllByTestId("preview-row")).toHaveLength(0);
  });

  it("surfaces the Supabase error message inline", async () => {
    limitMock.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied for table contacts" },
      count: null,
    });

    render(<PreviewProbe columns={["name"]} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("permission denied for table contacts");
    expect(screen.queryAllByTestId("preview-row")).toHaveLength(0);
  });
});
