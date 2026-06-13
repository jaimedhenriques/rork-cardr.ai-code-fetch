import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { hidePaidSurfaces, COMPLIANCE_TITLE, COMPLIANCE_BODY } from "@/lib/iosCompliance";

/**
 * Routes that initiate or advertise an external paid purchase flow.
 * Apple/Google forbid linking to web checkout from inside the app, so on
 * native builds we redirect any of these to the dashboard before render.
 *
 * Match is a startsWith check so dynamic segments (e.g. /ref/abc123) are
 * caught too. Keep this list in sync with src/App.tsx routes.
 */
const BLOCKED_PREFIXES = [
  "/pricing",
  "/ref/",
  "/app/referrals",
  "/app/pricing",
  "/checkout",
  "/upgrade",
];

/** Exact paths to redirect on native (full match only, no prefix). */
const BLOCKED_EXACT = [
  "/", // marketing landing — contains Pricing nav links
  "/landing",
  "/landing-preview",
];

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps the app router. On native, intercepts blocked paths and redirects
 * to the dashboard with a one-shot toast explaining why.
 *
 * Defense-in-depth: page-level useEffect redirects (e.g. in Pricing.tsx) and
 * the runtime guard inside checkout handlers stay in place. This guard
 * stops the page from ever mounting in the first place.
 */
const NativePaywallGuard = ({ children }: Props) => {
  const location = useLocation();
  const blocked =
    hidePaidSurfaces() &&
    (BLOCKED_EXACT.includes(location.pathname) ||
      BLOCKED_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(p)));

  useEffect(() => {
    // Don't toast for the silent landing-page redirect — only for explicit
    // upgrade attempts.
    const isExactBlock = BLOCKED_EXACT.includes(location.pathname);
    if (blocked && !isExactBlock) {
      toast(COMPLIANCE_TITLE, { description: COMPLIANCE_BODY });
    }
  }, [blocked, location.pathname]);

  if (blocked) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default NativePaywallGuard;
