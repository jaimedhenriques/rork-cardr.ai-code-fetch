import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Users, MapPin, Plus, ChevronRight, BarChart3, Sparkles, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  event_type: string;
  status: string;
};

const EventsDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeEventId, setActiveEventId } = useActiveEvent();

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events_dashboard", user?.id],
    queryFn: async () => {
      if (!user) return [] as EventRow[];
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, location, start_date, end_date, event_type, status")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as EventRow[];
    },
    enabled: !!user,
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["events_dashboard_counts", user?.id],
    queryFn: async () => {
      if (!user) return {};
      const { data, error } = await supabase
        .from("event_contacts")
        .select("event_id")
        .eq("user_id", user.id);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: { event_id: string }) => {
        map[r.event_id] = (map[r.event_id] || 0) + 1;
      });
      return map;
    },
    enabled: !!user,
  });

  const { upcoming, past, totalContacts } = useMemo(() => {
    const now = Date.now();
    const upcoming: EventRow[] = [];
    const past: EventRow[] = [];
    let total = 0;
    events.forEach((e) => {
      total += counts[e.id] || 0;
      if (new Date(e.start_date).getTime() >= now) upcoming.push(e);
      else past.push(e);
    });
    upcoming.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    return { upcoming, past, totalContacts: total };
  }, [events, counts]);

  const renderCard = (e: EventRow) => {
    const count = counts[e.id] || 0;
    return (
      <Link
        key={e.id}
        to={`/app/events/${e.id}`}
        className="group block bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wide">
                {e.event_type}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {format(new Date(e.start_date), "MMM d, yyyy")}
              </span>
            </div>
            <h3 className="text-[15px] font-semibold text-foreground truncate">{e.title}</h3>
            {e.location && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 truncate">
                <MapPin size={11} className="shrink-0" /> {e.location}
              </p>
            )}
          </div>
          <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
        </div>
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <Users size={13} className="text-primary" />
            <span className="font-semibold tabular-nums">{count}</span>
            <span className="text-muted-foreground">contact{count === 1 ? "" : "s"}</span>
          </div>
          <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View list →
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 px-5 pt-5">
      <PageHeader title="Events" back="/app" />

      {/* Active event banner */}
      {(() => {
        const active = events.find((e) => e.id === activeEventId);
        if (!active) return null;
        return (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
            <Star size={16} className="text-emerald-600 fill-emerald-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Active event</p>
              <Link to={`/app/events/${active.id}`} className="text-sm font-semibold text-foreground truncate hover:underline block">
                {active.title}
              </Link>
            </div>
            <button
              onClick={() => { setActiveEventId(null); toast("Cleared active event"); }}
              className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
              aria-label="Clear active event"
            >
              <X size={14} />
            </button>
          </div>
        );
      })()}

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-wide font-semibold mb-1">
            <Calendar size={11} /> Total
          </div>
          <div className="text-xl font-bold text-foreground tabular-nums">{events.length}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-wide font-semibold mb-1">
            <Sparkles size={11} /> Upcoming
          </div>
          <div className="text-xl font-bold text-foreground tabular-nums">{upcoming.length}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-wide font-semibold mb-1">
            <Users size={11} /> Contacts
          </div>
          <div className="text-xl font-bold text-foreground tabular-nums">{totalContacts}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Your events</h2>
        <Button size="sm" onClick={() => navigate("/app/events/manage?new=1")} className="h-8">
          <Plus size={14} className="mr-1" /> New event
        </Button>
      </div>

      {eventsLoading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="text-center bg-card border border-dashed border-border rounded-2xl py-12 px-6">
          <BarChart3 size={28} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No events yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Create your first event to start grouping the contacts you scan.
          </p>
          <Button onClick={() => navigate("/app/events/manage?new=1")}>
            <Plus size={14} className="mr-1" /> Create event
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 tabular-nums">
                Upcoming · {upcoming.length}
              </h3>
              <div className="space-y-2.5">{upcoming.map(renderCard)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 tabular-nums">
                Past · {past.length}
              </h3>
              <div className="space-y-2.5">{past.map(renderCard)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default EventsDashboard;
