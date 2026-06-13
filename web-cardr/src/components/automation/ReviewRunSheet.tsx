import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mail, Linkedin, UserPlus, Send, Check, X, Loader2, Copy, ExternalLink } from "lucide-react";
import { useRunMessages, useUpdateMessage, useTriggerRun, useMarkSent, useCancelRun } from "@/hooks/useAutomationSequences";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  run: any | null;
}

const channelIcon = (c: string) => {
  if (c === "email") return <Mail className="size-3.5" />;
  if (c === "linkedin_connection") return <UserPlus className="size-3.5" />;
  return <Linkedin className="size-3.5" />;
};

const statusColor: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  sent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  skipped: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  failed: "bg-destructive/10 text-destructive",
};

export default function ReviewRunSheet({ open, onOpenChange, run }: Props) {
  const { data: messages = [], isLoading } = useRunMessages(run?.id || null);
  const update = useUpdateMessage();
  const trigger = useTriggerRun();
  const markSent = useMarkSent();
  const cancel = useCancelRun();
  const [editing, setEditing] = useState<Record<string, { subject?: string; body?: string }>>({});

  if (!run) return null;
  const contact = run.contacts;

  const handleSend = (msg: any) => {
    if (msg.channel === "email") {
      const to = contact?.email || "";
      const subject = encodeURIComponent(msg.subject || "");
      const body = encodeURIComponent(msg.body);
      window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
      markSent.mutate(msg.id);
    } else {
      // LinkedIn — copy body and open profile
      navigator.clipboard.writeText(msg.body);
      toast.success("Message copied — paste it on LinkedIn");
      const url = contact?.linkedin || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contact?.name || "")}`;
      window.open(url, "_blank");
      markSent.mutate(msg.id);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const e = editing[id];
    if (!e) return;
    await update.mutateAsync({ id, ...e });
    setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
    toast.success("Updated");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Review for {contact?.name}
            <Badge variant="outline">{run.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-3">
          <Card className="p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{contact?.name}</p>
              <p className="text-xs text-muted-foreground">{contact?.company} · {contact?.email}</p>
            </div>
            <div className="flex gap-2">
              {(run.status === "draft") && (
                <Button size="sm" onClick={() => trigger.mutate(run.id)} disabled={trigger.isPending}>
                  {trigger.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Approve & trigger
                </Button>
              )}
              {(run.status === "draft" || run.status === "running") && (
                <Button size="sm" variant="outline" onClick={() => cancel.mutate(run.id)}>
                  <X className="size-4" /> Cancel
                </Button>
              )}
            </div>
          </Card>

          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto" /></div>
          ) : (
            messages.map((msg, i) => {
              const e = editing[msg.id];
              const subject = e?.subject ?? msg.subject ?? "";
              const body = e?.body ?? msg.body;
              const isEditing = !!e;
              const canSend = msg.status === "approved" || msg.status === "pending";
              return (
                <Card key={msg.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Step {i + 1}</Badge>
                      <Badge variant="outline" className="gap-1">{channelIcon(msg.channel)} {msg.channel.replace("_", " ")}</Badge>
                      <Badge className={statusColor[msg.status]}>{msg.status}</Badge>
                    </div>
                    {msg.scheduled_at && (
                      <span className="text-xs text-muted-foreground">{format(new Date(msg.scheduled_at), "MMM d")}</span>
                    )}
                  </div>

                  {msg.channel === "email" && (
                    <Input
                      value={subject}
                      onChange={(ev) => setEditing((p) => ({ ...p, [msg.id]: { ...p[msg.id], subject: ev.target.value } }))}
                      placeholder="Subject"
                      className="text-sm font-medium"
                      disabled={msg.status === "sent"}
                    />
                  )}
                  <Textarea
                    rows={5}
                    value={body}
                    onChange={(ev) => setEditing((p) => ({ ...p, [msg.id]: { ...p[msg.id], body: ev.target.value } }))}
                    disabled={msg.status === "sent"}
                  />

                  <div className="flex gap-2 flex-wrap">
                    {isEditing && (
                      <Button size="sm" variant="outline" onClick={() => handleSaveEdit(msg.id)}>
                        <Check className="size-4" /> Save edit
                      </Button>
                    )}
                    {canSend && (
                      <>
                        <Button size="sm" onClick={() => handleSend(msg)}>
                          {msg.channel === "email" ? <Mail className="size-4" /> : <ExternalLink className="size-4" />}
                          {msg.channel === "email" ? "Open in mail" : "Copy & open LinkedIn"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          navigator.clipboard.writeText(msg.subject ? `${msg.subject}\n\n${msg.body}` : msg.body);
                          toast.success("Copied");
                        }}>
                          <Copy className="size-4" /> Copy
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: msg.id, status: "skipped" })}>
                          Skip
                        </Button>
                      </>
                    )}
                    {msg.status === "sent" && msg.sent_at && (
                      <span className="text-xs text-muted-foreground self-center">
                        Sent {format(new Date(msg.sent_at), "MMM d, p")}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
