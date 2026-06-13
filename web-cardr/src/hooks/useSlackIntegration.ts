import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface SlackSettings {
  channel_id: string;
  channel_name: string;
  notify_new_contact: boolean;
  notify_follow_up: boolean;
}

interface SlackChannel {
  id: string;
  name: string;
}

export function useSlackIntegration() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SlackSettings | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [connected, setConnected] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; team?: string; bot?: string } | null>(null);

  // Load settings from DB
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("slack_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          channel_id: (data as any).channel_id,
          channel_name: (data as any).channel_name,
          notify_new_contact: (data as any).notify_new_contact,
          notify_follow_up: (data as any).notify_follow_up,
        });
        setConnected(true);
      }
      setLoading(false);
    })();
  }, [user]);

  const testConnection = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke("slack-notify", {
        body: { action: "test" },
      });
      if (error) throw error;
      setTestResult(data);
      return data;
    } catch (err) {
      console.error("Test connection error:", err);
      return null;
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-notify", {
        body: { action: "list_channels" },
      });
      if (error) throw error;
      setChannels(data.channels || []);
    } catch (err) {
      console.error("Fetch channels error:", err);
      toast.error("Failed to fetch Slack channels");
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: SlackSettings) => {
    if (!user) return;
    try {
      const payload = {
        user_id: user.id,
        channel_id: newSettings.channel_id,
        channel_name: newSettings.channel_name,
        notify_new_contact: newSettings.notify_new_contact,
        notify_follow_up: newSettings.notify_follow_up,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("slack_settings" as any)
        .upsert(payload as any, { onConflict: "user_id" });

      if (error) throw error;
      setSettings(newSettings);
      setConnected(true);
      toast.success("Slack settings saved");
    } catch (err) {
      console.error("Save settings error:", err);
      toast.error("Failed to save Slack settings");
    }
  }, [user]);

  const disconnect = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("slack_settings" as any)
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      setSettings(null);
      setConnected(false);
      toast.success("Slack disconnected");
    } catch (err) {
      console.error("Disconnect error:", err);
      toast.error("Failed to disconnect Slack");
    }
  }, [user]);

  const notifyNewContact = useCallback(async (contact: {
    name: string; company: string; title: string; email: string;
  }) => {
    try {
      await supabase.functions.invoke("slack-notify", {
        body: {
          action: "notify_new_contact",
          contact_name: contact.name,
          contact_company: contact.company,
          contact_title: contact.title,
          contact_email: contact.email,
        },
      });
    } catch (err) {
      console.error("Slack notify error:", err);
    }
  }, []);

  const notifyFollowUp = useCallback(async (contact: {
    name: string; company: string; follow_up_date: string; next_step: string;
  }) => {
    try {
      await supabase.functions.invoke("slack-notify", {
        body: {
          action: "notify_follow_up",
          contact_name: contact.name,
          contact_company: contact.company,
          follow_up_date: contact.follow_up_date,
          next_step: contact.next_step,
        },
      });
    } catch (err) {
      console.error("Slack follow-up notify error:", err);
    }
  }, []);

  return {
    settings, channels, loading, loadingChannels,
    connected, testResult,
    testConnection, fetchChannels, saveSettings, disconnect,
    notifyNewContact, notifyFollowUp,
  };
}
