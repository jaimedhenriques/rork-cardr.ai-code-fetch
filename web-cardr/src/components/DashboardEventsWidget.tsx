import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Plus, ChevronRight, Users, Check } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { Badge } from "@/components/ui/badge";

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  status?: string;
}

const DashboardEventsWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeEventId, setActiveEventId } = useActiveEvent();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: ev } = await supabase
        .from("events")
        .select("id, title, start_date, end_date, location, status")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const list = (ev || []) as EventRow[];
      setEvents(list);

      // Fetch contact counts per event
      if (list.length > 0) {
        const { data: ec } = await supabase
          .from("event_contacts")
          .select("event_id")
          .eq("user_id", user.id)
          .in("event_id", list.map((e) => e.id));
        const map: Record<string, number> = {};
        for (const row of ec || []) {
          map[row.event_id] = (map[row.event_id] || 0) + 1;
        }
        setCounts(map);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  const now = new Date();
  const live = events.filter((e) => {
    const start = new Date(e.start_date);
    const end = e.end_date ? new Date(e.end_date) : start;
    return !isAfter(start, now) && !isBefore(end, now);
  });
  const upcoming = events.filter((e) => isAfter(new Date(e.start_date), now)).slice(0, 3);
  const recent = events
    .filter((e) => isBefore(new Date(e.end_date || e.start_date), now))
    .slice(0, 3);

  const featured = [...live, ...upcoming, ...recent].slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Your events</h3>
        </div>
        <button
          onClick={() => navigate("/events")}
          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          View all <ChevronRight size={11} />
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-4 animate-pulse">
          <div className="h-4 w-32 bg-muted rounded mb-2" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
      ) : events.length === 0 ? (
        <button
          onClick={() => navigate("/events")}
          className="w-full rounded-2xl border-2 border-dashed border-border bg-card hover:bg-muted/40 transition-colors p-5 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Plus size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Create your first event</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Group every contact you scan at a conference, meetup, or trip.
              </p>
            </div>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {featured.map((ev) => {
            const start = new Date(ev.start_date);
            const end = ev.end_date ? new Date(ev.end_date) : start;
            const isLive = !isAfter(start, now) && !isBefore(end, now);
            const isUpcoming = isAfter(start, now);
            const count = counts[ev.id] || 0;
            const isActive = activeEventId === ev.id;

            return (
              <div
                key={ev.id}
                className={`relative rounded-2xl border p-3.5 bg-card transition-all ${
                  isActive ? "border-primary shadow-sm ring-1 ring-primary/20" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <button
                    onClick={() => navigate(`/events?selected=${ev.id}`)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm font-semibold text-foreground truncate">{ev.title}</p>
                  </button>
                  {isLive && (
                    <Badge className="text-[9px] py-0 h-4 px-1.5 bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/15">
                      LIVE
                    </Badge>
                  )}
                  {isUpcoming && !isLive && (
                    <Badge variant="outline" className="text-[9px] py-0 h-4 px-1.5">Soon</Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground mb-1">
                  <CalendarDays size={10} />
                  <span>{format(start, "MMM d")}{ev.end_date ? ` – ${format(end, "MMM d")}` : ""}</span>
                </div>
                {ev.location && (
                  <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground mb-2 truncate">
                    <MapPin size={10} className="shrink-0" />
                    <span className="truncate">{ev.location}</span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                    <Users size={11} className="text-primary" />
                    {count} {count === 1 ? "contact" : "contacts"}
                  </div>
                  <button
                    onClick={() => setActiveEventId(isActive ? null : ev.id)}
                    className={`flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                    title={isActive ? "Stop scanning into this event" : "Make this the active event for new scans"}
                  >
                    {isActive ? <><Check size={10} /> Active</> : "Set active"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default DashboardEventsWidget;
