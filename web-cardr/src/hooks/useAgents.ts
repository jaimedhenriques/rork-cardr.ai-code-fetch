import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface Agent {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  type: string;
  system_prompt: string;
  config: Record<string, any>;
  status: "active" | "paused";
  is_template: boolean;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  user_id: string;
  contact_id: string | null;
  status: "pending" | "running" | "complete" | "error";
  input: Record<string, any>;
  output: Record<string, any>;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export const useAgents = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const myAgents = useQuery({
    queryKey: ["agents", "mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Agent[];
    },
  });

  const templates = useQuery({
    queryKey: ["agents", "templates"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("is_template", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Agent[];
    },
  });

  const installTemplate = useMutation({
    mutationFn: async (template: Agent) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("agents")
        .insert({
          user_id: user.id,
          name: template.name,
          description: template.description,
          type: template.type,
          system_prompt: template.system_prompt,
          config: template.config,
          icon: template.icon,
          is_template: false,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Agent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", "mine"] }),
  });

  const createAgent = useMutation({
    mutationFn: async (
      input: Pick<Agent, "name" | "description" | "system_prompt"> & { config?: Record<string, any> }
    ) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("agents")
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description,
          system_prompt: input.system_prompt,
          config: input.config ?? {},
          type: "custom",
          icon: "Sparkles",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Agent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", "mine"] }),
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Agent> & { id: string }) => {
      const { error } = await supabase.from("agents").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  return { myAgents, templates, installTemplate, createAgent, updateAgent, deleteAgent };
};

export const useAgent = (id: string | undefined) => {
  return useQuery({
    queryKey: ["agent", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Agent | null;
    },
  });
};

export const useAgentRuns = (agentId: string | undefined) => {
  return useQuery({
    queryKey: ["agent-runs", agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AgentRun[];
    },
  });
};

/**
 * Recent runs across ALL of a user's agents — used by the activity feed
 * on the Agents page. Subscribes to realtime so new/updated runs appear
 * without refresh.
 */
export const useRecentAgentRuns = (limit = 25) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["agent-runs", "recent", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*, agents:agent_id(id,name,icon,type)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as (AgentRun & {
        agents: Pick<Agent, "id" | "name" | "icon" | "type"> | null;
      })[];
    },
  });

  // Realtime subscription — invalidate on any change to this user's runs.
  if (typeof window !== "undefined" && user) {
    // Lazy-attach a single channel per user; idempotent due to channel name.
    const channelName = `agent-runs-feed-${user.id}`;
    const existing = (window as any).__agentRunsChannels ??= new Set<string>();
    if (!existing.has(channelName)) {
      existing.add(channelName);
      supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "agent_runs", filter: `user_id=eq.${user.id}` },
          () => {
            qc.invalidateQueries({ queryKey: ["agent-runs", "recent", user.id] });
          },
        )
        .subscribe();
    }
  }

  return query;
};
