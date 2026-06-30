import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { MailX, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_FUNCTIONS_URL}/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (res.ok && data.valid) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
    setProcessing(false);
  };

  const content: Record<Status, { icon: React.ReactNode; title: string; desc: string }> = {
    loading: { icon: <Loader2 size={40} className="animate-spin text-primary" />, title: t("unsub.loading"), desc: t("unsub.verifying") },
    valid: { icon: <MailX size={40} className="text-muted-foreground" />, title: t("unsub.unsubscribe"), desc: t("unsub.clickBelow") },
    already: { icon: <CheckCircle2 size={40} className="text-[hsl(var(--success))]" />, title: t("unsub.alreadyTitle"), desc: t("unsub.alreadyDesc") },
    invalid: { icon: <AlertCircle size={40} className="text-destructive" />, title: t("unsub.invalidTitle"), desc: t("unsub.invalidDesc") },
    success: { icon: <CheckCircle2 size={40} className="text-[hsl(var(--success))]" />, title: t("unsub.successTitle"), desc: t("unsub.successDesc") },
    error: { icon: <AlertCircle size={40} className="text-destructive" />, title: t("unsub.errorTitle"), desc: t("unsub.errorDesc") },
  };

  const c = content[status];

  return (
    <div className="min-h-screen flex items-center justify-center px-5 pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground">Cardr</h1>
          <p className="text-xs text-muted-foreground mt-1">{t("unsub.smartCapture")}</p>
        </div>
        <div className="card-elevated p-8 flex flex-col items-center gap-4">
          {c.icon}
          <h2 className="text-lg font-semibold text-foreground">{c.title}</h2>
          <p className="text-sm text-muted-foreground">{c.desc}</p>
          {status === "valid" && (
            <button
              onClick={handleUnsubscribe}
              disabled={processing}
              className="btn-primary mt-2 px-6 py-2.5 disabled:opacity-50"
            >
              {processing ? t("unsub.processing") : t("unsub.confirm")}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Unsubscribe;