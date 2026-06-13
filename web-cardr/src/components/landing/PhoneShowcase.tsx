import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode,
  ScanLine,
  Mic,
  KanbanSquare,
  RefreshCw,
  Sparkles,
  Building2,
  MapPin,
  Linkedin,
  Phone,
  Mail,
  Check,
  Calendar,
  Briefcase,
} from "lucide-react";
import { CardrText } from "@/components/brand/CardrLogo";

type SceneKey = "card" | "scanner" | "notes" | "pipeline" | "sync";

const SCENES: { key: SceneKey; label: string; icon: typeof QrCode }[] = [
  { key: "card", label: "Digital card", icon: QrCode },
  { key: "scanner", label: "Badge scanner", icon: ScanLine },
  { key: "notes", label: "AI notetaker", icon: Mic },
  { key: "pipeline", label: "Lead pipeline", icon: KanbanSquare },
  { key: "sync", label: "CRM sync", icon: RefreshCw },
];

const CYCLE_MS = 3800;

const SceneCard = () => (
  <div className="flex h-full flex-col items-center justify-center px-5 py-6 text-center">
    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">My Cardr</div>
    <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent p-[3px] shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.5)]">
      <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-2xl font-bold text-foreground">
        AS
      </div>
    </div>
    <div className="mt-3 text-base font-bold text-foreground">Alex Sterling</div>
    <div className="text-[11px] text-muted-foreground">Head of Partnerships · Cardr</div>
    <div className="mt-3 flex h-20 w-20 items-center justify-center rounded-xl bg-foreground p-2">
      <QrCode className="h-full w-full text-background" strokeWidth={1.4} />
    </div>
    <div className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground">Tap or scan to save</div>
  </div>
);

const SceneScanner = () => (
  <div className="relative flex h-full flex-col px-4 py-5">
    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Live scan</div>
    <div className="relative mt-2 flex-1 overflow-hidden rounded-xl bg-foreground/95">
      {/* Mock badge */}
      <div className="absolute inset-3 rounded-lg bg-card p-3 shadow-lg">
        <div className="text-[8px] font-bold uppercase tracking-wider text-accent">SaaStr 2025</div>
        <div className="mt-2 text-sm font-bold text-foreground leading-tight">Priya Shah</div>
        <div className="text-[10px] text-muted-foreground">VP Sales · Stripe</div>
        <div className="mt-3 flex gap-1">
          <div className="h-8 w-8 rounded bg-foreground/90" />
          <div className="flex-1 space-y-1 pt-1">
            <div className="h-1.5 w-3/4 rounded-full bg-muted" />
            <div className="h-1.5 w-1/2 rounded-full bg-muted" />
          </div>
        </div>
      </div>
      {/* Scan line */}
      <motion.div
        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_hsl(var(--primary))]"
        animate={{ top: ["8%", "88%", "8%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Corner brackets */}
      {[
        "top-2 left-2 border-t-2 border-l-2",
        "top-2 right-2 border-t-2 border-r-2",
        "bottom-2 left-2 border-b-2 border-l-2",
        "bottom-2 right-2 border-b-2 border-r-2",
      ].map((c, i) => (
        <div key={i} className={`absolute h-4 w-4 border-primary ${c}`} />
      ))}
    </div>
    <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-success/15 px-2 py-1.5 text-[10px] font-semibold text-success">
      <Check size={11} strokeWidth={3} /> Captured · enriching…
    </div>
  </div>
);

const SceneNotes = () => (
  <div className="flex h-full flex-col px-4 py-5">
    <div className="flex items-center justify-between">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Recording</div>
      <div className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" /> 12:34
      </div>
    </div>
    <div className="mt-2 text-xs font-semibold text-foreground">Meeting with Stripe</div>
    {/* Waveform */}
    <div className="mt-2 flex h-10 items-center justify-center gap-[2px] rounded-lg bg-secondary/60 px-2">
      {Array.from({ length: 28 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full bg-primary"
          animate={{ height: [4, 6 + ((i * 13) % 22), 4] }}
          transition={{ duration: 0.8 + (i % 5) * 0.15, repeat: Infinity, delay: i * 0.04 }}
        />
      ))}
    </div>
    <div className="mt-3 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">AI summary</div>
    <div className="mt-1.5 space-y-1.5">
      {[
        { c: "bg-primary", t: "Discussed Q1 partnership terms" },
        { c: "bg-accent", t: "Action: send proposal Friday" },
        { c: "bg-success", t: "Follow-up scheduled for 14 May" },
      ].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 + i * 0.25 }}
          className="flex items-start gap-2 rounded-md bg-card/60 p-1.5"
        >
          <div className={`mt-0.5 h-1.5 w-1.5 rounded-full ${item.c}`} />
          <div className="text-[10px] leading-tight text-foreground">{item.t}</div>
        </motion.div>
      ))}
    </div>
  </div>
);

