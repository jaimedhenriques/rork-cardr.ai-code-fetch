import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Json } from "@/integrations/supabase/types";

export interface CustomTemplateField {
  key: string;
  label: string;
  description: string;
  type: "list" | "text";
}

export interface CustomNoteTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  fields: CustomTemplateField[];
  guidance: string;
  /** Shared with the owner's organization. */
  isShared: boolean;
  /** Owned by the signed-in user (editable) vs. shared by a teammate. */
  isMine: boolean;
}

export interface SaveTemplateInput {
  id?: string;
  name: string;
  emoji: string;
  description: string;
  fields: CustomTemplateField[];
  guidance: string;
  isShared: boolean;
}

/** Derives a stable camelCase JSON key from a field label (e.g. "Red flags" → "redFlags"). */
export const makeFieldKey = (label: string): string => {
  const words = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("")
    .slice(0, 40);
  return /^[a-zA-Z]/.test(key) ? key : `f${key}`.slice(0, 40);
};

/** The payload the meeting-notes edge function expects for a user-defined template. */
export const buildCustomTemplatePayload = (tpl: CustomNoteTemplate) => ({
  name: tpl.name,
  guidance: tpl.guidance,
  fields: tpl.fields.map((f) => ({
    key: f.key,
    label: f.label,
    description: f.description,
    type: f.type,
  })),
});

const parseFields = (raw: Json): CustomTemplateField[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => {
      if (!f || typeof f !== "object" || Array.isArray(f)) return null;
      const obj = f as Record<string, Json | undefined>;
      const key = typeof obj.key === "string" ? obj.key : "";
      const label = typeof obj.label === "string" ? obj.label : "";
      if (!key || !label) return null;
      return {
        key,
        label,
        description: typeof obj.description === "string" ? obj.description : "",
        type: obj.type === "text" ? ("text" as const) : ("list" as const),
      };
    })
    .filter((f): f is CustomTemplateField => f !== null);
};

/** CRUD for the user's custom meeting-note templates, plus org-shared team templates. */
export const useCustomTemplates = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const membershipQuery = useQuery({
    queryKey: ["org-membership", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      return data?.org_id ?? null;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["custom-note-templates", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CustomNoteTemplate[]> => {
      // RLS returns own templates plus templates shared with the user's org.
      const { data, error } = await supabase
        .from("custom_note_templates")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        emoji: row.emoji || "📝",
        description: row.description || "",
        fields: parseFields(row.fields),
        guidance: row.guidance || "",
        isShared: row.is_shared === true,
        isMine: row.user_id === user!.id,
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (tpl: SaveTemplateInput): Promise<CustomNoteTemplate> => {
      const orgId = membershipQuery.data ?? null;
      const shared = tpl.isShared && !!orgId;
      const values = {
        name: tpl.name,
        emoji: tpl.emoji,
        description: tpl.description,
        fields: tpl.fields as unknown as Json,
        guidance: tpl.guidance,
        is_shared: shared,
        org_id: shared ? orgId : null,
        updated_at: new Date().toISOString(),
      };
      if (tpl.id) {
        const { data, error } = await supabase
          .from("custom_note_templates")
          .update(values)
          .eq("id", tpl.id)
          .select()
          .single();
        if (error) throw error;
        return { ...tpl, id: data.id, isShared: shared, isMine: true };
      }
      const { data, error } = await supabase
        .from("custom_note_templates")
        .insert({ ...values, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return { ...tpl, id: data.id, isShared: shared, isMine: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-note-templates"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_note_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-note-templates"] }),
  });

  const templates = templatesQuery.data ?? [];

  return {
    templates,
    myTemplates: templates.filter((t) => t.isMine),
    teamTemplates: templates.filter((t) => !t.isMine),
    /** The user's org id, or null when they're not in an organization. */
    orgId: membershipQuery.data ?? null,
    isLoading: templatesQuery.isLoading,
    saveTemplate: saveMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
    saving: saveMutation.isPending,
  };
};
