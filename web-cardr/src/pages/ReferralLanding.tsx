import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { hidePaidSurfaces } from "@/lib/iosCompliance";

const ReferralLanding = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const onNative = hidePaidSurfaces();

  useEffect(() => {
    if (onNative) return; // don't process referral on native builds
    if (!code) {
      navigate("/");
      return;
    }

    // Track the click
    supabase.functions
      .invoke("track-referral-click", { body: { referral_code: code } })
      .catch(() => {});

    // Store referral code in localStorage (30-day cookie window)
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem("referral_code", code.toLowerCase());
    localStorage.setItem("referral_expiry", String(expiry));

    // Redirect to signup
    navigate("/auth?ref=" + code);
  }, [code, navigate, onNative]);

  if (onNative) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="card-elevated max-w-sm w-full p-6 text-center">
          <h1 className="text-lg font-display font-bold text-foreground mb-2">Open this link on the web</h1>
          <p className="text-sm text-muted-foreground">
            Referral invitations are managed on cardr.ai. Open this link in your browser to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
};

export default ReferralLanding;

