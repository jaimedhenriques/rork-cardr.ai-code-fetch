import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ExternalLink,
  TestTube,
  X,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { detectUnauthorized, onceSignedIn } from "@/lib/auth-errors";
import { LogIn } from "lucide-react";



type CredentialKey = "project_id" | "client_id" | "client_secret" | "webhook_secret";

interface CredentialStatus {
  environment: string;
  credentials: Record<CredentialKey, boolean>;
}

const CREDENTIALS: Array<{
  key: CredentialKey;
  label: string;
  secretName: string;
  hint: string;
  required: boolean;
}> = [
  {
    key: "project_id",
    label: "Project ID",
    secretName: "PIPEDREAM_PROJECT_ID",
    hint: "Found in Pipedream → Project Settings → General.",
    required: true,
  },
  {
    key: "client_id",
    label: "Client ID",
    secretName: "PIPEDREAM_CLIENT_ID",
    hint: "OAuth client ID from Project Settings → API.",
    required: true,
  },
  {
    key: "client_secret",
    label: "Client Secret",
    secretName: "PIPEDREAM_CLIENT_SECRET",
    hint: "OAuth client secret. Treat like a password.",
    required: true,
  },
  {
    key: "webhook_secret",
    label: "Webhook Signing Secret",
    secretName: "PIPEDREAM_WEBHOOK_SECRET",
    hint: "Used to verify Pipedream Connect webhook signatures.",
    required: false,
  },
];

/**
 * Read-only status panel for Pipedream credentials. Values themselves never
 * leave the server — we only fetch booleans indicating whether each secret is
 * set. The "Update" button takes the user to the Lovable secrets vault, which
 * is the only safe place to enter or rotate the values.
 */
