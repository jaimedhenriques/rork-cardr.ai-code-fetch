import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  CreditCard,
  Database,
  HardDrive,
  UserX,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Step = "warning" | "checklist" | "reauth" | "confirm" | "running" | "done" | "error";

const ACK_ITEMS = [
  { id: "data", label: "I understand all my contacts, notes, events, files and integrations will be permanently deleted" },
  { id: "billing", label: "I understand any active subscription will be cancelled and is not refundable" },
  { id: "noRecovery", label: "I understand this cannot be undone and support cannot recover my account" },
  { id: "exported", label: "I have already exported any data I want to keep (or I don't need any of it)" },
] as const;
type AckId = typeof ACK_ITEMS[number]["id"];
type PhaseId = "stripe" | "data" | "storage" | "auth";
type PhaseState = "pending" | "active" | "done" | "error";

interface Phase {
  id: PhaseId;
  label: string;
  description: string;
  icon: typeof CreditCard;
}

const PHASES: Phase[] = [
  {
    id: "stripe",
    label: "Cancelling subscription",
    description: "Stopping any active billing in Stripe",
    icon: CreditCard,
  },
  {
    id: "data",
    label: "Purging database records",
    description: "Contacts, notes, events, integrations, tags…",
    icon: Database,
  },
  {
    id: "storage",
    label: "Removing uploaded files",
    description: "Avatars, scans, exports, event passes",
    icon: HardDrive,
  },
  {
    id: "auth",
    label: "Deleting your account",
    description: "Final irreversible step",
    icon: UserX,
  },
];

