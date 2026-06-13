import { useState } from "react";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Bell, Globe, Smartphone, Monitor } from "lucide-react";
import WaitlistDialog, { type WaitlistPlatform } from "@/components/WaitlistDialog";

const AppleIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
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

interface FaqItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

const PlatformFaq = () => {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistPlatform, setWaitlistPlatform] = useState<WaitlistPlatform | null>(null);

  const openWaitlist = (id: WaitlistPlatform) => {
    setWaitlistPlatform(id);
    setWaitlistOpen(true);
  };

  const faqs: FaqItem[] = [
    {
      id: "platforms-now",
      question: "Which platforms is Cardr available on right now?",
      answer: (
        <div className="space-y-3">
          <p>
            Today, Cardr is live on the <strong>web</strong> — it runs in any modern browser on
            desktop, tablet, or phone. There is nothing to install; just sign in and start using it.
          </p>
          <div className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Globe size={16} className="text-primary" />
            <span className="font-semibold">Web app</span>
            <span className="text-muted-foreground">— available now</span>
          </div>
          <p className="text-sm text-muted-foreground">
            The web app is fully responsive and works offline after the first load. You can scan
            badges, record notes, manage your pipeline, and sync to your CRM right from your phone's
            browser.
          </p>
        </div>
      ),
    },
    {
      id: "coming-soon",
      question: "What about iOS, Android, macOS, and Windows apps?",
      answer: (
        <div className="space-y-3">
          <p>
            Native apps for <strong>iOS</strong>, <strong>Android</strong>, <strong>macOS</strong>,{" "}
            and <strong>Windows</strong> are actively in development. We are building them to the
            same standard as the web experience, so they will feel fast, familiar, and fully
            featured from day one.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "ios" as WaitlistPlatform, label: "iOS", sub: "iPhone & iPad", Icon: AppleIcon },
              { id: "android" as WaitlistPlatform, label: "Android", sub: "Phones & tablets", Icon: Smartphone },
              { id: "mac" as WaitlistPlatform, label: "macOS", sub: "Apple Silicon & Intel", Icon: Monitor },
              { id: "windows" as WaitlistPlatform, label: "Windows", sub: "Windows 10 & 11", Icon: Monitor },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openWaitlist(p.id)}
                className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.04]"
              >
                <p.Icon size={18} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{p.sub}</div>
                </div>
                <Bell size={14} className="ml-auto shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Click any platform above to join the waitlist — we will email you the moment it
            launches.
          </p>
        </div>
      ),
    },
    {
      id: "web-vs-native",
      question: "Will the web app keep working once native apps launch?",
      answer: (
        <p>
          Absolutely. The web app will always be supported and will remain the fastest way to try
          Cardr without downloading anything. When native apps arrive, your account, contacts, and
          data will sync seamlessly across every platform.
        </p>
      ),
    },
    {
      id: "waitlist",
      question: "How does the waitlist work?",
      answer: (
        <p>
          Enter your email for the platform you care about. When the app launches on that platform,
          you will be the first to know — no spam, just one launch email. If you change your mind,
          you can unsubscribe with a single click.
        </p>
      ),
    },
  ];

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="relative overflow-hidden border-t border-border/50 bg-secondary/20 py-24"
    >
      <div className="relative mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Platform availability
          </p>
          <h2
            id="faq-title"
            className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            What is available, and what is on the way.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            We believe in being transparent about what you can use today and what we are building
            next.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="border-border/50"
              >
                <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  <span className="pr-4">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Waitlist CTA band */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/50 p-8 text-center backdrop-blur-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Want to know when your platform is ready?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Join the waitlist and be the first to get access to native iOS, Android, macOS, and
              Windows apps.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {(["ios", "android", "mac", "windows"] as WaitlistPlatform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => openWaitlist(p)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-primary"
              >
                <Bell size={14} /> Notify me on {p === "ios" ? "iOS" : p === "mac" ? "macOS" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <WaitlistDialog
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        platform={waitlistPlatform}
        source="platform-faq"
      />
    </section>
  );
};

export default PlatformFaq;
