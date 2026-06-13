import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Mic, Square, Loader2, Sparkles, Pause, Play, FolderOpen, Trash2, Camera, Image as ImageIcon, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useRecording } from "@/context/RecordingContext";
import { toast } from "sonner";
import { triggerWebhooks } from "@/lib/webhook";
import { fireWebhook } from "@/lib/webhooks";

const GUEST_NOTES_KEY = "cardscanpro_guest_notes";
const DRAFT_KEY = "cardscanpro_note_draft";
const DRAFT_AUTOSAVE_MS = 10_000;

interface NoteDraft {
  title: string;
  body: string;
  transcript: string;
  duration: number;
  folderId: string | null;
  savedAt: number;
}

interface NoteCreateSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const NoteCreateSheet = ({ open, onClose, onCreated }: NoteCreateSheetProps) => {
  const navigate = useNavigate();
  const dragControls = useDragControls();
  const { user } = useAuth();
  const { folders } = useApp();
  const { startRecording: setGlobalRecording, stopRecording: clearGlobalRecording } = useRecording();
  const [title, setTitle] = useState("New Note");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [liveText, setLiveText] = useState("");
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef("");
  const recordingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const autosaveRef = useRef<NodeJS.Timeout | null>(null);
  const [recoveredDraft, setRecoveredDraft] = useState<NoteDraft | null>(null);

  const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Check for a recoverable draft on open
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as NoteDraft;
      // Only offer recovery if draft has actual content
      if (draft.transcript?.trim() || draft.body?.trim() || (draft.title && draft.title !== "New Note")) {
        setRecoveredDraft(draft);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [open]);

  const persistDraft = useCallback(() => {
    const transcript = fullTranscriptRef.current.trim();
    if (!transcript && !body.trim() && (!title.trim() || title === "New Note")) return;
    const draft: NoteDraft = {
      title,
      body,
      transcript,
      duration,
      folderId: selectedFolderId,
      savedAt: Date.now(),
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, [title, body, duration, selectedFolderId]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }, []);

  // Autosave loop while recording
  useEffect(() => {
    if (recording && !paused) {
      autosaveRef.current = setInterval(persistDraft, DRAFT_AUTOSAVE_MS);
      return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
    }
    if (autosaveRef.current) clearInterval(autosaveRef.current);
  }, [recording, paused, persistDraft]);

  // Persist on tab close / app background
  useEffect(() => {
    if (!recording) return;
    const handler = () => persistDraft();
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
      document.removeEventListener("visibilitychange", handler);
    };
  }, [recording, persistDraft]);

  const restoreDraft = useCallback(() => {
    if (!recoveredDraft) return;
    setTitle(recoveredDraft.title || "New Note");
    setBody(recoveredDraft.body || "");
    setSelectedFolderId(recoveredDraft.folderId || null);
    setDuration(recoveredDraft.duration || 0);
    fullTranscriptRef.current = recoveredDraft.transcript ? recoveredDraft.transcript + " " : "";
    setLiveText(recoveredDraft.transcript || "");
    setRecoveredDraft(null);
    toast.success("Draft restored");
  }, [recoveredDraft]);

  const dismissDraft = useCallback(() => {
    clearDraft();
    setRecoveredDraft(null);
  }, [clearDraft]);

  useEffect(() => {
    if (!open) {
      setTitle("New Note");
      setBody("");
      setRecording(false);
      setPaused(false);
      setDuration(0);
      setLiveText("");
      setImages([]);
      setShowAddMenu(false);
      setSelectedFolderId(null);
      setShowFolderPicker(false);
      fullTranscriptRef.current = "";
      recordingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    }
  }, [open]);

  // Clean up preview URLs
  useEffect(() => {
    return () => { images.forEach(img => URL.revokeObjectURL(img.preview)); };
  }, [images]);

