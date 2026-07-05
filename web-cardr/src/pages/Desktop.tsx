import { motion } from "framer-motion";
import {
  ArrowLeft,
  Monitor,
  MousePointerClick,
  Headphones,
  MonitorSpeaker,
  PictureInPicture2,
  Sparkles,
  Mic,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import InstallAppCard from "@/components/InstallAppCard";

const STEPS = [
  {
    icon: MousePointerClick,
    title: "Install cardr as a desktop app",
    body: "One click in Chrome or Edge — cardr gets its own window, dock icon, and launches like real software.",
  },
  {
    icon: Headphones,
    title: "Open the recorder before your meeting",
    body: "Go to Notes → Record and pick \u201CBoth\u201D to capture your mic and the meeting audio together.",
  },
  {
    icon: MonitorSpeaker,
    title: "Share your meeting tab",
    body: "Pick the Zoom, Meet, or Teams tab and turn on \u201CAlso share tab audio\u201D. cardr hears the whole call — no bot ever joins.",
  },
  {
    icon: PictureInPicture2,
    title: "Pop out the floating recorder",
    body: "A mini recorder floats above your call with the live transcript. Jot rough notes — AI polishes them into structured meeting notes when you stop.",
  },
] as const;

const WORKS_WITH = ["Zoom", "Google Meet", "Microsoft Teams", "Webex", "Phone calls"];

/**
 * Desktop onboarding: walks users through installing cardr on their computer
 * and recording meetings Granola-style (tab audio capture, no meeting bot).
 */
export default function Desktop() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <Monitor size={28} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Use cardr on your computer</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Record and transcribe your meetings without a bot joining the call. Live transcript,
            speaker labels, and AI notes — right on your desktop.
          </p>
        </motion.div>

        <InstallAppCard className="mb-6" />

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-5 mb-6"
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">
            How meeting capture works
          </p>
          <ol className="space-y-5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </motion.div>

        {/* Granola-style enhancement callout */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-6 flex items-start gap-3"
        >
          <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Rough notes in, polished notes out</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Type half-sentences while you talk. When the meeting ends, AI expands them into clean,
              structured notes using the transcript — names corrected, context filled in.
            </p>
          </div>
        </motion.div>

        {/* Works with */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-8">
          {WORKS_WITH.map((name) => (
            <span
              key={name}
              className="px-2.5 py-1 rounded-full bg-secondary text-[11px] font-medium text-muted-foreground"
            >
              {name}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <Link
          to="/app/notes/record"
          className="w-full h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground flex items-center justify-center gap-2 font-semibold text-sm hover:opacity-90 transition-opacity active:scale-[0.98] mb-3"
        >
          <Mic size={16} />
          Start a meeting recording
        </Link>
        <p className="text-center text-[11px] text-muted-foreground">
          On your phone?{" "}
          <Link to="/install" className="text-primary font-semibold hover:underline">
            Install cardr for mobile
          </Link>
        </p>
      </div>
    </div>
  );
}
