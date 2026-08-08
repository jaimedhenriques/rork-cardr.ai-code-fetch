import { motion } from "framer-motion";
import { Sparkles, Zap, FileText, Mic, Infinity as InfinityIcon, ChevronRight } from "lucide-react";
import { useSubscription, type PlanLimits } from "@/hooks/useSubscription";
import { useApp } from "@/context/AppContext";
import { isIosNative } from "@/lib/iosCompliance";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  teams: "Teams",
};

const PLAN_ICONS: Record<string, typeof Sparkles> = {
  starter: Sparkles,
  pro: Zap,
  business: Sparkles,
  teams: Sparkles,
};

type MeteredField = "contacts" | "enrichments" | "notes" | "transcriptionMinutes";

const FIELD_META: Record<MeteredField, { label: string; icon: typeof Zap; unit?: string }> = {
  contacts: { label: "Contacts", icon: Sparkles },
  enrichments: { label: "AI Enrichments", icon: Zap },
  notes: { label: "Meeting Notes", icon: FileText },
  transcriptionMinutes: { label: "Transcription", icon: Mic, unit: "min" },
};

/**
 * Shows the current plan tier and remaining usage credits across all
 * metered resources (contacts, enrichments, notes, transcription).
 * Designed for the Settings / profile area to improve plan transparency.
 */
export default function UsageCreditsCard() {
  const { subscription, usage, limits, loading, plan } = useSubscription();
  const { contacts } = useApp();
  const navigate = useNavigate();

  const PlanIcon = PLAN_ICONS[plan] ?? Sparkles;
  const planLabel = PLAN_LABELS[plan] ?? "Starter";
  const isUnlimited = (field: MeteredField) => limits[field] === -1;

  const getUsed = (field: MeteredField): number => {
    switch (field) {
      case "contacts": return contacts.length;
      case "enrichments": return usage.enrichmentsUsed;
      case "notes": return usage.notesCreated;
      case "transcriptionMinutes": return usage.transcriptionMinutesUsed;
    }
  };

  const getRemaining = (field: MeteredField): number => {
    if (isUnlimited(field)) return -1;
    return Math.max(0, limits[field] - getUsed(field));
  };

  const getPercent = (field: MeteredField): number => {
    if (isUnlimited(field)) return 0;
    return Math.min(Math.round((getUsed(field) / limits[field]) * 100), 100);
  };

  const fields: MeteredField[] = ["contacts", "enrichments", "notes", "transcriptionMinutes"];

  const exhaustedCount = fields.filter(f => !isUnlimited(f) && getRemaining(f) === 0).length;
  const lowCount = fields.filter(f => {
    const pct = getPercent(f);
    return pct >= 80 && pct < 100;
  }).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="card-elevated p-4 mb-5"
    >
      {/* Plan tier header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <PlanIcon size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{planLabel} plan</p>
              {plan === "starter" && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Free
                </span>
              )}
              {plan !== "starter" && subscription.cancelAtPeriodEnd && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  Cancelling
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {loading ? "Loading usage…" : (
                limits.lifetime
                  ? "Lifetime limits — reset on upgrade"
                  : "Resets monthly"
              )}
            </p>
          </div>
        </div>
        {!isIosNative() && (
          <button
            onClick={() => navigate("/pricing")}
            className="text-[11px] font-semibold text-primary flex items-center gap-0.5 shrink-0"
          >
            Upgrade <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Usage bars */}
      <div className="space-y-3">
        {fields.map((field) => {
          const meta = FIELD_META[field];
          const Icon = meta.icon;
          const unlimited = isUnlimited(field);
          const used = getUsed(field);
          const limit = limits[field];
          const remaining = getRemaining(field);
          const pct = getPercent(field);
          const isFull = pct >= 100;
          const isNear = pct >= 80 && pct < 100;

          return (
            <div key={field}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground font-medium truncate">
                    {meta.label}
                  </span>
                </div>
                {unlimited ? (
                  <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5 tabular-nums">
                    <InfinityIcon size={12} /> Unlimited
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      isFull ? "text-red-400" : isNear ? "text-amber-400" : "text-muted-foreground",
                    )}
                  >
                    {remaining} left
                    <span className="text-muted-foreground/60 font-normal ml-1">
                      of {limit}{meta.unit ? ` ${meta.unit}` : ""}
                    </span>
                  </span>
                )}
              </div>
              {!unlimited && (
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isFull ? "bg-red-400" : isNear ? "bg-amber-400" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary / status banner */}
      {exhaustedCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <p className="text-[11px] font-medium text-red-500">
            {exhaustedCount} resource{exhaustedCount > 1 ? "s" : ""} exhausted — upgrade to unlock more.
          </p>
        </div>
      )}
      {exhaustedCount === 0 && lowCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <p className="text-[11px] font-medium text-amber-500">
            Approaching limit on {lowCount} resource{lowCount > 1 ? "s" : ""}.
          </p>
        </div>
      )}

      {/* Next reset / billing date */}
      {!limits.lifetime && subscription.currentPeriodEnd && plan !== "starter" && (
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          Usage resets {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      )}
    </motion.div>
  );
}
