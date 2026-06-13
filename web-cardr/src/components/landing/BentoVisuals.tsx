import { motion } from "framer-motion";
import { QrCode, ScanLine, Mic, Sparkles, Calendar, RefreshCw, Linkedin, Building2, MapPin, Check, Bot, MessageSquare, Zap } from "lucide-react";

/* ---------- 1. Digital card ---------- */
export const VisualCard = () => (
  <div className="relative h-full w-full p-4">
    <div className="absolute inset-4 rounded-xl bg-gradient-to-br from-primary to-accent p-3 shadow-[0_12px_30px_-10px_hsl(var(--primary)/0.5)] rotate-[-4deg]">
      <div className="text-[8px] font-bold uppercase tracking-wider text-primary-foreground/80">Cardr</div>
      <div className="mt-1 text-base font-bold text-primary-foreground">Alex Sterling</div>
      <div className="text-[10px] text-primary-foreground/85">Head of Partnerships</div>
      <div className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-md bg-background/95">
        <QrCode className="h-9 w-9 text-foreground" strokeWidth={1.5} />
      </div>
    </div>
    <motion.div
      className="absolute right-3 top-3 rounded-full bg-card px-2.5 py-1 text-[9px] font-bold text-foreground shadow-md"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 2.6, repeat: Infinity }}
    >
      📲 Tap to share
    </motion.div>
  </div>
);

/* ---------- 2. Badge scanner ---------- */
export const VisualScanner = () => (
  <div className="relative h-full w-full p-4">
    <div className="absolute inset-4 overflow-hidden rounded-xl bg-foreground/95">
      {/* Mock badge */}
      <div className="absolute left-3 top-3 right-3 rounded-md bg-card p-2 shadow-lg">
        <div className="text-[7px] font-bold uppercase tracking-wider text-accent">Web Summit</div>
        <div className="mt-0.5 text-xs font-bold text-foreground">Marcus Lee</div>
        <div className="text-[8px] text-muted-foreground">Director · Notion</div>
      </div>
      {/* OCR scan line */}
      <motion.div
        className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_hsl(var(--primary))]"
        animate={{ top: ["10%", "85%", "10%"] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Brackets */}
      <div className="absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-primary" />
      <div className="absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-primary" />
      <div className="absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-primary" />
      <div className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-primary" />
    </div>
  </div>
);

/* ---------- 3. AI notetaker ---------- */
export const VisualNotes = () => (
  <div className="relative h-full w-full p-4">
    <div className="absolute inset-4 rounded-xl bg-card p-3 border border-border">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-destructive">Recording</span>
        <span className="ml-auto text-[9px] font-bold text-muted-foreground">12:34</span>
      </div>
      <div className="mt-2 flex h-7 items-center gap-[2px]">
        {Array.from({ length: 36 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-[2px] rounded-full bg-primary"
            animate={{ height: [3, 5 + ((i * 11) % 22), 3] }}
            transition={{ duration: 0.7 + (i % 4) * 0.18, repeat: Infinity, delay: i * 0.04 }}
          />
        ))}
      </div>
      <div className="mt-2.5 space-y-1">
        {["Action: send proposal", "Decision: Q1 launch", "Follow-up: 14 May"].map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.2, repeat: Infinity, repeatDelay: 3, repeatType: "reverse" }}
            className="flex items-center gap-1.5 rounded bg-secondary/60 px-1.5 py-1"
          >
            <Sparkles size={8} className="text-primary" fill="currentColor" />
            <span className="text-[9px] font-semibold text-foreground">{t}</span>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

