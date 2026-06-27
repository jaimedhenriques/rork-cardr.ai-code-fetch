import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Sparkles, Check, AlertCircle } from "lucide-react";

type Status = "verifying" | "ready" | "error";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("verifying");

  useEffect(() => {
    let active = true;

    const markReady = () => {
      if (active) setStatus("ready");
    };
    const markError = () => {
      if (active) setStatus("error");
    };

    // (3) Implicit hash flow — the client auto-detects and emits PASSWORD_RECOVERY.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markReady();
    });

    // Supabase can deliver the recovery link in several formats depending on the
    // project's email template / auth flow. Handle all of them:
    //   1. ?code=...                       (PKCE flow)
    //   2. ?token_hash=...&type=recovery   (newer email templates)
    //   3. #access_token=...&type=recovery (implicit/hash flow)
    const verify = async () => {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errorDescription =
        url.searchParams.get("error_description") ?? hashParams.get("error_description");
      if (errorDescription) {
        markError();
        return;
      }

      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          markReady();
          return;
        }
        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;
          markReady();
          return;
        }
        if (window.location.hash.includes("type=recovery")) {
          markReady();
          return;
        }
        // If a session already exists (event may have fired first), allow the reset.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          markReady();
          return;
        }
        markError();
      } catch {
        markError();
      }
    };

    verify();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      navigate("/");
    }
  };

  if (status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-4">
            <Sparkles size={24} className="text-primary" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground mb-2">
            Verifying reset link...
          </h1>
          <p className="text-sm text-muted-foreground">
            Please wait while we verify your password reset link.
          </p>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-6" />
        </motion.div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-destructive" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground mb-2">
            Reset link invalid or expired
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            This password reset link is no longer valid. Request a new one and try again.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Request a new link
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-4">
            <Sparkles size={24} className="text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Set New Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
        </div>

        <div className="card-elevated p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="input-field pl-10"
                minLength={6}
                required
              />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="input-field pl-10"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
              {!loading && <Check size={16} />}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