const ScenePipeline = () => {
  const stages = [
    { name: "New", color: "bg-muted-foreground/40", count: 12 },
    { name: "Warm", color: "bg-warning", count: 8 },
    { name: "Meeting", color: "bg-accent", count: 5 },
    { name: "Closed", color: "bg-success", count: 3 },
  ];
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Pipeline</div>
      <div className="mt-1 text-xs font-semibold text-foreground">28 active leads</div>
      <div className="mt-3 space-y-1.5">
        {stages.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-2 rounded-lg bg-card/70 p-2"
          >
            <div className={`h-2 w-2 rounded-full ${s.color}`} />
            <div className="flex-1 text-[10px] font-semibold text-foreground">{s.name}</div>
            <div className="text-[9px] font-bold text-muted-foreground">{s.count}</div>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={`h-full ${s.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${(s.count / 12) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.12 + 0.2 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2">
        <div className="text-[9px] uppercase tracking-wider font-bold text-primary">Next action</div>
        <div className="mt-0.5 text-[10px] font-semibold text-foreground">Follow up: Marcus @ Notion</div>
      </div>
    </div>
  );
};

const SceneSync = () => {
  const integrations = [
    { name: "Pipedrive", short: "PD", color: "bg-foreground" },
    { name: "HubSpot", short: "HS", color: "bg-warning" },
    { name: "Salesforce", short: "SF", color: "bg-accent" },
    { name: "Google Cal", short: "GC", color: "bg-primary" },
  ];
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Auto-sync</div>
      <div className="mt-1 text-xs font-semibold text-foreground">Connected systems</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {integrations.map((it, i) => (
          <motion.div
            key={it.name}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-1.5 rounded-lg bg-card/80 p-1.5"
          >
            <div className={`flex h-6 w-6 items-center justify-center rounded-md text-[8px] font-bold text-background ${it.color}`}>
              {it.short}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[9px] font-semibold text-foreground">{it.name}</div>
              <div className="flex items-center gap-0.5 text-[8px] text-success">
                <span className="h-1 w-1 rounded-full bg-success" /> Synced
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 p-2"
      >
        <RefreshCw className="h-3 w-3 animate-spin text-success" style={{ animationDuration: "3s" }} />
        <div className="text-[10px] font-semibold text-foreground">28 contacts pushed today</div>
      </motion.div>
    </div>
  );
};

const SCENE_COMPONENTS: Record<SceneKey, () => JSX.Element> = {
  card: SceneCard,
  scanner: SceneScanner,
  notes: SceneNotes,
  pipeline: ScenePipeline,
  sync: SceneSync,
};

export const PhoneShowcase = () => {
  const [idx, setIdx] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hovered) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SCENES.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [hovered]);

  const current = SCENES[idx];
  const Scene = SCENE_COMPONENTS[current.key];

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Floating chips */}
      <motion.div
        className="absolute -left-4 top-12 z-20 flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 shadow-[0_8px_25px_-8px_rgba(0,0,0,0.2)]"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles size={12} className="text-primary" fill="currentColor" />
        <span className="text-[11px] font-bold text-foreground">AI enriched</span>
      </motion.div>
      <motion.div
        className="absolute -right-2 top-32 z-20 flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 shadow-[0_8px_25px_-8px_rgba(0,0,0,0.2)]"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <RefreshCw size={11} className="text-accent" />
        <span className="text-[11px] font-bold text-foreground">Synced to Pipedrive</span>
      </motion.div>
      <motion.div
        className="absolute -right-6 bottom-24 z-20 flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 shadow-[0_8px_25px_-8px_rgba(0,0,0,0.2)]"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <Calendar size={11} className="text-success" />
        <span className="text-[11px] font-bold text-foreground">Follow-up booked</span>
      </motion.div>

      {/* Phone frame */}
      <div className="relative mx-auto w-[280px] sm:w-[300px]">
        <div className="relative aspect-[9/19] rounded-[2.6rem] bg-foreground p-2.5 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.35)]">
          {/* Notch */}
          <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-foreground" />
          {/* Screen */}
          <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-background">
            {/* Status bar */}
            <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[9px] font-bold text-foreground">
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-foreground" />
                <span className="h-1 w-1 rounded-full bg-foreground" />
                <span className="h-1 w-1 rounded-full bg-foreground" />
              </span>
            </div>
            {/* App header */}
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
              <div className="text-sm font-bold tracking-tight">
                <CardrText />
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                AS
              </div>
            </div>
            {/* Scene */}
            <div className="relative h-[calc(100%-3.4rem)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.key}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute inset-0"
                >
                  <Scene />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Scene tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
        {SCENES.map((s, i) => {
          const active = i === idx;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setIdx(i)}
              className={`group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                active
                  ? "bg-foreground text-background shadow-[0_4px_12px_-4px_hsl(var(--foreground)/0.4)]"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={11} />
              {s.label}
              {active && (
                <motion.div
                  layoutId="scene-progress"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: hovered ? 0 : 1 }}
                  transition={{ duration: hovered ? 0 : CYCLE_MS / 1000, ease: "linear" }}
                  style={{ transformOrigin: "left" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PhoneShowcase;
