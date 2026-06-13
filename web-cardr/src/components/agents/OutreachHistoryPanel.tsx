import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Mail, Linkedin, Clock, ChevronDown, ChevronRight, RefreshCw, Copy, CheckCircle2, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OutreachExportButton from "@/components/automation/OutreachExportButton";

interface Props {
  contactId: string;
}

interface Run {
  id: string;
  created_at: string;
  status: string;
  input: any;
  output: any;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: any;
  created_at: string;
}

interface Item {
  kind: "generated" | "sent";
  id: string;
  at: string;
  channel?: "email" | "linkedin";
  run?: Run;
  activity?: Activity;
}

const OutreachHistoryPanel = ({ contactId }: Props) => {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sends, setSends] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Find draft_outreach agent for this user
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "draft_outreach")
      .maybeSingle();

    const [runsRes, actsRes] = await Promise.all([
      agent
        ? supabase
            .from("agent_runs")
            .select("id,created_at,status,input,output")
            .eq("contact_id", contactId)
            .eq("agent_id", agent.id)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as Run[], error: null }),
      supabase
        .from("contact_activities")
        .select("id,type,title,description,metadata,created_at")
        .eq("contact_id", contactId)
        .eq("user_id", user.id)
        .contains("metadata", { source: "ai_outreach_drafter" })
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    setRuns((runsRes.data as Run[]) || []);
    setSends((actsRes.data as Activity[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (contactId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Merge runs + sends into a chronological feed
  const items: Item[] = [
    ...runs.map((r) => ({ kind: "generated" as const, id: `run-${r.id}`, at: r.created_at, run: r })),
    ...sends.map((a) => ({
      kind: "sent" as const,
      id: `act-${a.id}`,
      at: a.created_at,
      channel: (a.metadata?.channel as "email" | "linkedin") ?? (a.type === "email" ? "email" : "linkedin"),
      activity: a,
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const totalSends = sends.length;
  const totalGens = runs.length;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History size={15} className="text-primary" />
          <span className="text-sm font-semibold">Outreach history</span>
          {!loading && (
            <div className="flex items-center gap-1.5 ml-1">
              <Badge variant="secondary" className="text-[10px] h-5">{totalGens} drafted</Badge>
              <Badge variant="outline" className="text-[10px] h-5">{totalSends} sent</Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {totalGens > 0 && (
            <OutreachExportButton
              source="drafts"
              contactId={contactId}
              size="sm"
              variant="ghost"
              label=""
              baseName={`outreach-drafts-${contactId.slice(0, 8)}`}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => { e.stopPropagation(); load(); }}
            aria-label="Refresh"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
          {open ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t">
          {loading ? (
            <div className="px-4 py-6 text-xs text-muted-foreground text-center">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Sparkles size={20} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No outreach yet.</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">Generate a draft to start the history.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((it) => {
                if (it.kind === "sent" && it.activity) {
                  const a = it.activity;
                  const ch = it.channel ?? "email";
                  const Icon = ch === "email" ? Mail : Linkedin;
                  const label = ch === "email" ? "Email sent" : "LinkedIn message sent";
                  const isOpen = expanded.has(it.id);
                  return (
                    <li key={it.id} className="px-4 py-3">
                      <button
                        onClick={() => toggle(it.id)}
                        className="w-full flex items-start gap-3 text-left"
                      >
                        <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${ch === "email" ? "bg-primary/10 text-primary" : "bg-[hsl(210,80%,55%)]/10 text-[hsl(210,80%,55%)]"}`}>
                          <Icon size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{label}</span>
                            <Badge variant="default" className="text-[10px] h-4 px-1.5 gap-1">
                              <CheckCircle2 size={9} /> Sent
                            </Badge>
                            {a.metadata?.edited && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Edited</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <Clock size={10} />
                            <span>{format(parseISO(a.created_at), "MMM d, yyyy · h:mm a")}</span>
                            {a.metadata?.tone && <span>· {a.metadata.tone}</span>}
                          </div>
                          {ch === "email" && a.title && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              <span className="font-medium text-foreground">Subject:</span> {a.title.replace(/^Email sent:\s*/i, "")}
                            </p>
                          )}
                        </div>
                        <ChevronDown size={14} className={`text-muted-foreground/50 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && a.description && (
                        <div className="mt-2 ml-10 p-3 rounded-lg bg-muted/40 text-xs whitespace-pre-wrap leading-relaxed text-foreground">
                          {a.description}
                          <div className="flex justify-end mt-2">
                            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => copy(a.description || "")}>
                              <Copy size={11} /> Copy
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                }

                // Generated draft
                const r = it.run!;
                const isOpen = expanded.has(it.id);
                const failed = r.status === "error" || r.status === "failed";
                return (
                  <li key={it.id} className="px-4 py-3">
                    <button onClick={() => toggle(it.id)} className="w-full flex items-start gap-3 text-left">
                      <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Sparkles size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">Draft generated</span>
                          {failed ? (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Failed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">Draft</Badge>
                          )}
                          {r.input?.tone && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 capitalize">{r.input.tone}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <Clock size={10} />
                          <span>{format(parseISO(r.created_at), "MMM d, yyyy · h:mm a")}</span>
                          {r.input?.purpose && <span className="truncate">· {r.input.purpose}</span>}
                        </div>
                      </div>
                      <ChevronDown size={14} className={`text-muted-foreground/50 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="mt-2 ml-10 space-y-2">
                        {r.output?.email && (
                          <div className="rounded-lg border bg-card overflow-hidden">
                            <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center gap-1.5">
                              <Mail size={11} className="text-primary" />
                              <span className="text-[11px] font-semibold">Email</span>
                            </div>
                            <div className="px-3 py-2">
                              <div className="text-[11px] text-muted-foreground">Subject</div>
                              <div className="text-xs font-medium">{r.output.email.subject}</div>
                              <div className="text-[11px] text-muted-foreground mt-2">Body</div>
                              <div className="text-xs whitespace-pre-wrap leading-relaxed">{r.output.email.body}</div>
                              <div className="flex justify-end mt-1.5">
                                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => copy(`${r.output.email.subject}\n\n${r.output.email.body}`)}>
                                  <Copy size={11} /> Copy
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        {r.output?.linkedin?.message && (
                          <div className="rounded-lg border bg-card overflow-hidden">
                            <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center gap-1.5">
                              <Linkedin size={11} className="text-[hsl(210,80%,55%)]" />
                              <span className="text-[11px] font-semibold">LinkedIn</span>
                            </div>
                            <div className="px-3 py-2">
                              <div className="text-xs whitespace-pre-wrap leading-relaxed">{r.output.linkedin.message}</div>
                              <div className="flex justify-end mt-1.5">
                                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => copy(r.output.linkedin.message)}>
                                  <Copy size={11} /> Copy
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        {failed && r.output?.error && (
                          <div className="text-[11px] text-destructive p-2 rounded bg-destructive/10">{String(r.output.error)}</div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default OutreachHistoryPanel;
