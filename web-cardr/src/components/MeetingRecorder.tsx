import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Loader2, FileText, X, CheckCircle2, MessageSquare, ArrowRight, Lightbulb, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import TimerDisplay from "@/components/ui/timer-display";

interface MeetingRecorderProps {
  onTranscript: (text: string, summary: string) => void;
  open: boolean;
  onClose: () => void;
}

interface ActionItem {
  task: string;
  owner?: string | null;
  deadline?: string | null;
}

interface FollowUp {
  description: string;
  with?: string | null;
}

interface MeetingNotes {
  summary: string;
  keyTopics: string[];
  actionItems: ActionItem[];
  followUps: FollowUp[];
  decisions: string[];
}

const MeetingRecorder = ({ onTranscript, open, onClose }: MeetingRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [notes, setNotes] = useState<MeetingNotes | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef("");
  const recordingRef = useRef(false);

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
      toast.error("Speech recognition not supported. Try Chrome.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    fullTranscriptRef.current = "";
    setLiveText("");

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          fullTranscriptRef.current += event.results[i][0].transcript.trim() + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setLiveText(`${fullTranscriptRef.current}${interim}`.trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      if (event.error !== "aborted") {
        toast.error(`Recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (recordingRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
    recordingRef.current = true;
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, [isSupported]);

  const stopRecording = useCallback(() => {
    setTranscribing(true);
    setRecording(false);
    recordingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (timerRef.current) clearInterval(timerRef.current);

    setTimeout(async () => {
      const text = fullTranscriptRef.current.trim();
      if (text) {
        // Call AI to generate structured notes
        try {
          const { data, error } = await supabase.functions.invoke("meeting-notes", {
            body: { transcript: text, durationSeconds: duration },
          });
          if (error) throw error;
          if (data?.notes) {
            setNotes(data.notes);
            setShowNotes(true);
            const summary = data.notes.summary || text.slice(0, 200);
            onTranscript(text, summary);
            toast.success("Meeting notes generated!");
          } else {
            throw new Error("No notes returned");
          }
        } catch (e: any) {
          console.error("Meeting notes error:", e);
          // Fallback to basic summary
          const sentences = text.split(/[.!?]+/).filter(Boolean);
          const summary = sentences.length > 3
            ? `Meeting (${Math.floor(duration / 60)}m): ${sentences.slice(0, 3).join(". ").trim()}.`
            : `Meeting (${Math.floor(duration / 60)}m): ${text}`;
          onTranscript(text, summary);
          toast.error("AI summary unavailable — saved raw transcript.");
        }
      } else {
        toast.error("No speech detected during recording.");
      }
      setTranscribing(false);
      if (!showNotes) {
        setDuration(0);
        setLiveText("");
      }
    }, 800);
  }, [duration, onTranscript, onClose]);

  // Timer formatting handled by TimerDisplay component.

  const handleCloseNotes = () => {
    setShowNotes(false);
    setNotes(null);
    setDuration(0);
    setLiveText("");
    onClose();
  };

  const copyNotesAsText = async () => {
    if (!notes) return;
    const lines: string[] = [];
    lines.push("## Meeting Summary\n" + notes.summary);
    if (notes.keyTopics.length) lines.push("\n## Key Topics\n" + notes.keyTopics.map(t => `- ${t}`).join("\n"));
    if (notes.actionItems.length) lines.push("\n## Action Items\n" + notes.actionItems.map(a => `- [ ] ${a.task}${a.owner ? ` (${a.owner})` : ""}${a.deadline ? ` — by ${a.deadline}` : ""}`).join("\n"));
    if (notes.followUps.length) lines.push("\n## Follow-Ups\n" + notes.followUps.map(f => `- ${f.description}${f.with ? ` with ${f.with}` : ""}`).join("\n"));
    if (notes.decisions.length) lines.push("\n## Decisions\n" + notes.decisions.map(d => `- ${d}`).join("\n"));
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Notes copied!");
    } catch {
      toast.error("Could not copy notes.");
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
      >
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              <h2 className="text-lg font-display font-bold text-foreground">Meeting Recorder</h2>
            </div>
            <button
              onClick={() => {
                if (recording) stopRecording();
                else handleCloseNotes();
              }}
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {showNotes && notes ? (
            /* ── AI Notes View ── */
            <div className="flex-1 overflow-y-auto space-y-4 pb-20">
              {/* Summary */}
              <div className="card-elevated p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={14} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{notes.summary}</p>
              </div>

              {/* Key Topics */}
              {notes.keyTopics.length > 0 && (
                <div className="card-elevated p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare size={14} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Key Topics</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {notes.keyTopics.map((topic, i) => (
                      <span key={i} className="text-xs font-medium bg-primary-light text-primary rounded-full px-3 py-1">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items */}
              {notes.actionItems.length > 0 && (
                <div className="card-elevated p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={14} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Action Items</h3>
                  </div>
                  <div className="space-y-2.5">
                    {notes.actionItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-md border-2 border-primary/40 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">{item.task}</p>
                          {(item.owner || item.deadline) && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {item.owner && <span className="font-medium">{item.owner}</span>}
                              {item.owner && item.deadline && " · "}
                              {item.deadline && <span>by {item.deadline}</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-Ups */}
              {notes.followUps.length > 0 && (
                <div className="card-elevated p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight size={14} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Follow-Ups</h3>
                  </div>
                  <div className="space-y-2">
                    {notes.followUps.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <p className="text-sm text-foreground/80">
                          {f.description}
                          {f.with && <span className="text-primary font-medium"> — {f.with}</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {notes.decisions.length > 0 && (
                <div className="card-elevated p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={14} className="text-accent" />
                    <h3 className="text-sm font-semibold text-foreground">Decisions</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {notes.decisions.map((d, i) => (
                      <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                        <span className="text-accent mt-0.5">✓</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bottom actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={copyNotesAsText} className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy Notes"}
                </button>
                <button onClick={handleCloseNotes} className="flex-1 btn-primary text-sm">
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* ── Recording View ── */
            <>
              {/* Apple-style timer */}
              <div className="flex justify-center mb-6">
                <TimerDisplay seconds={duration} size="xl" active={recording} />
              </div>

              {/* Live transcript */}
              <div className="flex-1 bg-card rounded-2xl border border-border p-4 mb-6 overflow-y-auto">
                {liveText ? (
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{liveText}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">
                    {recording ? "Listening… start speaking" : "Press record to begin capturing the conversation"}
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-center pb-6">
                {transcribing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={24} className="text-primary animate-spin" />
                    <span className="text-sm text-muted-foreground">Generating AI summary…</span>
                  </div>
                ) : recording ? (
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors"
                  >
                    <Square size={20} className="text-destructive-foreground" />
                  </button>
                ) : (
                  <motion.button
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.3 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={startRecording}
                    className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center shadow-glow"
                  >
                    <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
                    <Mic size={28} className="text-primary-foreground relative" />
                  </motion.button>
                )}
              </div>

              {!isSupported && (
                <p className="text-xs text-center text-destructive">
                  Speech recognition is not supported in this browser. Please use Chrome.
                </p>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MeetingRecorder;
