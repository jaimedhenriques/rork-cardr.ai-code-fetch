import { useState, useEffect } from "react";
import { Calendar, X, Search, Link2, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
}

interface NoteEventLinkerProps {
  noteId: string;
  currentEventId: string | null;
  open: boolean;
  onClose: () => void;
  onLinked: (eventId: string | null, eventTitle: string) => void;
}

const NoteEventLinker = ({ noteId, currentEventId, open, onClose, onLinked }: NoteEventLinkerProps) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, location")
        .eq("user_id", user.id)
        .order("start_time", { ascending: false })
        .limit(50);
      if (data) setEvents(data);
      setLoading(false);
    };
    load();
  }, [open, user]);

  const linkEvent = async (event: CalendarEvent) => {
    if (!user) return;
    const { error } = await supabase
      .from("meeting_notes")
      .update({ calendar_event_id: event.id })
      .eq("id", noteId)
      .eq("user_id", user.id);
    if (!error) {
      toast.success(`Linked to "${event.title}"`);
      onLinked(event.id, event.title);
      onClose();
    } else {
      toast.error("Could not link event");
    }
  };

  const unlinkEvent = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("meeting_notes")
      .update({ calendar_event_id: null })
      .eq("id", noteId)
      .eq("user_id", user.id);
    if (!error) {
      toast.success("Event unlinked");
      onLinked(null, "");
      onClose();
    }
  };

  const filtered = events.filter((e) => {
    if (!search) return true;
    return e.title.toLowerCase().includes(search.toLowerCase());
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-t-3xl border border-border/60 p-5 pb-8 max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-primary" />
              <h3 className="text-base font-display font-bold text-foreground">Link Calendar Event</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {currentEventId && (
            <button
              onClick={unlinkEvent}
              className="w-full mb-3 p-3 rounded-xl bg-destructive/10 text-sm text-destructive font-semibold text-center hover:bg-destructive/20 transition-colors"
            >
              Remove current link
            </button>
          )}

          <div className="relative mb-4">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full h-9 rounded-xl bg-secondary border border-border pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="text-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events found</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((event) => (
                <button
                  key={event.id}
                  onClick={() => linkEvent(event)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                    currentEventId === event.id
                      ? "bg-primary/10 border border-primary/30"
                      : "card-elevated hover:bg-secondary/80"
                  }`}
                >
                  <Calendar size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(event.start_time), "MMM d, yyyy · h:mm a")}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                  {currentEventId === event.id && <Check size={14} className="text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NoteEventLinker;
