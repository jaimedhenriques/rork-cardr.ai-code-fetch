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

/** CRUD for the user's custom meeting-note templates. */
export const useCustomTemplates = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ["custom-note-templates", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CustomNoteTemplate[]> => {
      const { data, error } = await supabase
        .from("custom_note_templates")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        emoji: row.emoji || "📝",
        description: row.description || "",
        fields: parseFields(row.fields),
        guidance: row.guidance || "",
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (tpl: Omit<CustomNoteTemplate, "id"> & { id?: string }): Promise<CustomNoteTemplate> => {
      const values = {
        name: tpl.name,
        emoji: tpl.emoji,
        description: tpl.description,
        fields: tpl.fields as unknown as Json,
        guidance: tpl.guidance,
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
        return { ...tpl, id: data.id } as CustomNoteTemplate;
      }
      const { data, error } = await supabase
        .from("custom_note_templates")
        .insert({ ...values, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return { ...tpl, id: data.id } as CustomNoteTemplate;
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

  return {
    templates: templatesQuery.data ?? [],
    isLoading: templatesQuery.isLoading,
    saveTemplate: saveMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
    saving: saveMutation.isPending,
  };
};
