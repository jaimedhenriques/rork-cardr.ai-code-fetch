import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface GoogleCalendarInfo {
  id: string;
  name: string;
  color: string;
  primary?: boolean;
  accessRole?: string;
}

interface SyncRecord {
  id: string;
  google_calendar_id: string;
  calendar_name: string;
  color: string;
  enabled: boolean;
  last_synced_at: string | null;
}

export function useGoogleCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedCalendars, setSyncedCalendars] = useState<SyncRecord[]>([]);
  const [availableCalendars, setAvailableCalendars] = useState<GoogleCalendarInfo[]>([]);

  const checkStatus = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke("gcal-auth", {
        body: { action: "get_status" },
      });
      if (error) throw error;
      setConnected(data.connected);
      setSyncedCalendars(data.calendars || []);
    } catch (e) {
      console.error("Failed to check Google Calendar status:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const startOAuth = useCallback(async () => {
    if (!user) return;
    try {
      const redirectUri = `${window.location.origin}/calendar`;
      const { data, error } = await supabase.functions.invoke("gcal-auth", {
        body: { action: "get_auth_url", redirect_uri: redirectUri },
      });
      if (error) throw error;
      // Open in same window for OAuth redirect
      window.location.href = data.url;
    } catch (e) {
      toast.error("Failed to start Google Calendar connection");
      console.error(e);
    }
  }, [user]);

  const exchangeCode = useCallback(async (code: string) => {
    if (!user) return null;
    try {
      setLoading(true);
      const redirectUri = `${window.location.origin}/calendar`;
      const { data, error } = await supabase.functions.invoke("gcal-auth", {
        body: { action: "exchange_code", code, redirect_uri: redirectUri },
      });
      if (error) throw error;
      setConnected(true);
      setAvailableCalendars(data.calendars || []);
      toast.success("Google Calendar connected!");
      return data.calendars;
    } catch (e) {
      toast.error("Failed to connect Google Calendar");
      console.error(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveCalendars = useCallback(async (calendars: GoogleCalendarInfo[]) => {
    try {
      const { error } = await supabase.functions.invoke("gcal-auth", {
        body: { action: "save_calendars", calendars },
      });
      if (error) throw error;
      toast.success("Calendar preferences saved");
      await checkStatus();
    } catch (e) {
      toast.error("Failed to save calendar preferences");
    }
  }, [checkStatus]);

  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke("gcal-auth", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      setConnected(false);
      setSyncedCalendars([]);
      setAvailableCalendars([]);
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      toast.success("Google Calendar disconnected");
    } catch (e) {
      toast.error("Failed to disconnect");
    }
  }, [queryClient]);

  const pullEvents = useCallback(async () => {
    if (!user || !connected) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("gcal-sync", {
        body: { action: "pull" },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      toast.success(`Synced ${data.pulled || 0} events from Google Calendar`);
    } catch (e) {
      toast.error("Failed to sync events");
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }, [user, connected, queryClient]);

  const pushEvent = useCallback(async (eventId: string, calendarId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("gcal-sync", {
        body: { action: "push_event", event_id: eventId, calendar_id: calendarId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      return data;
    } catch (e) {
      toast.error("Failed to push event to Google Calendar");
      console.error(e);
      return null;
    }
  }, [queryClient]);

  const deleteGoogleEvent = useCallback(async (eventId: string) => {
    try {
      await supabase.functions.invoke("gcal-sync", {
        body: { action: "delete_google_event", event_id: eventId },
      });
    } catch (e) {
      console.error("Failed to delete Google event:", e);
    }
  }, []);

  return {
    connected,
    loading,
    syncing,
    syncedCalendars,
    availableCalendars,
    setAvailableCalendars,
    startOAuth,
    exchangeCode,
    saveCalendars,
    disconnect,
    pullEvents,
    pushEvent,
    deleteGoogleEvent,
    checkStatus,
  };
}
