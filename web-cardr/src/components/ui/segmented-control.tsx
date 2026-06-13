import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; badge?: number | string }[];
  className?: string;
}

/**
 * Apple-style segmented control with animated selection indicator.
 * Uses framer-motion's layoutId for the smooth pill slide.
 */
function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("segmented-track", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 text-xs font-semibold py-2 rounded-lg transition-colors duration-200 z-10",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {active && (
              <motion.div
                layoutId="segmented-indicator"
                className="absolute inset-0 bg-card rounded-lg shadow-ios-sm border border-border/40"
                transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
              />
            )}
            <span className="relative inline-flex items-center justify-center gap-1.5">
              {opt.label}
              {opt.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-[9px] font-bold text-primary tabular-nums">
                  {opt.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
