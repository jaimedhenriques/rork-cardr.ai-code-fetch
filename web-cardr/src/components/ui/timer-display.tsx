import { motion, AnimatePresence } from "framer-motion";

interface TimerDisplayProps {
  /** Total seconds elapsed. */
  seconds: number;
  /** Visual size variant. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Show subtle live recording dot + waveform. */
  active?: boolean;
  /** Pause state (dims color, stops pulse). */
  paused?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
  xl: "text-7xl",
} as const;

/**
 * Apple Voice Memos-style timer.
 * - Tabular monospaced digits, ultra-light weight, generous tracking
 * - Optional live waveform pulse + subtle breathing animation when active
 * - Each digit transitions smoothly when it changes
 */
const TimerDisplay = ({ seconds, size = "lg", active = false, paused = false, className = "" }: TimerDisplayProps) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const segments = hours > 0
    ? [pad(hours), pad(minutes), pad(secs)]
    : [pad(minutes), pad(secs)];

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`timer-display flex items-center justify-center ${SIZE_MAP[size]} ${
          paused ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {segments.map((seg, idx) => (
          <span key={idx} className="flex items-center">
            {idx > 0 && <span className="opacity-50 mx-0.5">:</span>}
            <DigitGroup digits={seg} />
          </span>
        ))}
      </div>

      {active && (
        <div className="flex items-center gap-2.5">
          {paused ? (
            <span className="text-2xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Paused
            </span>
          ) : (
            <>
              <Waveform />
              <span className="text-2xs font-semibold uppercase tracking-[0.15em] text-destructive">
                Recording
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const pad = (n: number) => n.toString().padStart(2, "0");

/**
 * Renders each digit so it can independently fade/slide when it changes.
 */
const DigitGroup = ({ digits }: { digits: string }) => (
  <span className="inline-flex">
    {digits.split("").map((d, i) => (
      <Digit key={i} digit={d} />
    ))}
  </span>
);

const Digit = ({ digit }: { digit: string }) => (
  <span className="relative inline-block w-[0.62em] h-[1em] overflow-hidden">
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={digit}
        initial={{ y: "60%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "-60%", opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 flex items-center justify-center"
      >
        {digit}
      </motion.span>
    </AnimatePresence>
  </span>
);

const Waveform = () => (
  <div className="flex items-end gap-[2px] h-3">
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className={`w-[2px] rounded-full bg-destructive origin-bottom`}
        style={{
          height: "100%",
          animation: `wave 1.2s ease-in-out ${i * 0.15}s infinite`,
        }}
      />
    ))}
  </div>
);

export default TimerDisplay;
