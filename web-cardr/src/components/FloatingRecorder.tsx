import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, Square, Pencil } from "lucide-react";

interface FloatingRecorderStrings {
  listening: string;
  jotNotes: string;
  stopSave: string;
  yourNotes: string;
}

interface FloatingRecorderProps {
  /** The Document Picture-in-Picture window to render into */
  pipWindow: Window;
  title: string;
  duration: number;
  paused: boolean;
  liveText: string;
  notes: string;
  onNotesChange: (value: string) => void;
  onPauseToggle: () => void;
  onStop: () => void;
  strings: FloatingRecorderStrings;
}

const formatTime = (s: number): string =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Granola-style always-on-top mini recorder rendered inside a Document PiP
 * window: pulsing rec indicator, timer, auto-scrolling live transcript, a
 * quick-jot notes pad (synced with the main page), and pause/stop controls.
 */
const FloatingRecorder = ({
  pipWindow,
  title,
  duration,
  paused,
  liveText,
  notes,
  onNotesChange,
  onPauseToggle,
  onStop,
  strings,
}: FloatingRecorderProps) => {
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // Keep the newest words visible as the transcript grows.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveText]);

  return createPortal(
    <div className="flex flex-col bg-background text-foreground overflow-hidden" style={{ height: "100vh" }}>
      {/* Header: rec dot + timer + title */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card shrink-0">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${paused ? "bg-amber-500" : "bg-red-500 animate-pulse"}`}
        />
        <span className="text-sm font-bold tabular-nums text-foreground">{formatTime(duration)}</span>
        <span className="text-xs text-muted-foreground truncate flex-1 text-right">{title}</span>
      </div>

      {/* Live transcript */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {liveText ? (
          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{liveText}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">{strings.listening}</p>
        )}
      </div>

      {/* Quick-jot notes (synced with the main recorder page) */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Pencil size={10} className="text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {strings.yourNotes}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={strings.jotNotes}
          rows={3}
          className="w-full rounded-lg bg-card border border-border p-2 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 pb-3 shrink-0">
        <button
          onClick={onPauseToggle}
          className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
        >
          {paused ? (
            <Play size={16} className="text-primary ml-0.5" />
          ) : (
            <Pause size={16} className="text-muted-foreground" />
          )}
        </button>
        <button
          onClick={onStop}
          className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center gap-2 text-xs font-bold hover:bg-destructive/90 transition-colors"
        >
          <Square size={14} />
          {strings.stopSave}
        </button>
      </div>
    </div>,
    pipWindow.document.body
  );
};

export default FloatingRecorder;
