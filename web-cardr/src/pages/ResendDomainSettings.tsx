import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Mail, Globe, Plus, RefreshCw, Loader2, Check, X, Copy, AlertTriangle,
  ShieldCheck, ExternalLink, Trash2, ChevronRight, Send, KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Resend domain record (DNS record returned by API)
interface DnsRecord {
  record: string;       // e.g. "SPF", "DKIM", "MX", "DMARC"
  name: string;         // hostname
  type: string;         // "TXT" | "MX" | "CNAME"
  ttl?: string | number;
  status?: string;      // "verified" | "pending" | "not_started"
  value: string;
  priority?: number;
}

interface Domain {
  id: string;
  name: string;
  status: string; // "not_started" | "pending" | "verified" | "failure" | "temporary_failure"
  region?: string;
  created_at?: string;
  records?: DnsRecord[];
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  verified: { label: "Verified", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  not_started: { label: "Not started", className: "bg-muted text-muted-foreground border-border" },
  failure: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/30" },
  temporary_failure: { label: "Retrying", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
};

const ResendDomainSettings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = usePlatformAdmin();

  const [loadingList, setLoadingList] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Domain | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [newDomain, setNewDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [currentFrom, setCurrentFrom] = useState<string>("");
  const [fromConfigured, setFromConfigured] = useState(false);
  const [fromFallback, setFromFallback] = useState<string | null>(null);
  const [fromInput, setFromInput] = useState("");

  const [connectorMissing, setConnectorMissing] = useState(false);

  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("resend-domain-admin", {
      body: { action, ...payload },
    });
    if (error) {
      // Try to read body for code
      const ctx: any = (error as any).context;
      let serverErr: any = null;
      try { serverErr = ctx?.body ? JSON.parse(ctx.body) : null; } catch { /* ignore */ }
      const msg = serverErr?.error || error.message || "Request failed";
      if (serverErr?.code === "no_resend_connection") setConnectorMissing(true);
      throw new Error(msg);
    }
    if ((data as any)?.error) {
      if ((data as any)?.code === "no_resend_connection") setConnectorMissing(true);
      throw new Error((data as any).error);
    }
    return data as any;
  };

  const refreshList = async () => {
    setLoadingList(true);
    try {
      const data = await call("list");
      const list: Domain[] = Array.isArray(data?.domains) ? data.domains : [];
      setDomains(list);
      setConnectorMissing(false);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't load domains");
    } finally {
      setLoadingList(false);
    }
  };

  const refreshDetail = async (id: string, silent = false) => {
    setLoadingDetail(true);
    try {
      const data = await call("get", { id });
      setSelectedDetail((data?.domain || null) as Domain | null);
      if (!silent) toast.success("Refreshed");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't load domain");
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshFrom = async () => {
    try {
      const data = await call("current_from");
      setCurrentFrom(data?.value || "");
      setFromConfigured(!!data?.configured);
      setFromFallback(data?.fallback || null);
      setFromInput(data?.value || "");
    } catch (e: any) {
      // Non-fatal
    }
  };

  useEffect(() => {
    if (!authLoading && !adminLoading && isAdmin) {
      refreshList();
      refreshFrom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, adminLoading, isAdmin]);

  useEffect(() => {
    if (selectedId) refreshDetail(selectedId, true);
    else setSelectedDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleCreate = async () => {
    const name = newDomain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) {
      toast.error("Enter a valid domain (e.g. send.example.com)");
      return;
    }
    setCreating(true);
    try {
      const data = await call("create", { name });
      toast.success(`Added ${name}`, { icon: "🌐" });
      setNewDomain("");
      const created = data?.domain;
      if (created?.id) setSelectedId(created.id);
      await refreshList();
      if (created?.id) await refreshDetail(created.id, true);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't add domain");
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedId) return;
    setVerifying(true);
    try {
      await call("verify", { id: selectedId });
      toast.success("Verification triggered. DNS can take a few minutes.");
      await refreshDetail(selectedId, true);
    } catch (e: any) {
      toast.error(e?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedId || !selectedDetail) return;
    if (!confirm(`Remove ${selectedDetail.name} from Resend? This cannot be undone.`)) return;
    try {
      await call("remove", { id: selectedId });
      toast.success("Domain removed");
      setSelectedId(null);
      setSelectedDetail(null);
      await refreshList();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't remove domain");
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const fromValid = useMemo(() => {
    const v = fromInput.trim();
    // Accept "Display Name <email@dom>" OR plain "email@dom"
    return /^([^<>]+<\s*[^\s@]+@[^\s@]+\.[^\s@>]+\s*>|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(v);
  }, [fromInput]);

  const fromDomainOfInput = useMemo(() => {
    const m = fromInput.match(/<\s*[^\s@]+@([^\s@>]+)/) || fromInput.match(/@([^\s@]+)/);
    return m ? m[1].toLowerCase() : "";
  }, [fromInput]);

  const fromMatchesVerified = useMemo(() => {
    if (!fromDomainOfInput) return false;
    return domains.some((d) => d.status === "verified" && fromDomainOfInput.endsWith(d.name.toLowerCase()));
  }, [fromDomainOfInput, domains]);

  const sendTestEmail = async () => {
    if (!user?.email) {
      toast.error("Sign in to send a test email");
      return;
    }
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const { data, error } = await supabase.functions.invoke("quick-export-contacts", {
        body: {
          recipientEmail: user.email,
          contactIds: [],
          scopeLabel: "Sender domain test (no contacts)",
          timezone: tz,
        },
      });
      if (error) throw new Error(error.message || "Send failed");
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Test email queued to ${user.email}`, { icon: "📧" });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send test email");
    }
  };

  // ─── Guards ───
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24 px-5 pt-5">
        <PageHeader title="Email sender" back="/app" />
        <div className="text-center bg-card border border-border rounded-2xl py-12 px-6 mt-6">
          <p className="text-sm font-semibold text-foreground mb-2">Sign in required</p>
          <Button onClick={() => navigate("/auth")}>Sign in</Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background pb-24 px-5 pt-5">
        <PageHeader title="Email sender" back="/app" />
        <div className="text-center bg-card border border-border rounded-2xl py-12 px-6 mt-6">
          <ShieldCheck size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">Platform admin only</p>
          <p className="text-xs text-muted-foreground">This page is restricted to platform administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 px-5 pt-5">
      <PageHeader title="Email sender" back="/app/admin" />

      {/* Intro */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Mail size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">Resend sender domain</h1>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Verify a domain you own with Resend so contact exports come from your brand
              instead of <code className="text-[10px] bg-muted px-1 py-0.5 rounded">onboarding@resend.dev</code>.
            </p>
          </div>
        </div>
      </div>

      {connectorMissing && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Resend isn't connected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Connect Resend in <strong>Workspace → Connectors</strong>, then refresh this page.
            </p>
          </div>
        </div>
      )}

      {/* Step 1 — Add domain */}
      <section className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="text-sm font-semibold text-foreground">Add a sender domain</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Use a subdomain you control, e.g. <code className="text-[10px] bg-muted px-1 py-0.5 rounded">send.cardr.ai</code>.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="send.yourdomain.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button onClick={handleCreate} disabled={creating || !newDomain.trim()}>
            {creating ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} className="mr-1" /> Add</>}
          </Button>
        </div>
      </section>

      {/* Step 2 — Pick a domain */}
      <section className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="text-sm font-semibold text-foreground">Your domains</h2>
          </div>
          <button
            onClick={refreshList}
            disabled={loadingList}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <RefreshCw size={12} className={loadingList ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {loadingList && domains.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">Loading…</p>
        ) : domains.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No domains yet. Add one above to get started.
          </p>
        ) : (
          <div className="divide-y divide-border -mx-1">
            {domains.map((d) => {
              const badge = STATUS_BADGE[d.status] || STATUS_BADGE.not_started;
              const active = d.id === selectedId;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full px-3 py-3 flex items-center gap-3 text-left rounded-xl transition-colors ${
                    active ? "bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <Globe size={16} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{d.name}</p>
                    {d.region && (
                      <p className="text-[11px] text-muted-foreground">Region: {d.region}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                    {badge.label}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Step 3 — DNS records */}
      {selectedDetail && (
        <section className="bg-card border border-border rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
              <h2 className="text-sm font-semibold text-foreground truncate">
                DNS records for {selectedDetail.name}
              </h2>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => refreshDetail(selectedId!)}>
                <RefreshCw size={12} className={loadingDetail ? "mr-1 animate-spin" : "mr-1"} /> Refresh
              </Button>
              <Button size="sm" onClick={handleVerify} disabled={verifying}>
                {verifying ? <Loader2 size={12} className="animate-spin mr-1" /> : <ShieldCheck size={12} className="mr-1" />}
                Verify
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Add each row below at your DNS host (Cloudflare, Namecheap, GoDaddy…). After they propagate,
            click <strong>Verify</strong>. DNS can take a few minutes to a few hours.
          </p>

          {!selectedDetail.records || selectedDetail.records.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No DNS records returned yet — try refreshing.</p>
          ) : (
            <div className="space-y-2">
              {selectedDetail.records.map((r, i) => {
                const recBadge = r.status ? (STATUS_BADGE[r.status] || STATUS_BADGE.not_started) : null;
                return (
                  <div key={i} className="border border-border rounded-xl p-3 bg-background">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide text-[10px]">
                          {r.type}
                        </span>
                        <span className="text-muted-foreground">{r.record}</span>
                      </div>
                      {recBadge && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${recBadge.className}`}>
                          {recBadge.label}
                        </span>
                      )}
                    </div>
                    <DnsRow label="Name / Host" value={r.name} onCopy={() => copy(r.name)} />
                    <DnsRow label="Value" value={r.value} mono onCopy={() => copy(r.value)} />
                    {(r.priority !== undefined && r.priority !== null) && (
                      <DnsRow label="Priority" value={String(r.priority)} onCopy={() => copy(String(r.priority))} />
                    )}
                    {r.ttl && <DnsRow label="TTL" value={String(r.ttl)} onCopy={() => copy(String(r.ttl))} />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <a
              href={`https://resend.com/domains/${selectedDetail.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Open in Resend dashboard <ExternalLink size={11} />
            </a>
            <button
              onClick={handleRemove}
              className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
            >
              <Trash2 size={11} /> Remove domain
            </button>
          </div>
        </section>
      )}

      {/* Step 4 — RESEND_FROM */}
      <section className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">4</span>
          <h2 className="text-sm font-semibold text-foreground">Configure the From address</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Set the <code className="text-[10px] bg-muted px-1 py-0.5 rounded">RESEND_FROM</code> secret to the
          address exports should come from. Format:
          <br />
          <code className="text-[10px] bg-muted px-1 py-0.5 rounded mt-1 inline-block">
            Cardr Exports &lt;exports@send.yourdomain.com&gt;
          </code>
        </p>

        <div className="rounded-xl border border-border p-3 mb-3 bg-background">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                Currently sending as
              </p>
              <p className="text-sm font-mono text-foreground truncate mt-0.5">
                {fromConfigured ? currentFrom : (fromFallback || "Not set")}
              </p>
            </div>
            {fromConfigured ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                Configured
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 border-amber-500/30">
                Default
              </span>
            )}
          </div>
        </div>

        <Input
          placeholder='Cardr Exports <exports@send.yourdomain.com>'
          value={fromInput}
          onChange={(e) => setFromInput(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono text-sm"
        />

        {fromInput.trim() && (
          <div className="mt-2 space-y-1">
            <ValidationLine
              ok={fromValid}
              text={fromValid ? "Format looks good" : 'Use format "Display Name <user@domain>" or "user@domain"'}
            />
            {fromValid && (
              <ValidationLine
                ok={fromMatchesVerified}
                text={
                  fromMatchesVerified
                    ? `Domain matches a verified Resend domain`
                    : "Domain doesn't match a verified domain in your list — Resend will reject sends"
                }
              />
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => copy(fromInput.trim())}
            variant="outline"
            size="sm"
            disabled={!fromInput.trim()}
          >
            <Copy size={12} className="mr-1" /> Copy value
          </Button>
          <Button onClick={sendTestEmail} variant="outline" size="sm">
            <Send size={12} className="mr-1" /> Send test email to me
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-border p-3 bg-muted/30">
          <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
            <KeyRound size={12} className="text-primary" /> How to save this
          </p>
          <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
            <li>Copy the value above.</li>
            <li>Open <strong>Cloud → Secrets</strong> in Lovable.</li>
            <li>
              Set <code className="text-[10px] bg-background px-1 py-0.5 rounded border border-border">RESEND_FROM</code>{" "}
              to the value you copied.
            </li>
            <li>Come back here and click <strong>Refresh</strong> to confirm, then send a test email.</li>
          </ol>
          <button
            onClick={refreshFrom}
            className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw size={11} /> Refresh current value
          </button>
        </div>
      </section>
    </div>
  );
};

const DnsRow = ({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy: () => void }) => (
  <div className="flex items-start gap-2 py-1">
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold shrink-0 w-20 mt-0.5">
      {label}
    </span>
    <code className={`text-[11px] flex-1 break-all ${mono ? "font-mono" : ""} text-foreground`}>{value}</code>
    <button
      onClick={onCopy}
      className="text-muted-foreground hover:text-foreground p-1 -m-1 shrink-0"
      aria-label={`Copy ${label}`}
    >
      <Copy size={12} />
    </button>
  </div>
);

const ValidationLine = ({ ok, text }: { ok: boolean; text: string }) => (
  <p className={`text-[11px] inline-flex items-center gap-1.5 ${ok ? "text-emerald-600" : "text-amber-600"}`}>
    {ok ? <Check size={12} /> : <X size={12} />} {text}
  </p>
);

export default ResendDomainSettings;
