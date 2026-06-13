import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface Proposal {
  id: string;
  user_id: string;
  contact_id: string | null;
  agent_run_id: string | null;
  title: string;
  html_content: string;
  structured_content: Record<string, any>;
  pdf_url: string | null;
  project_type: string | null;
  budget_range: string | null;
  timeline: string | null;
  pricing_structure: Record<string, any>;
  template_id: string | null;
  status: "draft" | "sent" | "viewed" | "won" | "lost";
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useProposals = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["proposals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Proposal[];
    },
  });

  const updateProposal = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Proposal> & { id: string }) => {
      const { error } = await supabase.from("proposals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
  });

  const deleteProposal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
  });

  return { list, updateProposal, deleteProposal };
};

export const useProposal = (id: string | undefined) => {
  return useQuery({
    queryKey: ["proposal", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Proposal | null;
    },
  });
};
