import { Crown, Sparkles, Activity, Calendar as CalIcon } from "lucide-react";
import { useSubscription, type PlanType } from "@/hooks/useSubscription";
import { hidePaidSurfaces } from "@/lib/iosCompliance";
import { useAutoRestoreOnOpen } from "@/hooks/useAutoRestoreOnOpen";

/**
 * Read-only plan & usage summary shown in Settings on native iOS/Android.
 *
 * Strictly informational — renders NO purchase links, prices, "Upgrade"
 * buttons, or external URLs. Plan management is handled at cardr.ai
 * (covered by the sibling IosManagePlanNotice card).
 *
 * Renders nothing on web/PWA where the existing usage UI already covers this.
 */
const PLAN_LABEL: Record<PlanType, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  teams: "Teams",
};

const formatLimit = (n: number) => (n === -1 ? "Unlimited" : n.toLocaleString());

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
};

const Row = ({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) => {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone = pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-amber-400" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold text-foreground tabular-nums">
          {used.toLocaleString()} / {formatLimit(limit)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary/80 overflow-hidden">
        <div
          className={`h-full ${tone} transition-all`}
          style={{ width: unlimited ? "100%" : `${pct}%`, opacity: unlimited ? 0.35 : 1 }}
        />
      </div>
    </div>
  );
};

const IosPlanStatusCard = ({ className = "" }: { className?: string }) => {
  // Silently re-sync subscription state when this card mounts on iOS.
  // Throttled internally so repeated Settings opens don't hit the network.
  useAutoRestoreOnOpen(true);

  const { subscription, usage, limits, loading } = useSubscription();
  if (!hidePaidSurfaces()) return null;
  const planLabel = PLAN_LABEL[subscription.plan] ?? "Starter";
  const isPaid = subscription.plan !== "starter";
  const renews = formatDate(subscription.currentPeriodEnd);

  return (
    <div
      className={`rounded-2xl border border-border bg-card/60 p-4 ${className}`}
      role="region"
      aria-label="Current plan and usage"
    >
      {/* Header — plan name + status pill, no CTAs */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isPaid ? "bg-primary/15" : "bg-secondary/80"
            }`}
          >
            {isPaid ? (
              <Crown size={15} className="text-primary" />
            ) : (
              <Sparkles size={15} className="text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Current plan
            </p>
            <p className="text-sm font-display font-bold text-foreground truncate">
              {planLabel}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
            subscription.status === "active"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          <Activity size={10} />
          {subscription.status}
        </span>
      </div>

      {renews && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-4">
          <CalIcon size={11} />
          <span>
            {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} {renews}
          </span>
        </div>
      )}

      {/* Usage rows — purely informational */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-[11px] text-muted-foreground">Loading usage…</p>
        ) : (
          <>
            <Row label="Contacts" used={usage.contactsCount} limit={limits.contacts} />
            <Row label="Enrichments" used={usage.enrichmentsUsed} limit={limits.enrichments} />
            <Row label="Notes" used={usage.notesCreated} limit={limits.notes} />
            <Row
              label="Transcription minutes"
              used={usage.transcriptionMinutesUsed}
              limit={limits.transcriptionMinutes}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default IosPlanStatusCard;
