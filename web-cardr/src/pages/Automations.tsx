import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import EmptyState from "@/components/ui/empty-state";
import { Plus, Sparkles, Users, Trash2, Workflow, Mail, Linkedin, Send, Eye, CalendarClock } from "lucide-react";
import { useSequences, useDeleteSequence, useSequenceRuns } from "@/hooks/useAutomationSequences";
import CreateSequenceSheet from "@/components/automation/CreateSequenceSheet";
import EnrollContactsDialog from "@/components/automation/EnrollContactsDialog";
import ReviewRunSheet from "@/components/automation/ReviewRunSheet";
import ExportSchedulesPanel from "@/components/automation/ExportSchedulesPanel";
import ExportHistoryPanel from "@/components/automation/ExportHistoryPanel";
import OutreachExportButton from "@/components/automation/OutreachExportButton";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  running: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function Automations() {
  const { data: sequences = [], isLoading } = useSequences();
  const { data: runs = [] } = useSequenceRuns();
  const del = useDeleteSequence();

  const [createOpen, setCreateOpen] = useState(false);
  const [enrollFor, setEnrollFor] = useState<string | null>(null);
  const [reviewRun, setReviewRun] = useState<any | null>(null);

  return (
    <div className="pb-24">
      <PageHeader title="Automations" />

      <div className="px-4 space-y-6">
        <Tabs defaultValue="sequences">
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="sequences">Sequences ({sequences.length})</TabsTrigger>
              <TabsTrigger value="runs">Runs ({runs.length})</TabsTrigger>
              <TabsTrigger value="exports"><CalendarClock className="size-3.5 mr-1" />CSV Exports</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="size-4" /> New
            </Button>
          </div>

          <TabsContent value="sequences" className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
            ) : sequences.length === 0 ? (
              <EmptyState
                icon={Workflow}
                title="No sequences yet"
                description="Create an AI-generated multi-step outreach sequence for LinkedIn and email."
                action={<Button onClick={() => setCreateOpen(true)}><Sparkles className="size-4" /> Create your first sequence</Button>}
              />
            ) : (
              sequences.map((s) => {
                const seqRuns = runs.filter((r) => r.sequence_id === s.id);
                return (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{s.name}</h3>
                          <Badge variant="outline">{s.channel}</Badge>
                          <Badge variant="secondary">{s.tone}</Badge>
                        </div>
                        {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                        <p className="text-xs text-muted-foreground mt-2">
                          {seqRuns.length} contact{seqRuns.length === 1 ? "" : "s"} enrolled
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" onClick={() => setEnrollFor(s.id)}>
                          <Users className="size-4" /> Enroll
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="runs" className="mt-4 space-y-3">
            {runs.length === 0 ? (
              <EmptyState
                icon={Send}
                title="No active runs"
                description="Enroll contacts into a sequence to see runs here."
              />
            ) : (
              <>
                <div className="flex justify-end">
                  <OutreachExportButton source="runs" label="Export runs" />
                </div>
                {runs.map((r) => {
                const seq = sequences.find((s) => s.id === r.sequence_id);
                return (
                  <Card key={r.id} className="p-4 cursor-pointer card-interactive" onClick={() => setReviewRun(r)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="size-10">
                          <AvatarImage src={r.contacts?.avatar} />
                          <AvatarFallback>{r.contacts?.name?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.contacts?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {seq?.name} · {r.contacts?.company}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Created {format(new Date(r.created_at), "MMM d")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statusColor[r.status] || statusColor.draft}>{r.status}</Badge>
                        <Button size="sm" variant="ghost" className="h-7">
                          <Eye className="size-3.5" /> Review
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
                })}
              </>
            )}
          </TabsContent>

          <TabsContent value="exports" className="mt-4">
            <ExportSchedulesPanel />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ExportHistoryPanel />
          </TabsContent>
        </Tabs>
      </div>

      <CreateSequenceSheet open={createOpen} onOpenChange={setCreateOpen} />
      <EnrollContactsDialog open={!!enrollFor} onOpenChange={(v) => !v && setEnrollFor(null)} sequenceId={enrollFor} />
      <ReviewRunSheet open={!!reviewRun} onOpenChange={(v) => !v && setReviewRun(null)} run={reviewRun} />
    </div>
  );
}
