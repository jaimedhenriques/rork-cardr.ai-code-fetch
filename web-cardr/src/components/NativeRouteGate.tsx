// Wraps a route on native (iOS/Android) builds. When the given feature flag
// is disabled, renders a clean "Coming soon" screen instead of the actual
// route — keeps App Store review-safe by never exposing half-built screens.
//
// On web, always renders children.
import { ReactNode } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { FeatureKey, useFeatureFlag } from "@/lib/featureFlags";

interface Props {
  feature: FeatureKey;
  title: string;
  children: ReactNode;
}

const NativeRouteGate = ({ feature, title, children }: Props) => {
  const { enabled, reason } = useFeatureFlag(feature);
  if (enabled) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-5 pt-8">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <div className="text-center mt-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-accent/15 ring-1 ring-primary/20">
            <Sparkles size={32} className="text-primary" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Coming soon
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {reason ??
              "This feature is in active development for the mobile app and will arrive in a future update."}
          </p>
          <p className="mt-6 text-xs text-muted-foreground">
            Already available on the web at{" "}
            <span className="font-semibold text-foreground">cardr.ai</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NativeRouteGate;
