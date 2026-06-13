import { ReactNode } from "react";
import { hidePaidSurfaces } from "@/lib/iosCompliance";
import IosManagePlanNotice from "@/components/IosManagePlanNotice";

/**
 * Single source of truth for upgrade-CTA visibility across the app.
 *
 * Wrap ANY new upgrade UI (buttons, banners, pricing cards, billing modals,
 * referral incentives, “View Plans” links, etc.) in <UpgradeGate>…</UpgradeGate>.
 * On native iOS/Android builds the children are hidden automatically so we stay
 * App Store / Play Store compliant — no per-call-site `if (isIosNative())`
 * checks needed.
 *
 * Replacement options on native:
 *   - default: render nothing
 *   - `fallback="notice"` → full IosManagePlanNotice card
 *   - `fallback="compact"` → inline “Manage at cardr.ai” pill
 *   - `fallback={<custom/>}` → arbitrary node
 *
 * Rule of thumb: if a future PR adds a new “Upgrade” surface, the ONLY
 * compliance work required is wrapping it in <UpgradeGate>.
 */
export type UpgradeGateFallback = "none" | "notice" | "compact" | ReactNode;

interface UpgradeGateProps {
  children: ReactNode;
  /** What to render in place of children on native. Defaults to "none". */
  fallback?: UpgradeGateFallback;
  /** Optional className applied to the wrapper element. */
  className?: string;
  /**
   * Force-render on native (escape hatch for dev/test). Production code
   * should never set this — it exists so audit tests can render gated UI.
   */
  forceShow?: boolean;
}

const renderFallback = (
  fallback: UpgradeGateFallback,
  className?: string,
): ReactNode => {
  if (fallback === "none" || fallback === undefined) return null;
  if (fallback === "notice") return <IosManagePlanNotice className={className} />;
  if (fallback === "compact") return <IosManagePlanNotice compact className={className} />;
  return fallback;
};

const UpgradeGate = ({
  children,
  fallback = "none",
  className,
  forceShow = false,
}: UpgradeGateProps) => {
  if (!forceShow && hidePaidSurfaces()) {
    return <>{renderFallback(fallback, className)}</>;
  }
  return <>{children}</>;
};

export default UpgradeGate;

/**
 * Hook variant for cases where wrapping JSX isn't ergonomic
 * (e.g. building option arrays, conditional toolbar items).
 *
 *   const { showUpgrade } = useUpgradeGate();
 *   if (showUpgrade) actions.push({ label: "Upgrade", … });
 */
export const useUpgradeGate = () => ({
  showUpgrade: !hidePaidSurfaces(),
  hidden: hidePaidSurfaces(),
});
