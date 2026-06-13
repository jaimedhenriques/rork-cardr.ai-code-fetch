import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Check, Loader2, AlertTriangle, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const JoinOrg = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<any>(null);
  const [orgName, setOrgName] = useState("");
  const [status, setStatus] = useState<"loading" | "valid" | "expired" | "accepted" | "error">("loading");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    // Use secure RPC to look up invitation by token
    const { data, error } = await supabase
      .rpc("get_invitation_by_token", { _token: token! });

    if (error || !data || data.length === 0) {
      setStatus("error");
      return;
    }

    const inv = data[0];

    if (inv.accepted_at) {
      setStatus("accepted");
      return;
    }

    if (new Date(inv.expires_at) < new Date()) {
      setStatus("expired");
      return;
    }

    setInvitation({ ...inv, token: token! });
    setOrgName(inv.org_name || "Unknown Organization");
    setStatus("valid");
  };

  const handleJoin = async () => {
    if (!user || !invitation) return;
    setJoining(true);
    try {
      // Accept invitation via edge function
      const { data, error } = await supabase.functions.invoke("accept-org-invitation", {
        body: { token: invitation.token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Welcome to ${orgName}!`);
      navigate("/admin");
    } catch (err: any) {
      toast.error(err.message || "Failed to join organization");
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-6 w-full max-w-sm text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Building2 size={22} className="text-primary" />
        </div>

        {status === "valid" && (
          <>
            <h1 className="text-lg font-display font-bold text-foreground mb-1">
              Join {orgName}
            </h1>
            <p className="text-xs text-muted-foreground mb-1">
              You've been invited as a <strong className="text-primary">{invitation.role}</strong>
            </p>
            <p className="text-[11px] text-muted-foreground mb-6">
              Invitation for {invitation.email}
            </p>

            {!user ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Sign in to accept this invitation</p>
                <button
                  onClick={() => navigate(`/auth?redirect=/join/${token}`)}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                >
                  <LogIn size={14} /> Sign In to Join
                </button>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                {joining ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Accept & Join
              </button>
            )}
          </>
        )}

        {status === "accepted" && (
          <>
            <Check size={28} className="text-success mx-auto mb-3" />
            <h1 className="text-lg font-display font-bold text-foreground mb-1">Already Accepted</h1>
            <p className="text-xs text-muted-foreground mb-4">This invitation has already been used.</p>
            <button onClick={() => navigate("/admin")} className="btn-primary w-full text-sm">
              Go to Admin Panel
            </button>
          </>
        )}

        {status === "expired" && (
          <>
            <AlertTriangle size={28} className="text-warning mx-auto mb-3" />
            <h1 className="text-lg font-display font-bold text-foreground mb-1">Invitation Expired</h1>
            <p className="text-xs text-muted-foreground mb-4">This invitation is no longer valid. Ask your admin to resend it.</p>
            <button onClick={() => navigate("/")} className="btn-primary w-full text-sm">
              Go Home
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <AlertTriangle size={28} className="text-destructive mx-auto mb-3" />
            <h1 className="text-lg font-display font-bold text-foreground mb-1">Invalid Invitation</h1>
            <p className="text-xs text-muted-foreground mb-4">This invitation link is not valid.</p>
            <button onClick={() => navigate("/")} className="btn-primary w-full text-sm">
              Go Home
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default JoinOrg;
