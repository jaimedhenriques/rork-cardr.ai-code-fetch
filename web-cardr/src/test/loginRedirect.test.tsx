import { render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LoginRedirect } from "@/App";

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

const renderRedirect = (entry: string) => {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginRedirect /> },
      { path: "/auth", element: <LocationProbe /> },
    ],
    { initialEntries: [entry] },
  );

  render(<RouterProvider router={router} />);
};

describe("LoginRedirect", () => {
  it.each([
    ["/login", "/auth"],
    ["/login?next=%2Fapp", "/auth?next=%2Fapp"],
    ["/login#section", "/auth#section"],
    [
      "/login?next=%2Fapp&source=legacy#section",
      "/auth?next=%2Fapp&source=legacy#section",
    ],
  ])("redirects %s to %s", (entry, expected) => {
    renderRedirect(entry);
    expect(screen.getByTestId("location")).toHaveTextContent(expected);
  });
});
