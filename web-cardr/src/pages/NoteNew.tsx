import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Sparkles, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { triggerWebhooks } from "@/lib/webhook";
import { fireWebhook } from "@/lib/webhooks";

const GUEST_NOTES_KEY = "cardscanpro_guest_notes";

const NoteNew = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const summarizeWithAI = async (noteId: string, text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("meeting-notes", {
        body: { transcript: text, durationSeconds: 0 },
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
    if (!title.trim() && !body.trim()) { toast.error(t("noteNew.addTitleOrNotes")); return; }
    setSaving(true);
    const noteData = {
      title: title.trim() || t("notes.untitledMeeting"),
      manual_notes: body.trim() || null,
      transcript: null,
      duration_seconds: 0,
      summary: null,
      key_topics: [],
      action_items: [],
      follow_ups: [],
      decisions: [],
    };

    if (!user) {
      const notes = JSON.parse(localStorage.getItem(GUEST_NOTES_KEY) || "[]");
      const newNote = { ...noteData, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      localStorage.setItem(GUEST_NOTES_KEY, JSON.stringify([newNote, ...notes]));
      toast.success(t("noteNew.saved"));
      triggerWebhooks("note.created", { id: newNote.id, title: newNote.title, manualNotes: newNote.manual_notes, source: "manual" });
      // Fire AI summarization in background
      if (body.trim().length >= 20) {
        summarizeWithAI(newNote.id, `Title: ${noteData.title}\n\n${body.trim()}`);
      }
      navigate(`/notes/${newNote.id}`);
    } else {
      const { data, error } = await supabase.from("meeting_notes").insert({
        user_id: user.id, ...noteData,
      }).select().single();
      if (data) {
        toast.success(t("noteNew.saved"));
        triggerWebhooks("note.created", { id: data.id, title: data.title, manualNotes: data.manual_notes, source: "manual" });
        fireWebhook("note.created", { id: data.id, title: data.title, manualNotes: data.manual_notes, source: "manual" });
        // Fire AI summarization in background
        if (body.trim().length >= 20) {
          summarizeWithAI(data.id, `Title: ${noteData.title}\n\n${body.trim()}`);
        }
        navigate(`/notes/${data.id}`);
      } else {
        console.error(error);
        toast.error(t("noteNew.failedSave"));
      }
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col px-5 pt-12 pb-6">
        <PageHeader back="/notes" rightContent={
          <div className="flex items-center gap-2">
            {body.trim().length >= 20 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Sparkles size={10} className="text-primary" /> {t("noteNew.aiWillSummarize")}
              </span>
            )}
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? t("noteNew.saving") : t("noteNew.save")}
            </button>
          </div>
        } />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("noteNew.newNote")}
          className="text-2xl font-display font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40 mb-4"
          autoFocus
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("noteNew.placeholder")}
          className="flex-1 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none leading-relaxed"
        />
      </div>
    </div>
  );
};

export default NoteNew;
