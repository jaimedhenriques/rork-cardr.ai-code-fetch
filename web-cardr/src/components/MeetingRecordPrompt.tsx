import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, Mic, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRecording } from "@/context/RecordingContext";
import { useLanguage } from "@/context/LanguageContext";

const DISMISSED_KEY = "cardr_meeting_prompts_dismissed";

const loadDismissed = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
};

interface StartingEvent {
  id: string;
  title: string;
  start_time: string;
  all_day: boolean | null;
}

/**
 * Granola-style meeting auto-detect: polls the user's calendar and, when an
 * event is starting (now ± a few minutes), shows a floating "Record this
 * meeting?" prompt that jumps straight into the recorder with the title and
 * event pre-linked. Dismissals stick for the browser session.
 */
const MeetingRecordPrompt = () => {
  const { user } = useAuth();
  const { isRecording } = useRecording();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);

  const inApp = location.pathname.startsWith("/app");
  const onRecordPage = location.pathname === "/app/notes/record";

  const { data: startingEvents = [] } = useQuery<StartingEvent[]>({
    queryKey: ["meeting_autodetect", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const from = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, all_day")
        .eq("user_id", user.id)
        .gte("start_time", from)
        .lte("start_time", to)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data as StartingEvent[]) ?? [];
    },
    enabled: !!user && inApp,
    refetchInterval: 60_000,
  });

  const event = useMemo(
    () => startingEvents.find((e) => !e.all_day && !dismissed.includes(e.id)) ?? null,
    [startingEvents, dismissed]
  );

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Session storage unavailable — prompt just reappears, harmless
    }
  };

  const startRecording = () => {
    if (!event) return;
    dismiss(event.id);
    navigate("/app/notes/record", {
      state: { prefillTitle: event.title, calendarEventId: event.id },
    });
  };

  if (!inApp || onRecordPage || isRecording) return null;

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
          className="fixed bottom-24 left-4 right-4 z-50 max-w-md mx-auto"
        >
          <div className="rounded-2xl border border-primary/25 bg-card shadow-xl shadow-primary/10 p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <CalendarClock size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {t("meetingPrompt.startingNow")} · {format(parseISO(event.start_time), "h:mm a")}
              </p>
              <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
            </div>
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity active:scale-[0.97] shrink-0"
            >
              <Mic size={13} />
              {t("meetingPrompt.record")}
            </button>
            <button
              onClick={() => dismiss(event.id)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MeetingRecordPrompt;
