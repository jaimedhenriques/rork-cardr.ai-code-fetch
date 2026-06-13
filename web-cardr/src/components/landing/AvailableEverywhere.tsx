import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Monitor,
  Globe,
  Download,
  ArrowRight,
  Check,
  Bell,
} from "lucide-react";
import { Link } from "react-router-dom";
import WaitlistDialog, { type WaitlistPlatform } from "@/components/WaitlistDialog";

// Official Apple logo (NOT the lucide apple-fruit icon).
// Inline SVG to keep the marketing badge consistent with App Store guidelines.
const AppleLogo = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M17.05 12.04c-.03-2.97 2.43-4.4 2.54-4.47-1.39-2.03-3.55-2.31-4.31-2.34-1.83-.19-3.59 1.08-4.52 1.08-.94 0-2.38-1.05-3.92-1.02-2.01.03-3.88 1.18-4.92 2.98-2.1 3.64-.54 9.02 1.51 11.97 1 1.45 2.18 3.06 3.72 3 1.51-.06 2.08-.97 3.9-.97 1.82 0 2.34.97 3.93.94 1.63-.03 2.66-1.45 3.65-2.91 1.15-1.67 1.62-3.28 1.65-3.36-.04-.02-3.17-1.22-3.21-4.84zM14.08 3.45c.83-1 1.39-2.4 1.23-3.78-1.19.05-2.63.79-3.49 1.79-.77.89-1.44 2.31-1.26 3.66 1.33.1 2.69-.67 3.52-1.67z" />
  </svg>
);

type PlatformId = "ios" | "android" | "mac" | "windows" | "web";

interface PlatformDef {
  id: PlatformId;
  label: string;
  sub: string;
  icon: React.ComponentType<any>;
  href: string;
  cta: string;
  external: boolean;
  comingSoon?: boolean;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "ios",
    label: "iOS",
    sub: "iPhone & iPad",
    icon: AppleLogo,
    href: "#",
    cta: "Coming soon",
    external: false,
    comingSoon: true,
  },
  {
    id: "android",
    label: "Android",
    sub: "Phones & tablets",
    icon: Smartphone,
    href: "#",
    cta: "Coming soon",
    external: false,
    comingSoon: true,
  },
  {
    id: "mac",
    label: "macOS",
    sub: "Apple Silicon & Intel",
    icon: Monitor,
    href: "#",
    cta: "Coming soon",
    external: false,
    comingSoon: true,
  },
  {
    id: "windows",
    label: "Windows",
    sub: "Windows 10 & 11",
    icon: Monitor,
    href: "#",
    cta: "Coming soon",
    external: false,
    comingSoon: true,
  },
  {
    id: "web",
    label: "Web",
    sub: "Any modern browser",
    icon: Globe,
    href: "/auth",
    cta: "Open web app",
    external: false,
  },
];


const detectPlatform = (): PlatformId => {
  if (typeof window === "undefined") return "web";
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) return "mac";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  return "web";
};

