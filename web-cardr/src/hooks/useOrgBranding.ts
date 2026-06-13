import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface OrgBranding {
  id: string;
  org_id: string;
  app_name: string;
  tagline: string;
  logo_url: string | null;
  favicon_url: string | null;
  splash_url: string | null;
  primary_color: string;
  accent_color: string;
}

const DEFAULT_BRANDING: Omit<OrgBranding, "id" | "org_id"> = {
  app_name: "Cardr",
  tagline: "Scan. Remember. Close.",
  logo_url: null,
  favicon_url: null,
  splash_url: null,
  primary_color: "217 91% 60%",
  accent_color: "280 80% 60%",
};

export const useOrgBranding = (orgId?: string) => {
  const { user } = useAuth();
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId || !user) { setBranding(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("org_branding")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    setBranding(data as OrgBranding | null);
    setLoading(false);
  }, [orgId, user]);

  useEffect(() => { load(); }, [load]);

  const saveBranding = useCallback(async (updates: Partial<Omit<OrgBranding, "id" | "org_id">>) => {
    if (!orgId || !user) return;
    if (branding) {
      const { error } = await supabase
        .from("org_branding")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", branding.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("org_branding")
        .insert({ org_id: orgId, ...DEFAULT_BRANDING, ...updates });
      if (error) throw error;
    }
    await load();
  }, [orgId, user, branding, load]);

  const uploadAsset = useCallback(async (file: File, type: "logo" | "favicon" | "splash") => {
    if (!orgId) throw new Error("No org");
    const ext = file.name.split(".").pop() || "png";
    const path = `${orgId}/${type}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("org-branding").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("org-branding").getPublicUrl(path);
    const field = type === "logo" ? "logo_url" : type === "favicon" ? "favicon_url" : "splash_url";
    await saveBranding({ [field]: urlData.publicUrl });
    return urlData.publicUrl;
  }, [orgId, saveBranding]);

  return {
    branding: branding ?? { ...DEFAULT_BRANDING, id: "", org_id: orgId ?? "" } as OrgBranding,
    hasCustomBranding: !!branding,
    loading,
    saveBranding,
    uploadAsset,
    reload: load,
  };
};
