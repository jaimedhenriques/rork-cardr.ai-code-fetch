import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind size like "h-4 w-32" or "w-full h-24". */
  className?: string;
  /** Use a circle skeleton (e.g. for avatars). */
  circle?: boolean;
}

/** Premium shimmering skeleton. Replace ad-hoc gray boxes with this. */
export const Skeleton = ({ className, circle, ...props }: SkeletonProps) => (
  <div
    className={cn(
      "skeleton",
      circle ? "rounded-full" : "rounded-lg",
      className,
    )}
    aria-hidden
    {...props}
  />
);

/** Pre-built row skeleton for list pages (avatar + two lines). */
export const SkeletonRow = ({ count = 4 }: { count?: number }) => (
  <div className="space-y-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card-elevated p-3 flex items-center gap-3">
        <Skeleton circle className="w-10 h-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-2.5 w-3/5" />
        </div>
      </div>
    ))}
  </div>
);

/** Pre-built card skeleton for dashboard widgets. */
export const SkeletonCard = ({ lines = 3 }: { lines?: number }) => (
  <div className="card-elevated p-4 space-y-3">
    <Skeleton className="h-4 w-1/3" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
    ))}
  </div>
);

export default Skeleton;
