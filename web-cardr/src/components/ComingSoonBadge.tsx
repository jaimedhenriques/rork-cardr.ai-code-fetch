import { ReactNode, MouseEvent } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FeatureKey,
  notifyComingSoon,
  useFeatureFlag,
} from "@/lib/featureFlags";

/** Small pill used inline next to feature labels. */
export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10",
        "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary",
        className,
      )}
    >
      <Sparkles size={10} />
      Coming soon
    </span>
  );
}

type Variant = "overlay" | "inline" | "menuItem";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  variant?: Variant;
  className?: string;
  /**
   * If true, render nothing instead of a disabled UI when the feature is off.
   * Default: false (show with badge).
   */
  hideWhenDisabled?: boolean;
}

/**
 * Wraps an entry point. When the feature is disabled on the current platform:
 *   - dims its children
 *   - blocks pointer events from reaching them
 *   - on tap, fires a "Coming soon" toast with the configured reason
 */
export function FeatureGate({
  feature,
  children,
  variant = "overlay",
  className,
  hideWhenDisabled = false,
}: FeatureGateProps) {
  const { enabled, reason } = useFeatureFlag(feature);

  if (enabled) return <>{children}</>;
  if (hideWhenDisabled) return null;

  const handleBlock = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    notifyComingSoon(reason);
  };

  if (variant === "inline") {
    return (
      <span
        className={cn("inline-flex items-center gap-2", className)}
        onClickCapture={handleBlock}
        aria-disabled
      >
        <span className="opacity-60 pointer-events-none">{children}</span>
        <ComingSoonBadge />
      </span>
    );
  }

  if (variant === "menuItem") {
    return (
      <div
        role="button"
        aria-disabled
        onClick={handleBlock}
        className={cn(
          "flex items-center justify-between gap-2 cursor-not-allowed",
          className,
        )}
      >
        <span className="opacity-60 pointer-events-none flex-1">{children}</span>
        <ComingSoonBadge />
      </div>
    );
  }

  // overlay (default)
  return (
    <div
      className={cn("relative", className)}
      onClickCapture={handleBlock}
      aria-disabled
    >
      <div className="opacity-60 pointer-events-none select-none">{children}</div>
      <div className="absolute top-2 right-2 z-10">
        <ComingSoonBadge />
      </div>
    </div>
  );
}
