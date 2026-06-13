import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  mode?: "memo" | "meeting";
  className?: string;
}

const VoiceRecorder = ({ onTranscript, mode = "memo", className = "" }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef("");

  const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      toast.error("Speech recognition not supported in this browser. Try Chrome.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    transcriptRef.current = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptRef.current += event.results[i][0].transcript.trim() + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (interim) {
        transcriptRef.current = `${transcriptRef.current.trim()} ${interim}`.trim();
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recognition.onend = () => {
      // Auto-restart for meeting mode if still recording
      if (recording && mode === "meeting") {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, [isSupported, mode, recording]);

  const stopRecording = useCallback(() => {
    setTranscribing(true);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);

    // Small delay to catch final results
    setTimeout(() => {
      const fullText = transcriptRef.current.trim();
      if (fullText) {
        onTranscript(fullText);
        toast.success(mode === "meeting" ? "Meeting transcribed!" : "Voice note saved!");
      } else {
        toast.error("No speech detected. Try again.");
      }
      setTranscribing(false);
      setDuration(0);
    }, 500);
  }, [onTranscript, mode]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!isSupported) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {recording ? (
        <>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-mono text-destructive font-semibold">{formatDuration(duration)}</span>
            <span className="text-[10px] text-muted-foreground">
              {mode === "meeting" ? "Recording meeting…" : "Listening…"}
            </span>
          </div>
          <button
            onClick={stopRecording}
            className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
          >
            <Square size={12} className="text-destructive" />
          </button>
        </>
      ) : transcribing ? (
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">Transcribing…</span>
        </div>
      ) : (
        <button
          onClick={startRecording}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          title={mode === "meeting" ? "Record meeting" : "Add voice note"}
        >
          <Mic size={13} />
          {mode === "meeting" ? "Record Meeting" : "Voice Note"}
        </button>
      )}
    </div>
  );
};

export default VoiceRecorder;
