import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "cardscanpro_active_event_id";

export interface ActiveEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
}

/**
 * Hook for the "currently active" event the user is collecting contacts for.
 * Persists across sessions in localStorage and exposes a list of recent events.
 */
export const useActiveEvent = () => {
  const { user } = useAuth();
  const [activeEventId, setActiveEventIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to read active event from localStorage:", err);
      return null;
    }
  });
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Load user's events
  const refresh = useCallback(async () => {
    if (!user) {
      setEvents([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, title, start_date, end_date, location")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false });
    if (!error && data) {
      setEvents(data as ActiveEvent[]);
      // Clear stale active id if it no longer exists
      if (activeEventId && !data.some((e) => e.id === activeEventId)) {
        setActiveEventIdState(null);
        try { localStorage.removeItem(STORAGE_KEY); } catch (err) { console.warn("Failed to remove active event from localStorage:", err); }
      }
    }
    setLoading(false);
  }, [user, activeEventId]);

  useEffect(() => {
    refresh();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveEventId = useCallback((id: string | null) => {
    setActiveEventIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to set/remove active event in localStorage:", err);
    }
  }, []);

  const activeEvent = events.find((e) => e.id === activeEventId) || null;

  /**
   * Link a contact to the currently active event (no-op if none selected).
   */
  const linkContactToActiveEvent = useCallback(
    async (contactId: string): Promise<boolean> => {
      if (!user || !activeEventId) return false;
      const { error } = await supabase.from("event_contacts").insert({
        event_id: activeEventId,
        contact_id: contactId,
        user_id: user.id,
      });
      if (error) {
        console.warn("Failed to link contact to event:", error);
        return false;
      }
      return true;
    },
    [user, activeEventId]
  );

  /**
   * Create a brand-new event and immediately make it the active one.
   * Returns the created event row, or null on failure.
   */
  const createEvent = useCallback(
    async (input: { title: string; start_date?: string; location?: string | null }): Promise<ActiveEvent | null> => {
      if (!user) return null;
      const title = input.title.trim();
      if (!title) return null;
      const { data, error } = await supabase
        .from("events")
        .insert({
          user_id: user.id,
          title,
          start_date: input.start_date ?? new Date().toISOString(),
          location: input.location ?? "",
        })
        .select("id, title, start_date, end_date, location")
        .single();
      if (error || !data) {
        console.warn("Failed to create event:", error);
        return null;
      }
      const ev = data as ActiveEvent;
      setEvents((prev) => [ev, ...prev]);
      setActiveEventIdState(ev.id);
      try { localStorage.setItem(STORAGE_KEY, ev.id); } catch (err) { console.warn("Failed to save active event to localStorage:", err); }
      return ev;
    },
    [user]
  );

  return {
    activeEventId,
    activeEvent,
    setActiveEventId,
    events,
    loading,
    refresh,
    linkContactToActiveEvent,
    createEvent,
  };
};
