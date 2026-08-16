// CARDR-ROUTE-NORMALIZATION-CANONICAL-20260809
import { render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LegacyFlatRedirect } from "@/App";
import { getLegacyFlatRedirectTarget } from "@/lib/route-normalization";

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
};

const CatchAllWithProbe = () => (
  <>
    <LocationProbe />
    <LegacyFlatRedirect />
  </>
);

const renderLegacyCatchAll = (entry: string) => {
  const router = createMemoryRouter(
    [{ path: "*", element: <CatchAllWithProbe /> }],
    { initialEntries: [entry] },
  );

  render(<RouterProvider router={router} />);
};

describe("getLegacyFlatRedirectTarget", () => {
  it("maps an unknown flat path into the app namespace once", () => {
    expect(getLegacyFlatRedirectTarget("/campaigns", "", "")).toBe(
      "/app/campaigns",
    );
  });

  it("preserves the query string and fragment", () => {
    expect(
      getLegacyFlatRedirectTarget(
        "/campaigns",
        "?status=active",
        "#overview",
      ),
    ).toBe("/app/campaigns?status=active#overview");
  });

  it("does not remap an unknown path already in the app namespace", () => {
    expect(getLegacyFlatRedirectTarget("/app/campaigns", "", "")).toBeNull();
  });

  it("does not grow an already-prefixed unknown app path", () => {
    expect(
      getLegacyFlatRedirectTarget("/app/unknown-route", "", ""),
    ).toBeNull();
  });
});

describe("LegacyFlatRedirect", () => {
  it("settles /campaigns once at /app/campaigns without path growth", () => {
    renderLegacyCatchAll("/campaigns?status=active#overview");

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/app/campaigns?status=active#overview",
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("/app/app/");
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("keeps an unknown /app path stable and renders 404", () => {
    renderLegacyCatchAll("/app/unknown-route");

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/app/unknown-route",
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("/app/app/");
    expect(screen.getByText("404")).toBeInTheDocument();
  });
});
