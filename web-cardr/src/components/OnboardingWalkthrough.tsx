import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine, Sparkles, Users, Zap, Bot, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "cardr.onboarding.v1.completed";

type Step = {
  icon: typeof ScanLine;
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  accent: string;
};

const steps: Step[] = [
  {
    icon: Sparkles,
    eyebrow: "Welcome to Cardr",
    title: "Your AI-powered contact intelligence",
    description: "Capture, enrich, and follow up — all in one place. Built for people who turn conversations into pipeline.",
    accent: "from-primary to-accent",
  },
  {
    icon: ScanLine,
    eyebrow: "Capture",
    title: "Scan any badge or business card",
    description: "Point your camera, get a perfectly structured contact in seconds.",
    bullets: ["Conference badge OCR", "Business card scanning", "Auto-enrichment from LinkedIn"],
    accent: "from-blue-500 to-cyan-500",
  },
  {
    icon: Users,
    eyebrow: "Organize",
    title: "Smart pipeline + folders",
    description: "Tag, filter, and move leads through your custom pipeline. Bulk actions and one-click CRM sync.",
    bullets: ["Visual pipeline stages", "Tags & folders", "HubSpot, Salesforce, Zoho sync"],
    accent: "from-emerald-500 to-teal-500",
  },
  {
    icon: Zap,
    eyebrow: "Automate",
    title: "AI notes + follow-ups",
    description: "Record meetings, get summaries, action items, and AI-drafted follow-up emails.",
    bullets: ["Meeting transcription", "Action items extracted", "Email + LinkedIn drafts"],
    accent: "from-amber-500 to-orange-500",
  },
  {
    icon: Bot,
    eyebrow: "Meet your assistant",
    title: "Ask Cardr AI anything",
    description: "Your data, your assistant. Ask about contacts, draft messages, or trigger agents — right from chat.",
    bullets: ['"Who did I meet at SaaStr?"', '"Draft a follow-up to Sarah"', '"Show hot leads from this week"'],
    accent: "from-fuchsia-500 to-primary",
  },
];

const OnboardingWalkthrough = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setOpen(true);
  }, [user, loading]);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  const next = () => {
    if (index < steps.length - 1) setIndex(index + 1);
    else close();
  };

  if (!open) return null;

  const step = steps[index];
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={close}
      >
        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-md" />

        <motion.div
          key={index}
          initial={{ y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/70 shadow-2xl overflow-hidden"
        >
          {/* Skip */}
          <button
            onClick={close}
            className="absolute top-4 right-4 z-10 h-9 w-9 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors"
            aria-label="Skip"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Hero visual */}
          <div className={`relative h-44 bg-gradient-to-br ${step.accent} overflow-hidden`}>
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,white,transparent_60%)]" />
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.05 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="h-24 w-24 rounded-3xl bg-white/15 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-xl">
                <Icon className="h-12 w-12 text-white" strokeWidth={1.75} />
              </div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="px-6 pt-6 pb-8 space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.12em] uppercase text-primary">
                {step.eyebrow}
              </p>
              <h2 className="text-2xl font-display font-semibold tracking-tight text-foreground">
                {step.title}
              </h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>

            {step.bullets && (
              <ul className="space-y-2.5">
                {step.bullets.map((b, i) => (
                  <motion.li
                    key={b}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex items-start gap-2.5"
                  >
                    <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                    </span>
                    <span className="text-sm text-foreground/85">{b}</span>
                  </motion.li>
                ))}
              </ul>
            )}

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              {!isLast && (
                <Button
                  variant="ghost"
                  onClick={close}
                  className="flex-1 text-muted-foreground hover:text-foreground"
                >
                  Skip
                </Button>
              )}
              <Button
                onClick={next}
                className="flex-1 gap-2 group"
                size="lg"
              >
                {isLast ? "Get started" : "Next"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingWalkthrough;