export default function PipedreamCredentialsPanel() {
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tokenTest, setTokenTest] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "success"; data: Record<string, unknown> }
    | { state: "error"; message: string; unauthorized?: boolean; loginUrl?: string }
  >({ state: "idle" });

  const testToken = async () => {
    setTokenTest({ state: "loading" });
    try {
      const { data, error } = await supabase.functions.invoke(
        "pipedream-token",
        { body: {} },
      );
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data) {
        throw new Error(String((data as { error: string }).error));
      }
      setTokenTest({ state: "success", data: data as Record<string, unknown> });
    } catch (err) {
      const info = detectUnauthorized(err);
      setTokenTest({
        state: "error",
        message: info.message,
        unauthorized: info.unauthorized,
        loginUrl: info.loginUrl,
      });
      if (info.unauthorized) {
        // Auto-retry once the user signs in.
        onceSignedIn(() => {
          toast.info("Signed in — retrying token test…");
          testToken();
        });
      }
    }
  };


  const maskToken = (t: string) => {
    if (t.length <= 12) return "••••••";
    return `${t.slice(0, 6)}…${t.slice(-4)}`;
  };

  const load = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "pipedream-credentials-status",
        { body: {} },
      );
      if (error) throw error;
      setStatus(data as CredentialStatus);
    } catch (err) {
      console.error("[pipedream-credentials]", err);
      toast.error("Couldn't load credential status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load("initial");
  }, []);

  const openSecretsVault = () => {
    // The Lovable secrets vault is reached from the Cloud panel — there's no
    // direct deep link, so guide the user.
    toast.info("Open Lovable Cloud → Secrets to update Pipedream credentials", {
      duration: 6000,
      description:
        "Use the secret names shown below. Values are never exposed to the browser.",
    });
  };

  const allRequiredSet =
    status &&
    CREDENTIALS.filter((c) => c.required).every((c) => status.credentials[c.key]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
            <KeyRound className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Pipedream Credentials
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Server-side secrets used by Connect token, proxy, and webhook
              functions. Values stay in the Lovable secrets vault.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => load("refresh")}
          disabled={refreshing || loading}
          aria-label="Refresh status"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" /> Checking credentials…
        </div>
      ) : (
        <>
          {!allRequiredSet && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <ShieldAlert className="size-4 mt-0.5 shrink-0" />
              <p>
                One or more required credentials are missing. Pipedream
                integrations won't work until all three core values are set.
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {CREDENTIALS.map((c) => {
              const isSet = status?.credentials[c.key];
              return (
                <li
                  key={c.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {c.label}
                      </span>
                      {!c.required && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          optional
                        </span>
                      )}
                    </div>
                    <code className="text-[11px] text-muted-foreground font-mono">
                      {c.secretName}
                    </code>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.hint}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                      isSet
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {isSet ? <Check className="size-3" /> : <ShieldAlert className="size-3" />}
                    {isSet ? "Set" : "Missing"}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={openSecretsVault}>
              <KeyRound className="size-3.5" />
              Update credentials
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.open("https://pipedream.com/settings/projects", "_blank")
              }
            >
              <ExternalLink className="size-3.5" />
              Open Pipedream
            </Button>
            {status?.environment && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                Environment:{" "}
                <span className="font-mono text-foreground">
                  {status.environment}
                </span>
              </span>
            )}
          </div>

          {/* Token minting test */}
          <div className="mt-5 pt-5 border-t border-border/40">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TestTube className="size-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Test token minting
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={testToken}
                disabled={tokenTest.state === "loading"}
              >
                {tokenTest.state === "loading" ? (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                ) : (
                  <TestTube className="size-3.5 mr-1" />
                )}
                {tokenTest.state === "loading" ? "Running…" : "Run test"}
              </Button>
            </div>

            {tokenTest.state === "success" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Check className="size-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">
                    Token minted successfully
                  </span>
                </div>
                <dl className="space-y-1.5 text-xs">
                  {typeof tokenTest.data.token === "string" && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">Token</dt>
                      <dd className="font-mono text-foreground flex items-center gap-1.5">
                        <span title={tokenTest.data.token}>
                          {maskToken(tokenTest.data.token)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(tokenTest.data.token as string);
                            toast.success("Token copied");
                          }}
                          className="hover:text-primary transition-colors"
                          title="Copy full token"
                        >
                          <Copy className="size-3" />
                        </button>
                      </dd>
                    </div>
                  )}
                  {typeof tokenTest.data.expires_at === "string" && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">Expires</dt>
                      <dd className="font-mono text-foreground">
                        {new Date(tokenTest.data.expires_at).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {typeof tokenTest.data.environment === "string" && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">Environment</dt>
                      <dd className="font-mono text-foreground">
                        {tokenTest.data.environment}
                      </dd>
                    </div>
                  )}
                  {typeof tokenTest.data.external_user_id === "string" && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">User ID</dt>
                      <dd className="font-mono text-foreground truncate max-w-[12rem]">
                        {tokenTest.data.external_user_id}
                      </dd>
                    </div>
                  )}
                  {typeof tokenTest.data.app === "string" && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">App</dt>
                      <dd className="font-mono text-foreground">
                        {tokenTest.data.app}
                      </dd>
                    </div>
                  )}
                </dl>
              </motion.div>
            )}

            {tokenTest.state === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3"
              >
                <div className="flex items-start gap-2">
                  <X className="size-4 text-rose-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-rose-300">
                      {tokenTest.unauthorized ? "You're not signed in" : "Token minting failed"}
                    </span>
                    <p className="text-xs text-rose-200/80 mt-1 break-words">
                      {tokenTest.message}
                    </p>
                    {tokenTest.unauthorized && tokenTest.loginUrl && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={tokenTest.loginUrl}>
                            <LogIn className="size-3.5 mr-1" />
                            Sign in
                          </Link>
                        </Button>
                        <span className="text-[11px] text-rose-200/70">
                          We'll retry this test automatically once you're signed in.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

          </div>
        </>
      )}
    </motion.section>
  );
}
