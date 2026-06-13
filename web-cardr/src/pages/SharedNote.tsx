import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lightbulb, MessageSquare, CheckCircle2, ArrowRight, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { useLanguage } from "@/context/LanguageContext";

interface SharedNoteData {
  title: string;
  summary: string | null;
  key_topics: string[];
  action_items: { task: string; owner?: string; deadline?: string }[];
  follow_ups: { description: string; with?: string }[];
  decisions: string[];
  manual_notes: string | null;
  created_at: string;
  duration_seconds: number | null;
}

const SharedNote = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useLanguage();
  const [note, setNote] = useState<SharedNoteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const { data: fnData, error } = await supabase.functions.invoke("get-shared-note", {
          body: { token },
        });
        if (error || !fnData?.note) {
          setLoading(false);
          return;
        }
        const data = fnData.note;
        setNote({
          ...data,
          key_topics: (data.key_topics as any[]) || [],
          action_items: (data.action_items as any[]) || [],
          follow_ups: (data.follow_ups as any[]) || [],
          decisions: (data.decisions as any[]) || [],
        } as SharedNoteData);
      } catch {
        // Note not found or server error
      }
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={20} className="text-primary animate-spin" /></div>;
  if (!note) return <div className="min-h-screen flex items-center justify-center px-5"><p className="text-sm text-muted-foreground">{t("sharedNote.notFound")}</p></div>;

  const formatDur = (s: number | null) => { if (!s) return ""; const m = Math.floor(s / 60); return m > 0 ? `${m} min` : `${s}s`; };

  return (
    <div className="min-h-screen pb-12 px-5 pt-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-6">
        <FileText size={18} className="text-primary" />
        <span className="text-xs font-semibold text-primary">{t("sharedNote.title")}</span>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-display font-bold text-foreground mb-1">{note.title || t("notes.untitledMeeting")}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
          <span>{format(parseISO(note.created_at), "MMM d, yyyy · h:mm a")}</span>
          {note.duration_seconds && note.duration_seconds > 0 && <span>· {formatDur(note.duration_seconds)}</span>}
        </div>
      </motion.div>

      <div className="space-y-4">
        {note.summary && (
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2"><Lightbulb size={14} className="text-primary" /><h3 className="text-sm font-semibold text-foreground">{t("sharedNote.summary")}</h3></div>
            <p className="text-sm text-foreground/80 leading-relaxed">{note.summary}</p>
          </div>
        )}
        {note.key_topics?.length > 0 && (
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3"><MessageSquare size={14} className="text-primary" /><h3 className="text-sm font-semibold text-foreground">{t("sharedNote.keyTopics")}</h3></div>
            <div className="flex flex-wrap gap-2">{note.key_topics.map((topic, i) => <span key={i} className="text-xs font-medium bg-primary-light text-primary rounded-full px-3 py-1">{topic}</span>)}</div>
          </div>
        )}
        {note.action_items?.length > 0 && (
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3"><CheckCircle2 size={14} className="text-primary" /><h3 className="text-sm font-semibold text-foreground">{t("sharedNote.actionItems")}</h3></div>
            <div className="space-y-2.5">{note.action_items.map((a, i) => (
              <div key={i} className="flex items-start gap-3"><div className="w-5 h-5 rounded-md border-2 border-primary/40 mt-0.5 shrink-0" /><div><p className="text-sm text-foreground">{a.task}</p>{(a.owner || a.deadline) && <p className="text-[11px] text-muted-foreground mt-0.5">{a.owner && <span className="font-medium">{a.owner}</span>}{a.owner && a.deadline && " · "}{a.deadline && <span>by {a.deadline}</span>}</p>}</div></div>
            ))}</div>
          </div>
        )}
        {note.follow_ups?.length > 0 && (
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3"><ArrowRight size={14} className="text-primary" /><h3 className="text-sm font-semibold text-foreground">{t("sharedNote.followUps")}</h3></div>
            <div className="space-y-2">{note.follow_ups.map((f, i) => <div key={i} className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" /><p className="text-sm text-foreground/80">{f.description}{f.with && <span className="text-primary font-medium"> — {f.with}</span>}</p></div>)}</div>
          </div>
        )}
        {note.decisions?.length > 0 && (
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3"><CheckCircle2 size={14} className="text-accent" /><h3 className="text-sm font-semibold text-foreground">{t("sharedNote.decisions")}</h3></div>
            <ul className="space-y-1.5">{note.decisions.map((d, i) => <li key={i} className="text-sm text-foreground/80 flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> {d}</li>)}</ul>
          </div>
        )}
        {note.manual_notes && (
          <div className="card-elevated p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">{t("sharedNote.notes")}</h3>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{note.manual_notes}</p>
          </div>
        )}
      </div>

      <div className="text-center mt-8"><p className="text-xs text-muted-foreground/50">{t("sharedNote.sharedVia")}</p></div>
    </div>
  );
};

export default SharedNote;