  const startRec = useCallback(() => {
    if (!isSupported) { toast.error("Speech recognition not supported. Try Chrome."); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
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
      if (event.error === "no-speech" || event.error === "aborted") return;
      toast.error(`Recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (recordingRef.current && !paused) { try { recognition.start(); } catch {} }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
    setPaused(false);
    recordingRef.current = true;
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    setGlobalRecording(title || "New Note");
  }, [isSupported, paused, title, setGlobalRecording]);

  const togglePause = useCallback(() => {
    if (paused) {
      if (recognitionRef.current) { try { recognitionRef.current.start(); } catch {} }
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      setPaused(false);
    } else {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (timerRef.current) clearInterval(timerRef.current);
      setPaused(true);
    }
  }, [paused]);

  const doCancelRecording = useCallback(() => {
    setRecording(false);
    setPaused(false);
    recordingRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    if (timerRef.current) clearInterval(timerRef.current);
    setDuration(0);
    setLiveText("");
    fullTranscriptRef.current = "";
    clearGlobalRecording();
    clearDraft();
  }, [clearGlobalRecording, clearDraft]);

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const cancelRecording = useCallback(() => {
    const hasContent = fullTranscriptRef.current.trim().length > 0 || duration >= 3;
    if (hasContent) {
      setShowDiscardConfirm(true);
      return;
    }
    doCancelRecording();
  }, [duration, doCancelRecording]);

  const formatDur = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages(prev => [...prev, ...newImages]);
    setShowAddMenu(false);
    // Reset input so the same file can be picked again
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const summarizeWithAI = async (noteId: string, text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("meeting-notes", {
        body: { transcript: text, durationSeconds: duration },
      });
      if (error || !data?.notes) return;

      const updates: any = {};
      if (data.notes.summary) updates.summary = data.notes.summary;
      if (data.notes.keyTopics?.length) updates.key_topics = data.notes.keyTopics;
      if (data.notes.actionItems?.length) updates.action_items = data.notes.actionItems;
      if (data.notes.followUps?.length) updates.follow_ups = data.notes.followUps;
      if (data.notes.decisions?.length) updates.decisions = data.notes.decisions;

      if (user) {
        await supabase.from("meeting_notes").update(updates).eq("id", noteId).eq("user_id", user.id);
      } else {
        const notes = JSON.parse(localStorage.getItem(GUEST_NOTES_KEY) || "[]");
        const idx = notes.findIndex((n: any) => n.id === noteId);
        if (idx >= 0) {
          notes[idx] = { ...notes[idx], ...updates };
          localStorage.setItem(GUEST_NOTES_KEY, JSON.stringify(notes));
        }
      }
    } catch (err) {
      console.error("AI summarize error:", err);
    }
  };

  const save = async () => {
    if (recording) {
      recordingRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (timerRef.current) clearInterval(timerRef.current);
      clearGlobalRecording();
      await new Promise((r) => setTimeout(r, 500));
    }

    const transcript = fullTranscriptRef.current.trim();
    if (!title.trim() && !body.trim() && !transcript && images.length === 0) {
      toast.error("Add a title or some content");
      return;
    }

    setSaving(true);
    const noteData: any = {
      title: title.trim() || "Untitled Note",
      manual_notes: body.trim() || null,
      transcript: transcript || null,
      duration_seconds: duration,
      summary: null,
      key_topics: [],
      action_items: [],
      follow_ups: [],
      decisions: [],
      ...(selectedFolderId ? { folder_id: selectedFolderId } : {}),
    };

    const contentForAI = transcript || body.trim();
    const shouldSummarize = contentForAI && contentForAI.length >= 20;

    if (!user) {
      const notes = JSON.parse(localStorage.getItem(GUEST_NOTES_KEY) || "[]");
      const newNote = { ...noteData, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      localStorage.setItem(GUEST_NOTES_KEY, JSON.stringify([newNote, ...notes]));
      toast.success(shouldSummarize ? "Note saved! AI is analyzing…" : "Note saved!");
      triggerWebhooks("note.created", { id: newNote.id, title: newNote.title, hasTranscript: !!transcript, durationSeconds: duration, source: transcript ? "voice" : "manual" });
      if (transcript) triggerWebhooks("meeting.transcribed", { id: newNote.id, title: newNote.title, transcript, durationSeconds: duration });
      if (shouldSummarize) summarizeWithAI(newNote.id, `Title: ${noteData.title}\n\n${contentForAI}`);
      clearDraft();
      onCreated();
      onClose();
      navigate(`/notes/${newNote.id}`);
    } else {
      const { data, error } = await supabase.from("meeting_notes").insert({
        user_id: user.id, ...noteData,
      }).select().single();
      if (data) {
        // Upload images to storage if any
        if (images.length > 0) {
          for (const img of images) {
            const ext = img.file.name.split(".").pop() || "jpg";
            const path = `${user.id}/${data.id}/${crypto.randomUUID()}.${ext}`;
            await supabase.storage.from("meeting-attachments").upload(path, img.file);
          }
        }
        toast.success(shouldSummarize ? "Note saved! AI is analyzing…" : "Note saved!");
        triggerWebhooks("note.created", { id: data.id, title: data.title, hasTranscript: !!transcript, durationSeconds: duration, source: transcript ? "voice" : "manual" });
        fireWebhook("note.created", { id: data.id, title: data.title, hasTranscript: !!transcript, durationSeconds: duration, source: transcript ? "voice" : "manual" });
        if (transcript) triggerWebhooks("meeting.transcribed", { id: data.id, title: data.title, transcript, durationSeconds: duration });
        if (shouldSummarize) summarizeWithAI(data.id, `Title: ${noteData.title}\n\n${contentForAI}`);
        clearDraft();
        onCreated();
        onClose();
        navigate(`/notes/${data.id}`);
      } else {
        console.error(error);
        toast.error("Failed to save");
      }
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    cancelRecording();
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDiscard}
            className="fixed inset-0 bg-black/40 z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 300) {
                handleDiscard();
              }
            }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
          >
            <div className="bg-card rounded-t-3xl border-t border-border shadow-2xl flex flex-col" style={{ minHeight: "60vh", maxHeight: "92vh" }}>
              {/* Drag handle — only this area triggers swipe */}
              <div
                className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
              </div>

              {/* Top actions — media + discard */}
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center hover:bg-secondary transition-colors"
                    title="Take photo"
                  >
                    <Camera size={14} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center hover:bg-secondary transition-colors"
                    title="Add image"
                  >
                    <ImageIcon size={14} className="text-muted-foreground" />
                  </button>
                </div>
                <button onClick={handleDiscard} className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center hover:bg-secondary transition-colors">
                  <Trash2 size={14} className="text-muted-foreground" />
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImagePick}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImagePick}
              />

              {/* Recovery banner */}
              {recoveredDraft && (
                <div className="mx-5 mb-2 mt-1 rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
                  <Sparkles size={14} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">Unsaved draft found</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {recoveredDraft.transcript?.slice(0, 60) || recoveredDraft.body?.slice(0, 60) || recoveredDraft.title}
                      {(recoveredDraft.transcript?.length || 0) > 60 ? "…" : ""}
                    </p>
                  </div>
                  <button onClick={restoreDraft} className="text-xs font-semibold text-primary hover:underline shrink-0">
                    Restore
                  </button>
                  <button onClick={dismissDraft} className="text-xs text-muted-foreground hover:text-destructive shrink-0">
                    Discard
                  </button>
                </div>
              )}

              {/* Title */}
              <div className="px-5">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="New Note"
                  className="text-xl font-display font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40 w-full"
                  autoFocus
                />
              </div>

              {/* Folder button */}
              <div className="px-5 mt-2 relative">
                <button
                  onClick={() => setShowFolderPicker(!showFolderPicker)}
                  className={`flex items-center gap-2 text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                    selectedFolderId
                      ? "text-primary border-primary/30 bg-primary/5"
                      : "text-muted-foreground border-border hover:bg-secondary/60"
                  }`}
                >
                  <FolderOpen size={12} />
                  {selectedFolderId
                    ? folders.find(f => f.id === selectedFolderId)?.name || "Folder"
                    : "Add to folder"}
                  {selectedFolderId && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setSelectedFolderId(null); }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X size={10} />
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {showFolderPicker && folders.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-5 mt-1 z-10 w-48 rounded-xl bg-card border border-border shadow-lg overflow-hidden"
                    >
                      {folders.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => { setSelectedFolderId(f.id); setShowFolderPicker(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary transition-colors ${
                            selectedFolderId === f.id ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
                          }`}
                        >
                          <span>{f.emoji}</span>
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                {showFolderPicker && folders.length === 0 && (
                  <div className="absolute top-full left-5 mt-1 z-10 w-48 rounded-xl bg-card border border-border shadow-lg p-3">
                    <p className="text-xs text-muted-foreground">No folders yet. Create one in Contacts.</p>
                  </div>
                )}
              </div>

              {/* Image previews */}
              {images.length > 0 && (
                <div className="px-5 mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <div key={i} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-border">
                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center shadow-sm"
                      >
                        <X size={10} className="text-destructive-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Body / transcript area */}
              <div className="flex-1 px-5 mt-3 overflow-y-auto" style={{ minHeight: "200px", maxHeight: "40vh" }}>
                {recording || liveText ? (
                  <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {liveText || <span className="text-muted-foreground/50 italic">Listening… start speaking</span>}
                  </div>
                ) : (
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write notes here…"
                    className="w-full h-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none leading-relaxed"
                    style={{ minHeight: "180px" }}
                  />
                )}
              </div>

              {/* AI indicator */}
              {(body.trim().length >= 20 || fullTranscriptRef.current.trim().length >= 20) && !recording && (
                <div className="px-5 py-2">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Sparkles size={10} className="text-primary" /> AI will summarize on save
                  </span>
                </div>
              )}

              {/* Recording controls / Save bar */}
              <div className="px-5 pb-[max(calc(env(safe-area-inset-bottom,8px)+72px),88px)] pt-3 border-t border-border/40">
                {recording ? (
                  /* ── Active Recording Bar: Pause · Timer · Discard · Save ── */
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePause}
                      className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm active:scale-95 transition-transform shrink-0"
                      title={paused ? "Resume" : "Pause"}
                    >
                      {paused ? <Play size={16} className="fill-current" /> : <Pause size={16} />}
                    </button>

                    <div className="flex items-center gap-2 px-3 h-12 rounded-full bg-secondary/60 shrink-0">
                      <span className="text-sm font-mono font-semibold text-foreground tabular-nums">{formatDur(duration)}</span>
                      {!paused && (
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <motion.div
                              key={i}
                              animate={{ scaleY: [0.3, 1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                              className="w-0.5 h-4 bg-primary rounded-full origin-bottom"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={cancelRecording}
                      className="w-12 h-12 rounded-full bg-secondary text-muted-foreground hover:text-destructive text-xs font-semibold active:scale-95 transition-colors shrink-0 flex items-center justify-center"
                      title="Discard recording"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      onClick={save}
                      disabled={saving}
                      className="flex-1 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-[0.98]"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Square size={14} />
                          Stop & Save
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* ── Default Bar: Record + Add + Save ── */
                  <div className="flex items-center gap-2">
                    {/* Record button */}
                    {isSupported && (
                      <button
                        onClick={startRec}
                        className="w-12 h-12 rounded-full bg-destructive/10 border-2 border-destructive/30 flex items-center justify-center hover:bg-destructive/20 transition-colors active:scale-95"
                        title="Start recording"
                      >
                        <div className="w-4 h-4 rounded-full bg-destructive" />
                      </button>
                    )}

                    {/* Add menu (camera/image/comment) */}
                    <div className="relative">
                      <button
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors active:scale-95"
                      >
                        <Plus size={18} className="text-foreground" />
                      </button>

                      <AnimatePresence>
                        {showAddMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-14 left-0 bg-card border border-border rounded-xl shadow-lg py-1.5 w-44 z-10"
                          >
                            <button
                              onClick={() => { cameraInputRef.current?.click(); setShowAddMenu(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/60 transition-colors"
                            >
                              <Camera size={16} className="text-muted-foreground" />
                              Take photo
                            </button>
                            <button
                              onClick={() => { fileInputRef.current?.click(); setShowAddMenu(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/60 transition-colors"
                            >
                              <ImageIcon size={16} className="text-muted-foreground" />
                              Add image
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Save / Stop & Save */}
                    <button
                      onClick={save}
                      disabled={saving}
                      className="flex-1 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-[0.98]"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Saving…
                        </>
                      ) : liveText ? (
                        <>
                          <Square size={14} />
                          Stop & Save
                        </>
                      ) : (
                        "Save Note"
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Discard recording confirmation */}
          <AnimatePresence>
            {showDiscardConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-6"
                onClick={() => setShowDiscardConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.92, opacity: 0 }}
                  transition={{ type: "spring", damping: 22, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-card rounded-2xl border border-border shadow-2xl max-w-xs w-full p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Trash2 size={18} className="text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Discard recording?</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDur(duration)} of audio will be lost.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowDiscardConfirm(false)}
                      className="flex-1 h-10 rounded-full bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors"
                    >
                      Keep
                    </button>
                    <button
                      onClick={() => { setShowDiscardConfirm(false); doCancelRecording(); }}
                      className="flex-1 h-10 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Discard
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default NoteCreateSheet;
