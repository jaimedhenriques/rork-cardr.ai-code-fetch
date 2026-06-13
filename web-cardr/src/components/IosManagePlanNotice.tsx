import { Globe } from "lucide-react";
import { COMPLIANCE_TITLE, COMPLIANCE_BODY, COMPLIANCE_DOMAIN } from "@/lib/iosCompliance";

/**
 * Non-interactive Apple-compliant notice shown on native iOS/Android in place
 * of any Stripe / upgrade CTA. Intentionally renders no <a>, <button>, or
 * onClick — Apple forbids external purchase prompts inside iOS apps.
 */
const IosManagePlanNotice = ({
  className = "",
  compact = false,
}: {
  className?: string;
  /** Inline pill variant for tight slots (header/CTA replacements). */
  compact?: boolean;
}) => {
  if (compact) {
    return (
      <span
        role="note"
        aria-label="Plan management info"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 border border-border/60 text-[10px] font-semibold text-muted-foreground select-none ${className}`}
      >
        <Globe size={11} className="text-primary" />
        <span>Manage at {COMPLIANCE_DOMAIN}</span>
      </span>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-5 ${className}`}
      role="note"
      aria-label="Plan management info"
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Globe size={14} className="text-primary" />
        </div>
        <p className="text-sm font-display font-bold text-foreground leading-tight">
          {COMPLIANCE_TITLE}
        </p>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        {COMPLIANCE_BODY}
      </p>

      <div
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 border border-border/60"
        aria-label={`Visit ${COMPLIANCE_DOMAIN} in your browser`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Visit
        </span>
        <span className="text-xs font-semibold text-foreground select-all">
          {COMPLIANCE_DOMAIN}
        </span>
      </div>
    </div>
  );
};

export default IosManagePlanNotice;
