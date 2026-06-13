import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Play, LogIn, Sparkles, Menu, X } from "lucide-react";
import AppStoreBadge from "@/components/badges/AppStoreBadge";
import GooglePlayBadge from "@/components/badges/GooglePlayBadge";
import { CardrText } from "@/components/brand/CardrLogo";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedGrid from "@/components/landing/AnimatedGrid";
import BentoCard from "@/components/landing/BentoCard";
import PhoneShowcase from "@/components/landing/PhoneShowcase";
import {
  VisualCard,
  VisualScanner,
  VisualNotes,
  VisualPipeline,
  VisualSync,
  VisualEnrichment,
  VisualAIChat,
  VisualAgent,
} from "@/components/landing/BentoVisuals";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import AvailableEverywhere from "@/components/landing/AvailableEverywhere";
import PlatformFaq from "@/components/landing/PlatformFaq";

const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

const NAV_SECTIONS = ["product", "capabilities", "download"] as const;
type NavSection = (typeof NAV_SECTIONS)[number];

const LandingPreview = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection | null>(null);

  useEffect(() => {
    const elements = NAV_SECTIONS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        }
        if (visible.size === 0) {
          setActiveSection(null);
          return;
        }
        const top = [...visible.entries()].sort((a, b) => b[1] - a[1])[0][0] as NavSection;
        setActiveSection(top);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Lock body scroll + close on Escape while mobile menu is open
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const TITLE = "Cardr — The networking OS for people who close.";
    const DESC =
      "Scan badges, capture meeting notes with AI, enrich leads, and run your pipeline — all in one app. Built for people who network and close.";
    const URL = "https://cardr.ai/";
    const IMG = "https://cardr.ai/og-image.jpg";

    document.title = TITLE;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        const [key, val] = selector.replace(/[\[\]"]/g, "").split("=");
        el.setAttribute(key, val);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', "content", DESC);
    setMeta('meta[property="og:title"]', "content", TITLE);
    setMeta('meta[property="og:description"]', "content", DESC);
    setMeta('meta[property="og:url"]', "content", URL);
    setMeta('meta[property="og:image"]', "content", IMG);
    setMeta('meta[name="twitter:title"]', "content", TITLE);
    setMeta('meta[name="twitter:description"]', "content", DESC);
    setMeta('meta[name="twitter:image"]', "content", IMG);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = URL;

    const ldId = "cardr-landing-jsonld";
    document.getElementById(ldId)?.remove();
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = ldId;
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": URL + "#webpage",
          url: URL,
          name: TITLE,
          description: DESC,
          isPartOf: { "@id": "https://cardr.ai/#website" },
          primaryImageOfPage: IMG,
          inLanguage: "en-US",
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What is Cardr?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Cardr is a networking CRM that scans business cards and badges, captures AI meeting notes, enriches leads, and helps you run your sales pipeline.",
              },
            },
            {
              "@type": "Question",
              name: "Is Cardr free to use?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Cardr offers a free tier with up to 100 contacts and a digital business card. Pro is $9.90/month for unlimited scanning, AI enrichment, and integrations.",
              },
            },
            {
              "@type": "Question",
              name: "Does Cardr integrate with my CRM?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Cardr syncs with HubSpot, Pipedrive, Google Calendar, Slack, and exports to any CRM via Zapier or CSV.",
              },
            },
            {
              "@type": "Question",
              name: "Which platforms is Cardr available on?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Cardr is available now on the web — any modern browser on desktop, tablet, or phone. Native iOS, Android, macOS, and Windows apps are coming soon. Join the waitlist to be notified when they launch.",
              },
            },
            {
              "@type": "Question",
              name: "Will the web app keep working once native apps launch?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. The web app will always be supported and will remain the fastest way to try Cardr without downloading anything. Your account, contacts, and data will sync seamlessly across every platform.",
              },
            },
          ],
        },
      ],
    });
    document.head.appendChild(ld);

    return () => {
      document.getElementById(ldId)?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/75 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-2xl font-bold tracking-tight leading-none">
            <CardrText />
          </Link>
          <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground md:flex">
            {([
              { id: "product", label: "Product", href: "#product" },
              { id: "capabilities", label: "Features", href: "#capabilities" },
            ] as const).map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={`relative rounded-full px-3 py-1.5 transition-colors ${
                  activeSection === item.id
                    ? "text-foreground"
                    : "hover:text-foreground"
                }`}
              >
                {item.label}
                {activeSection === item.id && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-primary/10 ring-1 ring-primary/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            ))}
            <Link to="/pricing" className="rounded-full px-3 py-1.5 hover:text-foreground transition-colors">
              Pricing
            </Link>
            <a
              href="#download"
              className={`relative rounded-full px-3 py-1.5 transition-colors ${
                activeSection === "download" ? "text-foreground" : "hover:text-foreground"
              }`}
            >
              Download
              {activeSection === "download" && (
                <motion.span
                  layoutId="nav-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-primary/10 ring-1 ring-primary/30"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden sm:inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Log in
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 hover:scale-[1.02]"
            >
              Sign in <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((v) => !v)}
              className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/50 text-foreground transition-colors hover:bg-card md:hidden"
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden"
            >
              <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4 text-base font-medium">
                {([
                  { id: "product", label: "Product", href: "#product" },
                  { id: "capabilities", label: "Features", href: "#capabilities" },
                ] as const).map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`rounded-lg px-3 py-3 transition-colors ${
                      activeSection === item.id
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-card hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
                <Link to="/pricing" onClick={() => setMobileNavOpen(false)} className="rounded-lg px-3 py-3 text-foreground/80 hover:bg-card hover:text-foreground">Pricing</Link>
                <a
                  href="#download"
                  onClick={() => setMobileNavOpen(false)}
                  className={`rounded-lg px-3 py-3 transition-colors ${
                    activeSection === "download"
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-card hover:text-foreground"
                  }`}
                >
                  Download
                </a>
                <Link to="/auth" onClick={() => setMobileNavOpen(false)} className="mt-2 rounded-lg px-3 py-3 text-muted-foreground hover:bg-card hover:text-foreground sm:hidden">Log in</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <AnimatedGrid />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-14 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:py-28">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              <Sparkles size={11} fill="currentColor" /> The networking OS
            </div>
            <h1 className="text-[2.6rem] font-bold leading-[1.04] tracking-tight text-foreground sm:text-5xl lg:text-[3.6rem]">
              Every business card,
              <br />
              meeting, and lead —
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                captured, enriched, closed.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Share your digital card, scan any badge, transcribe meetings, enrich contacts with
              verified emails and phone numbers, chat with your network, and sync everything to
              your CRM and calendar — all from your pocket.
            </p>

            {/* Capability strip */}
            <div className="mt-7 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              {[
                "Digital card",
                "Badge scanner",
                "AI notetaker",
                "Email + phone enrichment",
                "AI chat",
                "Lead pipeline",
                "Calendar sync",
                "CRM sync",
              ].map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-foreground/75"
                >
                  {n}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <AppStoreBadge href={APP_STORE_URL} size={52} />
              <GooglePlayBadge href={PLAY_STORE_URL} size={52} />
            </div>
            <Link
              to="/auth"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/80 hover:text-foreground"
            >
              <LogIn size={14} /> Or use Cardr on the web <ArrowRight size={14} />
            </Link>

            {/* Trust strip */}
            <div className="mt-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Built for closers at events like
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-bold text-muted-foreground/70">
                <span>SaaStr</span>
                <span>·</span>
                <span>Web Summit</span>
                <span>·</span>
                <span>Slush</span>
                <span>·</span>
                <span>Money 20/20</span>
                <span>·</span>
                <span>Dreamforce</span>
              </div>
            </div>
          </motion.div>

          {/* Right: phone showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex items-center justify-center"
          >
            <PhoneShowcase />
          </motion.div>
        </div>
      </section>

      {/* BENTO */}
      <section id="product" className="relative border-t border-border/50 bg-secondary/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">One app. Eight surfaces.</p>
            <h2 id="capabilities" className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Everything that happens between
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                the handshake and the close.
              </span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              Capture, enrich, and act on every connection — without switching tools.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-6 md:auto-rows-[minmax(280px,auto)]">
            {/* Row 1 */}
            <BentoCard
              className="md:col-span-3"
              eyebrow="Digital card"
              title="Share your card with one tap"
              description="A beautiful Cardr profile, NFC-ready QR, Apple/Google Wallet pass, and your own cardr.ai/you link."
              delay={0}
            >
              <VisualCard />
            </BentoCard>
            <BentoCard
              className="md:col-span-3"
              eyebrow="Badge & card scanner"
              title="Scan any badge in under a second"
              description="OCR works on conference badges, paper business cards, and LinkedIn QR codes. Every field captured, every time."
              delay={0.05}
            >
              <VisualScanner />
            </BentoCard>

            {/* Row 2 */}
            <BentoCard
              className="md:col-span-4"
              eyebrow="AI notetaker"
              title="Record, transcribe, and surface insights"
              description="Capture meetings in person or on Zoom. Cardr writes the summary, extracts action items, decisions, and follow-ups — and links them to the right contact."
              delay={0.1}
            >
              <VisualNotes />
            </BentoCard>
            <BentoCard
              className="md:col-span-2"
              eyebrow="Data enrichment"
              title="Verified emails & phone numbers"
              description="A name becomes a full profile — work email, mobile, LinkedIn, company, industry, location."
              delay={0.15}
            >
              <VisualEnrichment />
            </BentoCard>

            {/* Row 3 */}
            <BentoCard
              className="md:col-span-2"
              eyebrow="AI chat"
              title="Talk to your network"
              description="Ask questions across every contact, meeting, and note. Draft replies in your voice."
              delay={0.2}
            >
              <VisualAIChat />
            </BentoCard>
            <BentoCard
              className="md:col-span-4"
              eyebrow="Agentic AI"
              title="Agents that work follow-ups for you"
              description="Stale-lead nudges, post-meeting recaps, birthday touches, and personalized outreach — drafted and scheduled automatically. You stay in control of every send."
              delay={0.25}
            >
              <VisualAgent />
            </BentoCard>

            {/* Row 4 */}
            <BentoCard
              className="md:col-span-3"
              eyebrow="Lead management"
              title="A pipeline built for closers"
              description="Custom stages, follow-up reminders, next actions, and a per-contact activity timeline — not an admin tool."
              delay={0.3}
            >
              <VisualPipeline />
            </BentoCard>
            <BentoCard
              className="md:col-span-3"
              eyebrow="Calendar & CRM sync"
              title="Connects to the systems you already use"
              description="Two-way sync with Google Calendar. Push contacts, notes, and deals to Pipedrive, HubSpot, and Salesforce. Notify the team in Slack."
              delay={0.35}
            >
              <VisualSync />
            </BentoCard>
          </div>
        </div>
      </section>

      {/* AVAILABLE EVERYWHERE */}
      <AvailableEverywhere />

      {/* PLATFORM FAQ */}
      <PlatformFaq />

      {/* TESTIMONIALS */}
      <TestimonialsSection />

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-border/50 py-24">
        <AnimatedGrid />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Stop forgetting the people you meet.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            100 contacts free, forever. Pro unlocks unlimited scans, AI transcription, enrichment,
            agents, and CRM sync.
          </p>
          <div id="download" className="mt-9 flex flex-wrap justify-center gap-3">
            <AppStoreBadge href={APP_STORE_URL} size={52} />
            <GooglePlayBadge href={PLAY_STORE_URL} size={52} />
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <CardrText className="text-xl font-bold tracking-tight leading-none" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} <CardrText accentClassName="text-primary font-semibold" /> · The networking OS
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPreview;