const REQUIRED = "DELETE";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [step, setStep] = useState<Step>("warning");
  const [confirm, setConfirm] = useState("");
  const [acks, setAcks] = useState<Record<AckId, boolean>>({
    data: false,
    billing: false,
    noRecovery: false,
    exported: false,
  });
  const [password, setPassword] = useState("");
  const [emailEcho, setEmailEcho] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [phaseStates, setPhaseStates] = useState<Record<PhaseId, PhaseState>>({
    stripe: "pending",
    data: "pending",
    storage: "pending",
    auth: "pending",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [redirectIn, setRedirectIn] = useState(5);

  // Detect if the user signed up via password (vs OAuth like Google).
  const provider = (user?.app_metadata as any)?.provider as string | undefined;
  const isOAuthOnly = provider && provider !== "email";
  const allAcked = ACK_ITEMS.every((i) => acks[i.id]);

  useEffect(() => {
    // Don't bounce out once deletion has begun — running/done/error own the screen.
    if (!user && step === "warning") {
      navigate("/app/settings", { replace: true });
    }
  }, [user, navigate, step]);

  const setPhase = (id: PhaseId, state: PhaseState) =>
    setPhaseStates((prev) => ({ ...prev, [id]: state }));

  const handleReauth = async () => {
    if (!user?.email) return;
    setReauthError(null);

    if (isOAuthOnly) {
      // OAuth users: require typing their full email exactly to proceed.
      if (emailEcho.trim().toLowerCase() !== user.email.toLowerCase()) {
        setReauthError("Email does not match the account on file.");
        return;
      }
      setStep("confirm");
      return;
    }

    // Password users: re-verify credentials against Supabase.
    setReauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) {
        setReauthError("Incorrect password. Please try again.");
        return;
      }
      setPassword("");
      setStep("confirm");
    } catch (e) {
      setReauthError(e instanceof Error ? e.message : "Re-authentication failed.");
    } finally {
      setReauthLoading(false);
    }
  };

  // Walk the UI through phases on a timer while the single edge-function call
  // runs in the background. Each phase activates briefly so the user sees real
  // progress instead of one opaque spinner.
  const runDeletion = async () => {
    setStep("running");
    setErrorMsg(null);

    const phaseOrder: PhaseId[] = ["stripe", "data", "storage", "auth"];
    let cancelled = false;

    // Drive visible phase progression. The edge function may finish before or
    // after these ticks — we reconcile at the end.
    const tickPhase = async (id: PhaseId, ms: number) => {
      if (cancelled) return;
      setPhase(id, "active");
      await new Promise((r) => setTimeout(r, ms));
      if (cancelled) return;
      setPhase(id, "done");
    };

    const visualWalk = (async () => {
      for (const id of phaseOrder) {
        await tickPhase(id, 700);
      }
    })();

    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirm: REQUIRED },
      });

      // Wait for the visual walk to finish (or skip if request is much slower).
      await visualWalk;

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // Mark all phases done.
      phaseOrder.forEach((id) => setPhase(id, "done"));

      // Sign out BEFORE flipping to the success view so the indicator is truthful.
      try {
        await signOut();
      } catch {
        /* auth user already deleted server-side */
      }
      setSignedOut(true);
      setStep("done");

      toast.success("Account deleted", {
        description: "You have been signed out. Redirecting…",
      });

      // Visible countdown to home.
      let remaining = 5;
      setRedirectIn(remaining);
      const interval = setInterval(() => {
        remaining -= 1;
        setRedirectIn(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          window.location.href = "/";
        }
      }, 1000);
    } catch (e) {
      cancelled = true;
      const msg = e instanceof Error ? e.message : "Unknown error";
      // Whichever phase was active becomes the error.
      setPhaseStates((prev) => {
        const next = { ...prev };
        const activeId = phaseOrder.find((id) => next[id] === "active");
        if (activeId) next[activeId] = "error";
        return next;
      });
      setErrorMsg(msg);
      setStep("error");
      toast.error("Deletion failed", { description: msg });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => (step === "running" ? null : navigate("/app/settings"))}
            disabled={step === "running"}
            className="p-2 -ml-2 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-semibold text-foreground">Delete account</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <AnimatePresence mode="wait">
          {/* ── Step 1: Warning ───────────────────────────────────────────── */}
          {step === "warning" && (
            <motion.div
              key="warning"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="card-elevated p-5 border-l-4 border-destructive">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <ShieldAlert size={20} className="text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-bold text-foreground mb-1">
                      This action cannot be undone
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Deleting your account is permanent and immediate. There is no recovery
                      window and support cannot restore your data.
                    </p>
                  </div>
                </div>
              </div>

              <div className="card-elevated p-5">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">
                  What will be deleted
                </p>
                <ul className="space-y-2.5">
                  {[
                    "All saved contacts, notes, events, folders and tags",
                    "Uploaded files: avatars, business-card scans, CSV exports",
                    "Connected integrations (Pipedrive, Google Calendar, Pipedream, etc.)",
                    "Active Stripe subscriptions will be cancelled",
                    "Your login email — you will not be able to sign back in",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                      <X size={14} className="text-destructive mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-elevated p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-mono font-semibold text-foreground">{user?.email}</span>
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/app/settings")}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setStep("checklist")}
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Safety checklist ──────────────────────────────────── */}
          {step === "checklist" && (
            <motion.div
              key="checklist"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="card-elevated p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <ShieldCheck size={18} className="text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Safety checklist</h2>
                    <p className="text-xs text-muted-foreground">
                      Confirm each item to continue
                    </p>
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {ACK_ITEMS.map((item) => (
                    <li key={item.id}>
                      <label
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                          acks[item.id]
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-background/40 hover:bg-muted/40",
                        )}
                      >
                        <Checkbox
                          checked={acks[item.id]}
                          onCheckedChange={(v) =>
                            setAcks((p) => ({ ...p, [item.id]: v === true }))
                          }
                          className="mt-0.5"
                        />
                        <span className="text-sm text-foreground leading-snug">
                          {item.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <p className="text-[11px] text-muted-foreground mt-4 px-1">
                  {ACK_ITEMS.filter((i) => acks[i.id]).length}/{ACK_ITEMS.length} confirmed
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("warning")}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!allAcked}
                  onClick={() => setStep("reauth")}
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Re-authentication ─────────────────────────────────── */}
          {step === "reauth" && (
            <motion.div
              key="reauth"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="card-elevated p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <KeyRound size={18} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Verify it's you</h2>
                    <p className="text-xs text-muted-foreground">
                      {isOAuthOnly
                        ? "Re-type your account email to continue"
                        : "Re-enter your password to continue"}
                    </p>
                  </div>
                </div>

                {isOAuthOnly ? (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">
                      Account email
                    </label>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {user?.email}
                    </p>
                    <Input
                      type="email"
                      value={emailEcho}
                      onChange={(e) => {
                        setEmailEcho(e.target.value);
                        setReauthError(null);
                      }}
                      placeholder="you@example.com"
                      autoComplete="off"
                      autoFocus
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      You signed in with {provider}. Type your email exactly to confirm.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setReauthError(null);
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && password && !reauthLoading) handleReauth();
                      }}
                    />
                  </div>
                )}

                {reauthError && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <p className="text-xs text-destructive">{reauthError}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={reauthLoading}
                  onClick={() => {
                    setPassword("");
                    setEmailEcho("");
                    setReauthError(null);
                    setStep("checklist");
                  }}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={
                    reauthLoading ||
                    (isOAuthOnly ? !emailEcho.trim() : password.length < 1)
                  }
                  onClick={handleReauth}
                >
                  {reauthLoading ? (
                    <>
                      <Loader2 size={14} className="mr-2 animate-spin" /> Verifying…
                    </>
                  ) : (
                    "Verify & continue"
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Type DELETE ───────────────────────────────────────── */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="card-elevated p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertTriangle size={26} className="text-destructive" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">
                  Final confirmation
                </h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Type{" "}
                  <span className="font-mono font-bold text-destructive">{REQUIRED}</span> below
                  to permanently delete your account and all associated data.
                </p>
                <Input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={REQUIRED}
                  autoComplete="off"
                  autoFocus
                  className="font-mono text-center text-base tracking-widest"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setConfirm("");
                    setStep("reauth");
                  }}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={confirm !== REQUIRED}
                  onClick={runDeletion}
                >
                  Delete my account
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Running with phase indicator ──────────────────────── */}
          {(step === "running" || step === "done" || step === "error") && (
            <motion.div
              key="running"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="card-elevated p-6">
                <div className="flex items-center gap-3 mb-5">
                  {step === "running" && (
                    <>
                      <Loader2 size={20} className="text-primary animate-spin" />
                      <h2 className="text-base font-bold text-foreground">
                        Deleting your account…
                      </h2>
                    </>
                  )}
                  {step === "done" && (
                    <>
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <Check size={16} className="text-emerald-500" />
                      </div>
                      <h2 className="text-base font-bold text-foreground">
                        Account deleted
                      </h2>
                    </>
                  )}
                  {step === "error" && (
                    <>
                      <div className="w-7 h-7 rounded-full bg-destructive/15 flex items-center justify-center">
                        <X size={16} className="text-destructive" />
                      </div>
                      <h2 className="text-base font-bold text-foreground">
                        Deletion failed
                      </h2>
                    </>
                  )}
                </div>

                <ol className="space-y-3" aria-live="polite">
                  {PHASES.map((phase, idx) => {
                    const state = phaseStates[phase.id];
                    const Icon = phase.icon;
                    return (
                      <li
                        key={phase.id}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                          state === "pending" && "border-border bg-background/40 opacity-60",
                          state === "active" && "border-primary/50 bg-primary/5",
                          state === "done" && "border-emerald-500/30 bg-emerald-500/5",
                          state === "error" && "border-destructive/40 bg-destructive/5",
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            state === "pending" && "bg-muted text-muted-foreground",
                            state === "active" && "bg-primary/15 text-primary",
                            state === "done" && "bg-emerald-500/15 text-emerald-500",
                            state === "error" && "bg-destructive/15 text-destructive",
                          )}
                        >
                          {state === "active" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : state === "done" ? (
                            <Check size={14} />
                          ) : state === "error" ? (
                            <X size={14} />
                          ) : (
                            <Icon size={14} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              state === "done"
                                ? "text-emerald-500"
                                : state === "error"
                                  ? "text-destructive"
                                  : "text-foreground",
                            )}
                          >
                            {phase.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {phase.description}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono mt-1.5">
                          {idx + 1}/{PHASES.length}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {step === "done" && (
                  <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Check size={16} className="text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">
                          Deletion complete
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {signedOut
                            ? "You have been signed out on this device."
                            : "Signing you out…"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Redirecting to home in{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {redirectIn}s
                      </span>
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        window.location.href = "/";
                      }}
                    >
                      Go to home now
                    </Button>
                  </div>
                )}
                {step === "error" && errorMsg && (
                  <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive font-mono break-words">
                      {errorMsg}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => navigate("/app/settings")}
                    >
                      Back to settings
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default DeleteAccount;