const AvailableEverywhere = () => {
  const [detected, setDetected] = useState<PlatformId>("web");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistPlatform, setWaitlistPlatform] = useState<WaitlistPlatform | null>(null);

  useEffect(() => {
    setDetected(detectPlatform());
  }, []);

  const openWaitlist = (id: WaitlistPlatform) => {
    setWaitlistPlatform(id);
    setWaitlistOpen(true);
  };

  const WEB = PLATFORMS[4];
  const detectedPlatform = useMemo(
    () => PLATFORMS.find((p) => p.id === detected) ?? WEB,
    [detected],
  );
  // If the detected platform isn't shipped yet, primary CTA falls back to web.
  const primary = detectedPlatform.comingSoon ? WEB : detectedPlatform;

  const PrimaryIcon = primary.icon;


  return (
    <section
      id="everywhere"
      aria-labelledby="everywhere-title"
      className="relative overflow-hidden border-t border-border/50 bg-background py-24"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.10), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Available everywhere
          </p>
          <h2
            id="everywhere-title"
            className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl"
          >
            One account.{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Every device.
            </span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Today, Cardr runs on the web — on any modern browser, phone or desktop. Native iOS,
            Android, macOS and Windows apps are on the way.
          </p>
        </div>

        {/* Auto-detect primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-10 flex max-w-2xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center"
        >
          <a
            href={primary.href}
            {...(primary.external ? { rel: "noopener noreferrer" } : {})}
            className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-primary to-accent px-6 py-4 text-base font-semibold text-primary-foreground shadow-[0_18px_50px_-12px_hsl(var(--primary)/0.55)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_60px_-12px_hsl(var(--primary)/0.7)]"
            aria-label={`Open Cardr on the web${detectedPlatform.comingSoon ? ` — ${detectedPlatform.label} app coming soon` : ""}`}
          >
            <PrimaryIcon size={22} className="opacity-95" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-85">
                {detectedPlatform.comingSoon
                  ? `${detectedPlatform.label} app coming soon`
                  : `We detected ${primary.label}`}
              </span>
              <span>Get Cardr · {primary.cta}</span>
            </span>
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
          {detectedPlatform.comingSoon && (
            <button
              type="button"
              onClick={() => openWaitlist(detectedPlatform.id as WaitlistPlatform)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <Bell size={16} /> Notify me when {detectedPlatform.label} launches
            </button>
          )}
        </motion.div>


        {/* Platform grid */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PLATFORMS.map((p, i) => {
            const Icon = p.icon;
            const isDetected = p.id === detected;
            const isComingSoon = !!p.comingSoon;
            const Tag: any = isComingSoon ? motion.button : motion.a;
            const linkProps = isComingSoon
              ? {
                  type: "button",
                  onClick: () => openWaitlist(p.id as WaitlistPlatform),
                  "aria-label": `Join the ${p.label} waitlist`,
                }
              : {
                  href: p.href,
                  ...(p.external ? { rel: "noopener noreferrer" } : {}),
                  "aria-label": `Get Cardr for ${p.label}`,
                };
            return (
              <Tag
                key={p.id}
                {...linkProps}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.5,
                  delay: 0.05 * i,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                  isComingSoon
                    ? "cursor-pointer border-dashed border-border/70 bg-muted/20 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.04]"
                    : "hover:-translate-y-0.5 " +
                      (isDetected
                        ? "border-primary/40 bg-primary/[0.06] shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.4)]"
                        : "border-border bg-card/60 hover:border-border/80 hover:bg-card")
                }`}
              >
                {isComingSoon ? (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-border">
                    Coming soon
                  </span>
                ) : isDetected ? (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/30">
                    <Check size={10} strokeWidth={3} /> You
                  </span>
                ) : null}

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                    isComingSoon
                      ? "border-border bg-background/40 text-muted-foreground"
                      : isDetected
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-background/60 text-foreground/80 group-hover:text-foreground"
                  }`}
                >
                  <Icon size={20} />
                </div>

                <div className="flex flex-col">
                  <span className={`text-base font-semibold ${isComingSoon ? "text-muted-foreground" : "text-foreground"}`}>{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.sub}</span>
                </div>

                <span
                  className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                    isComingSoon
                      ? "text-muted-foreground"
                      : isDetected
                        ? "text-primary"
                        : "text-foreground/70 group-hover:text-foreground"
                  }`}
                >
                  {isComingSoon ? <Bell size={12} /> : <Download size={12} />}{" "}
                  {isComingSoon ? "Join waitlist" : p.cta}
                </span>
              </Tag>
            );
          })}

        </div>

        {/* Footnote */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Free forever for up to 100 contacts. Pro from $9.90/month. Same data on every device.
        </p>
      </div>

      <WaitlistDialog
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        platform={waitlistPlatform}
        source="available-everywhere"
      />
    </section>
  );
};

export default AvailableEverywhere;
