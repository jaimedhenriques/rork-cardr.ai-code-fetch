import { ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Compact variant for inline empty states inside cards */
  compact?: boolean;
}

/**
 * Premium empty state — soft halo, restrained type, single primary action.
 * Use everywhere a list/page has no data instead of bespoke "Nothing here" blocks.
 */
const EmptyState = ({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    className={cn(
      "flex flex-col items-center justify-center text-center mx-auto",
      compact ? "py-8 px-6 max-w-xs" : "py-16 px-8 max-w-sm",
      className,
    )}
  >
    {(Icon || illustration) && (
      <div className="relative mb-5">
        {/* Soft ambient halo */}
        <div
          className="absolute inset-0 -m-6 rounded-full blur-2xl opacity-60"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12), transparent 70%)" }}
          aria-hidden
        />
        <div
          className={cn(
            "relative flex items-center justify-center rounded-2xl border border-border/60 bg-card",
            compact ? "w-12 h-12" : "w-16 h-16",
          )}
          style={{ boxShadow: "var(--shadow-md), var(--shadow-ring)" }}
        >
          {illustration ?? (Icon && <Icon size={compact ? 20 : 26} className="text-primary" strokeWidth={1.75} />)}
        </div>
      </div>
    )}
    <h3 className={cn("font-display font-semibold tracking-tight text-foreground", compact ? "text-base" : "text-lg")}>
      {title}
    </h3>
    {description && (
      <p className={cn("mt-1.5 text-muted-foreground leading-relaxed", compact ? "text-xs" : "text-sm")}>
        {description}
      </p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </motion.div>
);

export default EmptyState;
