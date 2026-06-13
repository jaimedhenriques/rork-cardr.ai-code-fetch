import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface SequenceStep {
  id?: string;
  step_order: number;
  channel: "email" | "linkedin_message" | "linkedin_connection";
  delay_days: number;
  subject_template?: string | null;
  body_template: string;
}

export interface Sequence {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  tone: string;
  goal: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SequenceRun {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: string;
  current_step: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SequenceMessage {
  id: string;
  run_id: string;
  step_id: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
}

function fillPlaceholders(template: string, contact: any): string {
  if (!template) return "";
  return template
    .replace(/\{\{name\}\}/g, contact.name?.split(" ")[0] || "there")
    .replace(/\{\{full_name\}\}/g, contact.name || "")
    .replace(/\{\{company\}\}/g, contact.company || "your company")
    .replace(/\{\{title\}\}/g, contact.title || "your role")
    .replace(/\{\{industry\}\}/g, contact.industry || "your industry");
}

export function useSequences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["automation-sequences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_sequences")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sequence[];
    },
  });
}

export function useSequenceWithSteps(sequenceId: string | null) {
  return useQuery({
    queryKey: ["automation-sequence", sequenceId],
    enabled: !!sequenceId,
    queryFn: async () => {
      const [seqRes, stepsRes] = await Promise.all([
        supabase.from("automation_sequences").select("*").eq("id", sequenceId!).maybeSingle(),
        supabase
          .from("automation_sequence_steps")
          .select("*")
          .eq("sequence_id", sequenceId!)
          .order("step_order", { ascending: true }),
      ]);
      if (seqRes.error) throw seqRes.error;
      if (stepsRes.error) throw stepsRes.error;
      return { sequence: seqRes.data as Sequence, steps: (stepsRes.data || []) as SequenceStep[] };
    },
  });
}

export function useCreateSequence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      channel: string;
      tone: string;
      goal?: string;
      steps: Omit<SequenceStep, "id">[];
    }) => {
      if (!user) throw new Error("Not signed in");
      const { data: seq, error: seqErr } = await supabase
        .from("automation_sequences")
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description || null,
          channel: input.channel,
          tone: input.tone,
          goal: input.goal || null,
        })
        .select()
        .single();
      if (seqErr) throw seqErr;

      const stepsToInsert = input.steps.map((s) => ({
        sequence_id: seq.id,
        user_id: user.id,
        step_order: s.step_order,
        channel: s.channel,
        delay_days: s.delay_days,
        subject_template: s.subject_template || null,
        body_template: s.body_template,
      }));
      const { error: stepsErr } = await supabase
        .from("automation_sequence_steps")
        .insert(stepsToInsert);
      if (stepsErr) throw stepsErr;
      return seq as Sequence;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-sequences"] });
      toast.success("Sequence created");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create sequence"),
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-sequences"] });
      toast.success("Sequence deleted");
    },
  });
}

export function useGenerateSequence() {
  return useMutation({
    mutationFn: async (input: {
      goal: string;
      channel: string;
      tone: string;
      steps: number;
      audience?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-sequence", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.sequence as {
        name: string;
        description: string;
        steps: SequenceStep[];
      };
    },
    onError: (e: any) => toast.error(e.message || "AI generation failed"),
  });
}

/** Enrolls contacts into a sequence — generates personalized message drafts */
export function useEnrollContacts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sequenceId: string; contactIds: string[] }) => {
      if (!user) throw new Error("Not signed in");

      const { data: stepsData, error: stepsErr } = await supabase
        .from("automation_sequence_steps")
        .select("*")
        .eq("sequence_id", input.sequenceId)
        .order("step_order", { ascending: true });
      if (stepsErr) throw stepsErr;
      const steps = (stepsData || []) as SequenceStep[];
      if (!steps.length) throw new Error("Sequence has no steps");

      const { data: contactsData, error: cErr } = await supabase
        .from("contacts")
        .select("id, name, company, title, email, linkedin, industry")
        .in("id", input.contactIds);
      if (cErr) throw cErr;

      let enrolled = 0;
      for (const contact of contactsData || []) {
        const { data: run, error: runErr } = await supabase
          .from("automation_sequence_runs")
          .insert({
            sequence_id: input.sequenceId,
            contact_id: contact.id,
            user_id: user.id,
            status: "draft",
          })
          .select()
          .single();
        if (runErr) continue;

        const now = Date.now();
        const messages = steps.map((step) => ({
          run_id: run.id,
          step_id: step.id!,
          user_id: user.id,
          channel: step.channel,
          subject: step.subject_template ? fillPlaceholders(step.subject_template, contact) : null,
          body: fillPlaceholders(step.body_template, contact),
          status: "pending",
          scheduled_at: new Date(now + step.delay_days * 86400000).toISOString(),
        }));
        const { error: msgErr } = await supabase
          .from("automation_sequence_messages")
          .insert(messages);
        if (!msgErr) enrolled++;
      }
      return { enrolled };
    },
    onSuccess: ({ enrolled }) => {
      qc.invalidateQueries({ queryKey: ["sequence-runs"] });
      toast.success(`Enrolled ${enrolled} contact${enrolled === 1 ? "" : "s"}`);
    },
    onError: (e: any) => toast.error(e.message || "Failed to enroll contacts"),
  });
}

export function useSequenceRuns(sequenceId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sequence-runs", user?.id, sequenceId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("automation_sequence_runs")
        .select("*, contacts(id, name, company, avatar, email)")
        .order("created_at", { ascending: false });
      if (sequenceId) q = q.eq("sequence_id", sequenceId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useRunMessages(runId: string | null) {
  return useQuery({
    queryKey: ["run-messages", runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_sequence_messages")
        .select("*")
        .eq("run_id", runId!)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data || []) as SequenceMessage[];
    },
  });
}

export function useUpdateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body?: string; subject?: string; status?: string }) => {
      const patch: any = {};
      if (input.body !== undefined) patch.body = input.body;
      if (input.subject !== undefined) patch.subject = input.subject;
      if (input.status !== undefined) patch.status = input.status;
      const { error } = await supabase
        .from("automation_sequence_messages")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["run-messages"] });
    },
  });
}

export function useTriggerRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      // Mark run as approved + running. User triggers actual sends manually
      // (LinkedIn deep links / mailto from the UI). Mark messages "approved".
      const { error: rErr } = await supabase
        .from("automation_sequence_runs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", runId);
      if (rErr) throw rErr;

      const { error: mErr } = await supabase
        .from("automation_sequence_messages")
        .update({ status: "approved" })
        .eq("run_id", runId)
        .eq("status", "pending");
      if (mErr) throw mErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sequence-runs"] });
      qc.invalidateQueries({ queryKey: ["run-messages"] });
      toast.success("Sequence triggered — messages ready to send");
    },
    onError: (e: any) => toast.error(e.message || "Failed to trigger"),
  });
}

export function useMarkSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_sequence_messages")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run-messages"] }),
  });
}

export function useCancelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from("automation_sequence_runs")
        .update({ status: "cancelled" })
        .eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sequence-runs"] });
      toast.success("Run cancelled");
    },
  });
}
