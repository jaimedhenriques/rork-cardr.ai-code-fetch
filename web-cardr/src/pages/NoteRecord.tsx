import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2, Pencil, AlertCircle, Pause, Play, Globe, LayoutTemplate, Phone, Volume2, MonitorSpeaker, Headphones, PictureInPicture2 } from "lucide-react";
import type { AudioSource } from "@/hooks/useAudioRecorder";
import { useDocumentPip } from "@/hooks/useDocumentPip";
import FloatingRecorder from "@/components/FloatingRecorder";
import { NOTE_TEMPLATES, NoteTemplate } from "@/lib/note-templates";
import PageHeader from "@/components/PageHeader";
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useRecording } from "@/context/RecordingContext";
import { useLanguage } from "@/context/LanguageContext";
import { TRANSCRIPTION_LANGUAGES } from "@/lib/translations";
import { triggerWebhooks } from "@/lib/webhook";
import TimerDisplay from "@/components/ui/timer-display";

const GUEST_NOTES_KEY = "cardscanpro_guest_notes";

// Human-readable call duration for the post-call success toast (e.g. "3m 12s").
const formatCallDuration = (seconds: number | null | undefined) => {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
};

const NoteRecord = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { startRecording: setGlobalRecording, stopRecording: clearGlobalRecording } = useRecording();
  const { transcriptionLang, setTranscriptionLang, t } = useLanguage();
  const [language, setLanguage] = useState(transcriptionLang);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const recorder = useAudioRecorder(language);
  const prefill = (location.state as any) || {};
  const [title, setTitle] = useState(prefill.prefillTitle || "");
  const [calendarEventId] = useState(prefill.calendarEventId || null);
  const [phoneNumber] = useState(prefill.phoneNumber || null);
  const [hasDialed, setHasDialed] = useState(false);
  const [manualNotes, setManualNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate>(() => {
    if (prefill.templateId) {
      const found = NOTE_TEMPLATES.find(t => t.id === prefill.templateId);
      if (found) return found;
    }
    return NOTE_TEMPLATES[0];
  });
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioSource>("mic");
  const autoStarted = useRef(false);
  const pip = useDocumentPip();

  const AUDIO_SOURCES: { id: AudioSource; label: string; hint: string; icon: typeof Mic }[] = [
    { id: "mic", label: t("noteRecord.sourceMic"), hint: t("noteRecord.sourceMicHint"), icon: Mic },
    { id: "system", label: t("noteRecord.sourceMeeting"), hint: t("noteRecord.sourceMeetingHint"), icon: MonitorSpeaker },
    { id: "both", label: t("noteRecord.sourceBoth"), hint: t("noteRecord.sourceBothHint"), icon: Headphones },
  ];

  // Auto-start recording when arriving from phone dialer
  useEffect(() => {
    if (prefill.autoRecord && !autoStarted.current && recorder.isSupported && !recorder.recording) {
      autoStarted.current = true;
      recorder.start("mic").then(() => {
        setGlobalRecording(title || "Recording…", prefill.contactName);
      }).catch(() => {
        toast.error(t("noteRecord.micError"));
      });
    }
  }, [prefill.autoRecord, recorder, title, prefill.contactName, setGlobalRecording]);

  const handleStart = useCallback(async () => {
    try {
      await recorder.start(audioSource);
      setGlobalRecording(title || "Recording…", prefill.contactName);
    } catch (e) {
      if (e instanceof Error && e.message === "no-system-audio") {
        toast.error(t("noteRecord.noSystemAudio"));
      } else {
        toast.error(audioSource === "mic" ? t("noteRecord.micError") : t("noteRecord.shareCancelled"));
      }
    }
  }, [recorder, title, prefill.contactName, setGlobalRecording, audioSource, t]);

  const handleStop = useCallback(async () => {
    pip.close();
    setProcessing(true);
    clearGlobalRecording();

    try {
      // 1. Stop recording
      setProcessingStep(t("noteRecord.finishingRecording"));
      const { audioBlob, transcript: webSpeechText, duration: finalDuration } = await recorder.stop();

      // 2. AI transcription (if we have audio)
      let finalTranscript = webSpeechText;
      let transcriptSource = "browser";

      if (audioBlob && audioBlob.size > 1000) {
        setProcessingStep(t("noteRecord.transcribingAI"));
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          formData.append("fallbackText", webSpeechText);
          formData.append("language", TRANSCRIPTION_LANGUAGES.find(l => l.code === language)?.label || language);
          formData.append("langCode", language);

          // Server-side transcription with real speaker diarization — returns a
          // Speaker 1 / Speaker 2 labelled transcript so the AI summary and the
          // saved note read like a real conversation.
          const url = `${SUPABASE_FUNCTIONS_URL}/transcribe-diarize`;
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: formData,
          });

          if (resp.ok) {
            const result = await resp.json();
            if (result.transcript) {
              finalTranscript = result.transcript;
              transcriptSource = result.source || "ai";
            }
          } else if (resp.status === 429 || resp.status === 402) {  // eslint-disable-line
            const err = await resp.json();
            toast.error(err.error || "AI service unavailable");
          }
        } catch (e) {
          console.error("AI transcription failed, using browser text:", e);
        }
      }

      // 3. Generate AI meeting notes (+ Granola-style enhancement of rough notes)
      let aiNotes: any = null;
      const trimmedManualNotes = manualNotes.trim();

      if ((finalTranscript?.trim().length ?? 0) + trimmedManualNotes.length > 10) {
        setProcessingStep(t("noteRecord.generatingInsights"));
        try {
          const { data, error } = await supabase.functions.invoke("meeting-notes", {
            body: {
              transcript: finalTranscript || undefined,
              manualNotes: trimmedManualNotes || undefined,
              durationSeconds: finalDuration,
              templateId: selectedTemplate.id,
            },
          });
          if (!error && data?.notes) aiNotes = data.notes;
        } catch (e) {
          console.error("AI notes error:", e);
        }
      }

      // 4. Save note
      setProcessingStep(t("noteRecord.saving"));
      const noteTitle = title || aiNotes?.keyTopics?.[0] || `Meeting ${new Date().toLocaleDateString()}`;
      const noteData: any = {
        title: noteTitle,
        transcript: finalTranscript || null,
        duration_seconds: finalDuration,
        summary: aiNotes?.summary || null,
        key_topics: aiNotes?.keyTopics || [],
        action_items: aiNotes?.actionItems || [],
        follow_ups: aiNotes?.followUps || [],
        decisions: aiNotes?.decisions || [],
        insights: aiNotes?.insights || [],
        mentioned_people: aiNotes?.mentionedPeople || [],
        open_questions: aiNotes?.openQuestions || [],
        manual_notes: manualNotes || null,
        enhanced_notes: typeof aiNotes?.enhancedNotes === "string" && aiNotes.enhancedNotes.trim() ? aiNotes.enhancedNotes : null,
        ...(calendarEventId ? { calendar_event_id: calendarEventId } : {}),
      };

      // If we have a prefilled contact (from phone dialer), ensure they're in mentioned_people
      if (prefill.contactName && !noteData.mentioned_people.some((p: any) => p.name === prefill.contactName)) {
        noteData.mentioned_people = [{ name: prefill.contactName, role: t("noteRecord.calledContact") }, ...noteData.mentioned_people];
      }

      if (!user) {
        const notes = JSON.parse(localStorage.getItem(GUEST_NOTES_KEY) || "[]");
        const newNote = { ...noteData, id: crypto.randomUUID(), created_at: new Date().toISOString() };
        localStorage.setItem(GUEST_NOTES_KEY, JSON.stringify([newNote, ...notes]));
        if (phoneNumber || prefill.contactName) {
          toast.success(`Call with ${prefill.contactName || phoneNumber} saved`, {
            description: `${formatCallDuration(finalDuration)}${transcriptSource === "ai" ? " · transcript & AI notes ready" : ""}`,
          });
        } else {
          toast.success(transcriptSource === "ai" ? t("noteRecord.aiSaved") : t("noteRecord.notesSaved"));
        }
        triggerWebhooks("note.created", { id: newNote.id, title: newNote.title, hasTranscript: !!finalTranscript, durationSeconds: finalDuration, source: "voice" });
        if (finalTranscript) triggerWebhooks("meeting.transcribed", { id: newNote.id, title: newNote.title, transcript: finalTranscript, durationSeconds: finalDuration, summary: aiNotes?.summary });
        navigate(`/notes/${newNote.id}`);
      } else {
        const { data, error } = await supabase
          .from("meeting_notes")
          .insert({ user_id: user.id, ...noteData })
          .select()
          .single();
        if (data) {
          // Auto-link the called contact as a participant
          if (prefill.contactId && prefill.contactName) {
            await supabase.from("meeting_participants").insert({
              meeting_note_id: data.id,
              user_id: user.id,
              name: prefill.contactName,
              contact_id: prefill.contactId,
            }).then(() => {});
          }
          if (phoneNumber || prefill.contactName) {
            toast.success(`Call with ${prefill.contactName || phoneNumber} saved`, {
              description: `${formatCallDuration(finalDuration)}${transcriptSource === "ai" ? " · transcript & AI notes ready" : ""}`,
            });
          } else {
            toast.success(transcriptSource === "ai" ? t("noteRecord.aiSaved") : t("noteRecord.notesSaved"));
          }
          triggerWebhooks("note.created", { id: data.id, title: data.title, hasTranscript: !!finalTranscript, durationSeconds: finalDuration, source: "voice" });
          if (finalTranscript) triggerWebhooks("meeting.transcribed", { id: data.id, title: data.title, transcript: finalTranscript, durationSeconds: finalDuration, summary: aiNotes?.summary });
          navigate(`/notes/${data.id}`);
        } else {
          console.error(error);
          toast.error(t("noteRecord.failedSave"));
          navigate("/notes");
        }
      }
    } catch (e) {
      console.error("Recording error:", e);
      toast.error(t("noteRecord.somethingWrong"));
    } finally {
      setProcessing(false);
    }
  }, [recorder, title, manualNotes, user, navigate, pip.close]);

  // Apple Voice Memos uses light-weight tabular digits — TimerDisplay handles formatting.

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col px-5 pt-12 pb-6">
        <PageHeader back="/notes" />

        {/* Language selector + title row */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative">
            <button
              onClick={() => !recorder.recording && setShowLangPicker(!showLangPicker)}
              disabled={recorder.recording}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Globe size={13} className="text-muted-foreground" />
              <span>{TRANSCRIPTION_LANGUAGES.find(l => l.code === language)?.flag || "🌐"}</span>
              <span className="hidden sm:inline">{TRANSCRIPTION_LANGUAGES.find(l => l.code === language)?.label || language}</span>
            </button>
            {showLangPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 mt-1 z-50 w-52 max-h-64 overflow-y-auto rounded-xl bg-card border border-border shadow-lg"
              >
                {TRANSCRIPTION_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      setTranscriptionLang(l.code);
                      setShowLangPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary transition-colors ${language === l.code ? "bg-primary/10 text-primary font-semibold" : "text-foreground"}`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("noteRecord.meetingTitle")}
            className="flex-1 text-lg font-display font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Audio source picker — mic, meeting (tab/system) audio, or both */}
        {recorder.isSystemAudioSupported && !phoneNumber && (
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-card border border-border">
              {AUDIO_SOURCES.map((s) => {
                const Icon = s.icon;
                const active = audioSource === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => !recorder.recording && setAudioSource(s.id)}
                    disabled={recorder.recording}
                    className={`relative flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${active ? "bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary"}`}
                  >
                    <Icon size={16} />
                    <span className="text-[11px] font-semibold leading-none">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 px-1 text-center">
              {AUDIO_SOURCES.find((s) => s.id === audioSource)?.hint}
            </p>
          </div>
        )}

        {/* Template selector */}
        <div className="relative mb-4">
          <button
            onClick={() => !recorder.recording && setShowTemplatePicker(!showTemplatePicker)}
            disabled={recorder.recording}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-card border border-border text-left hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-base">{selectedTemplate.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{selectedTemplate.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{selectedTemplate.description}</p>
            </div>
            <LayoutTemplate size={14} className="text-muted-foreground shrink-0" />
          </button>
          {showTemplatePicker && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-card border border-border shadow-lg overflow-hidden"
            >
              {NOTE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t); setShowTemplatePicker(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-secondary transition-colors ${selectedTemplate.id === t.id ? "bg-primary/10" : ""}`}
                >
                  <span className="text-base">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${selectedTemplate.id === t.id ? "text-primary font-semibold" : "text-foreground"}`}>{t.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Apple Voice Memos-style timer */}
        <div className="flex justify-center mb-4">
          <TimerDisplay
            seconds={recorder.duration}
            size="xl"
            active={recorder.recording}
            paused={recorder.paused}
          />
        </div>

        {/* Phone call dial banner — shown when recording a call */}
        <AnimatePresence>
          {phoneNumber && recorder.recording && !hasDialed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 p-4 rounded-2xl bg-accent/10 border border-accent/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <Volume2 size={14} className="text-accent" />
                <span className="text-xs font-semibold text-accent">{t("noteRecord.enableSpeaker")}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t("noteRecord.speakerHint")}
              </p>
              <button
                onClick={() => {
                  setHasDialed(true);
                  window.open(`tel:${phoneNumber}`, "_self");
                }}
                className="w-full h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center gap-2 font-semibold text-sm hover:opacity-90 transition-opacity active:scale-[0.98]"
              >
                <Phone size={16} />
                {t("noteRecord.dial")} {prefill.contactName || phoneNumber}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pop out to a floating always-on-top mini recorder (Chrome/Edge desktop) */}
        <AnimatePresence>
          {recorder.recording && pip.isSupported && !pip.pipWindow && (
            <motion.button
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onClick={() => pip.open()}
              className="mb-3 mx-auto flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors shadow-sm"
            >
              <PictureInPicture2 size={14} className="text-primary" />
              {t("noteRecord.popOut")}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Live transcript preview */}
        <div className="flex-1 bg-card rounded-2xl border border-border p-4 mb-4 overflow-y-auto min-h-[120px]">
          {recorder.liveText ? (
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{recorder.liveText}</p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">
              {recorder.recording
                ? recorder.isSpeechSupported
                  ? t("noteRecord.listening")
                  : t("noteRecord.recordingAudio")
                : t("noteRecord.pressRecord")}
            </p>
          )}
          {recorder.recording && !recorder.isSpeechSupported && (
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <AlertCircle size={12} />
              <span>{t("noteRecord.audioRecording")}</span>
            </div>
          )}
        </div>

        {/* Manual notes */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Pencil size={12} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">{t("noteRecord.yourNotes")}</span>
          </div>
          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder={t("noteRecord.writeNotes")}
            rows={3}
            className="w-full rounded-xl bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Controls */}
        <div className="flex justify-center pb-4">
          {processing ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center">
                <Loader2 size={24} className="text-primary animate-spin" />
              </div>
              <span className="text-sm text-muted-foreground font-medium">{processingStep}</span>
            </motion.div>
          ) : recorder.recording ? (
            <div className="flex items-center gap-4">
              {/* Pause / Resume */}
              <motion.button
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                onClick={recorder.paused ? recorder.resume : recorder.pause}
                className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center shadow-md hover:bg-secondary transition-colors"
              >
                {recorder.paused ? (
                  <Play size={18} className="text-primary ml-0.5" />
                ) : (
                  <Pause size={18} className="text-muted-foreground" />
                )}
              </motion.button>
              {/* Stop */}
              <motion.button
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                onClick={handleStop}
                className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors"
              >
                <Square size={20} className="text-destructive-foreground" />
              </motion.button>
            </div>
          ) : (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleStart}
              className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center shadow-glow"
            >
              {/* Pulse ring on idle for affordance */}
              <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
              <Mic size={28} className="text-primary-foreground relative" />
            </motion.button>
          )}
        </div>

        {!recorder.isSupported && (
          <p className="text-xs text-center text-destructive">
            {t("noteRecord.micUnavailable")}
          </p>
        )}
      </div>

      {/* Floating mini-recorder rendered into the PiP window */}
      {pip.pipWindow && recorder.recording && !processing && (
        <FloatingRecorder
          pipWindow={pip.pipWindow}
          title={title || t("noteRecord.recording")}
          duration={recorder.duration}
          paused={recorder.paused}
          liveText={recorder.liveText}
          notes={manualNotes}
          onNotesChange={setManualNotes}
          onPauseToggle={recorder.paused ? recorder.resume : recorder.pause}
          onStop={handleStop}
          strings={{
            listening: recorder.isSpeechSupported ? t("noteRecord.listening") : t("noteRecord.recordingAudio"),
            jotNotes: t("noteRecord.writeNotes"),
            stopSave: t("noteRecord.stopSave"),
            yourNotes: t("noteRecord.yourNotes"),
          }}
        />
      )}
    </div>
  );
};

export default NoteRecord;