/* ---------- 4. Lead pipeline ---------- */
export const VisualPipeline = () => {
  const cols = [
    { name: "New", color: "bg-muted-foreground/40", cards: 3 },
    { name: "Warm", color: "bg-warning", cards: 2 },
    { name: "Won", color: "bg-success", cards: 2 },
  ];
  return (
    <div className="grid h-full grid-cols-3 gap-1.5 p-4">
      {cols.map((col, ci) => (
        <div key={col.name} className="flex flex-col">
          <div className="flex items-center gap-1 mb-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${col.color}`} />
            <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">{col.name}</span>
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: col.cards }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ci * 0.12 + i * 0.08 }}
                className="rounded-md bg-card p-1.5 border border-border/60 shadow-sm"
              >
                <div className="h-1.5 w-3/4 rounded-full bg-foreground/15" />
                <div className="mt-1 h-1 w-1/2 rounded-full bg-foreground/8" />
                <div className="mt-1.5 flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-primary/20" />
                  <div className="h-1 w-6 rounded-full bg-foreground/10" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ---------- 5. CRM + calendar sync ---------- */
export const VisualSync = () => {
  const logos = [
    { label: "PD", color: "bg-foreground", name: "Pipedrive" },
    { label: "HS", color: "bg-warning", name: "HubSpot" },
    { label: "SF", color: "bg-accent", name: "Salesforce" },
    { label: "GC", color: "bg-primary", name: "Calendar" },
    { label: "SL", color: "bg-success", name: "Slack" },
  ];
  return (
    <div className="relative h-full w-full">
      {/* Center node */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-background shadow-[0_8px_25px_-6px_hsl(var(--primary)/0.6)]">
          <RefreshCw size={18} className="animate-spin" style={{ animationDuration: "5s" }} />
        </div>
      </div>
      {/* Orbiting logos */}
      {logos.map((l, i) => {
        const angle = (i / logos.length) * Math.PI * 2;
        const r = 64;
        return (
          <motion.div
            key={l.name}
            className="absolute left-1/2 top-1/2"
            initial={{ x: -16, y: -16, opacity: 0, scale: 0.7 }}
            whileInView={{
              x: Math.cos(angle) * r - 16,
              y: Math.sin(angle) * r - 16,
              opacity: 1,
              scale: 1,
            }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.6, ease: "easeOut" }}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-[9px] font-bold text-background shadow-md ${l.color}`}>
              {l.label}
            </div>
          </motion.div>
        );
      })}
      {/* Connection lines */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 176" preserveAspectRatio="none">
        {logos.map((_, i) => {
          const angle = (i / logos.length) * Math.PI * 2;
          const r = 64;
          const cx = 100, cy = 88;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(angle) * r}
              y2={cy + Math.sin(angle) * r}
              stroke="hsl(var(--primary))"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.3"
            />
          );
        })}
      </svg>
    </div>
  );
};

/* ---------- 6. AI enrichment ---------- */
export const VisualEnrichment = () => {
  const fields = [
    { icon: Linkedin, label: "linkedin.com/in/marcus-lee", delay: 0.1 },
    { icon: Building2, label: "marcus@notion.so", delay: 0.25 },
    { icon: MapPin, label: "+1 (415) 555-0142 · SF, CA", delay: 0.4 },
    { icon: Sparkles, label: "Notion · 200-500 · SaaS", delay: 0.55 },
  ];
  return (
    <div className="relative h-full w-full p-4">
      <div className="absolute inset-4 rounded-xl bg-card p-3 border border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
            ML
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-foreground">Marcus Lee</div>
            <div className="text-[8px] text-muted-foreground">marcus@…</div>
          </div>
          <motion.div
            className="flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[8px] font-bold text-primary"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <Sparkles size={8} fill="currentColor" /> AI
          </motion.div>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {fields.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: f.delay, repeat: Infinity, repeatDelay: 2.5, repeatType: "reverse" }}
              className="flex items-center gap-1.5 rounded bg-secondary/50 px-1.5 py-1"
            >
              <f.icon size={9} className="text-primary shrink-0" />
              <span className="truncate text-[9px] font-semibold text-foreground">{f.label}</span>
              <Check size={9} className="ml-auto text-success shrink-0" strokeWidth={3} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------- 7. AI Chat ---------- */
export const VisualAIChat = () => {
  const msgs = [
    { from: "user", text: "Who did I meet at Web Summit?", delay: 0.1 },
    { from: "ai", text: "12 contacts. 3 are warm leads.", delay: 0.6 },
    { from: "user", text: "Draft a follow-up to Marcus.", delay: 1.2 },
  ];
  return (
    <div className="relative h-full w-full p-3">
      <div className="absolute inset-3 rounded-xl bg-card border border-border p-2.5 flex flex-col gap-1.5">
        {msgs.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: m.delay, repeat: Infinity, repeatDelay: 3, repeatType: "reverse" }}
            className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-2 py-1 text-[9px] font-medium ${
                m.from === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm"
              }`}
            >
              {m.from === "ai" && <Sparkles size={7} className="inline mr-1" fill="currentColor" />}
              {m.text}
            </div>
          </motion.div>
        ))}
        <div className="mt-auto flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1">
          <MessageSquare size={9} className="text-muted-foreground" />
          <div className="h-1 flex-1 rounded-full bg-foreground/10" />
        </div>
      </div>
    </div>
  );
};

/* ---------- 8. Agentic AI ---------- */
export const VisualAgent = () => {
  const steps = [
    { label: "Detect stale lead", delay: 0.1 },
    { label: "Draft personalized email", delay: 0.6 },
    { label: "Schedule send · Tue 9am", delay: 1.1 },
  ];
  return (
    <div className="relative h-full w-full p-3">
      <div className="absolute inset-3 rounded-xl bg-card border border-border p-2.5">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent">
            <Bot size={10} className="text-background" />
          </div>
          <span className="text-[9px] font-bold text-foreground">Follow-up agent</span>
          <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-success">
            <span className="h-1 w-1 rounded-full bg-success animate-pulse" /> Active
          </span>
        </div>
        <div className="mt-2 space-y-1">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.3 }}
              animate={{ opacity: 1 }}
              transition={{ delay: s.delay, repeat: Infinity, repeatDelay: 2.5, repeatType: "reverse" }}
              className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-1.5 py-1"
            >
              <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/15">
                <Zap size={7} className="text-primary" fill="currentColor" />
              </div>
              <span className="text-[9px] font-semibold text-foreground">{s.label}</span>
              <Check size={8} className="ml-auto text-success" strokeWidth={3} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
