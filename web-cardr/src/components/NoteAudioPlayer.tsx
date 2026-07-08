import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { Play, Pause, Loader2, AudioLines, RotateCcw, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface AudioPlayerHandle {
  /** Jump to a moment (seconds) and start playing */
  seekTo: (seconds: number) => void;
}

interface NoteAudioPlayerProps {
  /** Storage path inside the private `meeting-audio` bucket */
  audioPath: string;
  /** Recorded duration fallback — MediaRecorder webm often reports Infinity */
  durationSeconds?: number;
  label: string;
}

const SPEEDS = [1, 1.25, 1.5, 2] as const;

const fmt = (s: number): string => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

/**
 * Otter-style playback for a saved meeting recording: signed-URL streaming,
 * scrubbable progress, ±15s skip, and playback-speed cycling. Exposes
 * `seekTo` so transcript timestamps and highlights can jump into the audio.
 */
const NoteAudioPlayer = forwardRef<AudioPlayerHandle, NoteAudioPlayerProps>(
  ({ audioPath, durationSeconds = 0, label }, ref) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState<number>(durationSeconds);
    const [speedIdx, setSpeedIdx] = useState(0);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase.storage
          .from("meeting-audio")
          .createSignedUrl(audioPath, 3600);
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setFailed(true);
        } else {
          setUrl(data.signedUrl);
        }
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [audioPath]);

    const effectiveDuration = Number.isFinite(duration) && duration > 0 ? duration : durationSeconds;

    const seekTo = useCallback((seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, Math.min(seconds, effectiveDuration || seconds));
      audio.play().catch(() => {});
    }, [effectiveDuration]);

    useImperativeHandle(ref, () => ({ seekTo }), [seekTo]);

    const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    };

    const skip = (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, audio.currentTime + delta);
    };

    const cycleSpeed = () => {
      const next = (speedIdx + 1) % SPEEDS.length;
      setSpeedIdx(next);
      if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
    };

    if (failed) return null;

    return (
      <div className="card-elevated p-4">
        <div className="flex items-center gap-2 mb-3">
          <AudioLines size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <button
            onClick={cycleSpeed}
            className="ml-auto text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors tabular-nums"
          >
            {SPEEDS[speedIdx]}×
          </button>
        </div>

        {url && (
          <audio
            ref={audioRef}
            src={url}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }}
            onDurationChange={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }}
          />
        )}

        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={Math.max(1, effectiveDuration)}
          step={0.5}
          value={Math.min(current, effectiveDuration || current)}
          onChange={(e) => {
            const v = Number(e.target.value);
            setCurrent(v);
            if (audioRef.current) audioRef.current.currentTime = v;
          }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[hsl(var(--primary))] bg-secondary"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${effectiveDuration ? (Math.min(current, effectiveDuration) / effectiveDuration) * 100 : 0}%, hsl(var(--secondary)) 0%)`,
          }}
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground tabular-nums">{fmt(current)}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{fmt(effectiveDuration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-5 mt-1.5">
          <button onClick={() => skip(-15)} className="relative w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw size={20} />
            <span className="absolute text-[7px] font-bold mt-0.5">15</span>
          </button>
          <button
            onClick={togglePlay}
            disabled={loading || !url}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center shadow-md hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="text-primary-foreground animate-spin" />
            ) : playing ? (
              <Pause size={18} className="text-primary-foreground" />
            ) : (
              <Play size={18} className="text-primary-foreground ml-0.5" />
            )}
          </button>
          <button onClick={() => skip(15)} className="relative w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <RotateCw size={20} />
            <span className="absolute text-[7px] font-bold mt-0.5">15</span>
          </button>
        </div>
      </div>
    );
  }
);

NoteAudioPlayer.displayName = "NoteAudioPlayer";

export default NoteAudioPlayer;
