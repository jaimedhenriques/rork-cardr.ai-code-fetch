import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface BrandingState {
  appName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  isCustom: boolean;
}

const DEFAULTS: BrandingState = {
  appName: "Cardr",
  tagline: "Scan. Remember. Close.",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "217 91% 60%",
  accentColor: "280 80% 60%",
  isCustom: false,
};

const BrandingContext = createContext<BrandingState>(DEFAULTS);

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingState>(DEFAULTS);

  useEffect(() => {
    if (!user) { setBranding(DEFAULTS); return; }

    const load = async () => {
      // Find user's org
      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!membership?.org_id) { setBranding(DEFAULTS); return; }

      const { data } = await supabase
        .from("org_branding")
        .select("*")
        .eq("org_id", membership.org_id)
        .maybeSingle();

      if (data) {
        setBranding({
          appName: data.app_name || DEFAULTS.appName,
          tagline: data.tagline || DEFAULTS.tagline,
          logoUrl: data.logo_url,
          faviconUrl: data.favicon_url,
          primaryColor: data.primary_color || DEFAULTS.primaryColor,
          accentColor: data.accent_color || DEFAULTS.accentColor,
          isCustom: true,
        });
      } else {
        setBranding(DEFAULTS);
      }
    };

    load();
  }, [user]);

  // Apply custom CSS variables and favicon when branding changes
  useEffect(() => {
    if (branding.isCustom) {
      document.documentElement.style.setProperty("--primary", branding.primaryColor);
      document.documentElement.style.setProperty("--accent", branding.accentColor);

      // Update favicon
      if (branding.faviconUrl) {
        let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = branding.faviconUrl;
      }

      // Update document title
      document.title = branding.appName;
    } else {
      // Reset to defaults
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--accent");
      document.title = "Cardr";
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
};
