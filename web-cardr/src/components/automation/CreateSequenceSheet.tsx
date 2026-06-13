import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trash2, Plus, Mail, Linkedin, UserPlus, Loader2 } from "lucide-react";
import { useGenerateSequence, useCreateSequence, type SequenceStep } from "@/hooks/useAutomationSequences";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}

const channelIcon = (c: string) => {
  if (c === "email") return <Mail className="size-3.5" />;
  if (c === "linkedin_connection") return <UserPlus className="size-3.5" />;
  return <Linkedin className="size-3.5" />;
};

const channelLabel = (c: string) => {
  if (c === "email") return "Email";
  if (c === "linkedin_connection") return "LinkedIn invite";
  return "LinkedIn message";
};

export default function CreateSequenceSheet({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [channel, setChannel] = useState("mixed");
  const [tone, setTone] = useState("friendly");
  const [audience, setAudience] = useState("");
  const [numSteps, setNumSteps] = useState("3");
  const [steps, setSteps] = useState<SequenceStep[]>([]);

  const gen = useGenerateSequence();
  const create = useCreateSequence();

  const handleGenerate = async () => {
    const result = await gen.mutateAsync({
      goal: goal || "Build relationship and book a discovery call",
      channel, tone,
      steps: parseInt(numSteps),
      audience,
    });
    setName(result.name);
    setDescription(result.description);
    setSteps(result.steps);
  };

  const updateStep = (i: number, patch: Partial<SequenceStep>) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        step_order: prev.length + 1,
        channel: "email",
        delay_days: prev.length === 0 ? 0 : 3,
        subject_template: "Following up, {{name}}",
        body_template: "Hi {{name}},\n\n",
      },
    ]);
  };

  const removeStep = (i: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_order: idx + 1 })));
  };

  const handleSave = async () => {
    if (!name.trim() || !steps.length) return;
    const seq = await create.mutateAsync({
      name, description, channel, tone, goal,
      steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })),
    });
    onCreated?.(seq.id);
    setName(""); setDescription(""); setGoal(""); setSteps([]);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New automation sequence</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <Card className="p-4 space-y-4 bg-muted/30 border-dashed">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Generate with AI</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Goal</Label>
                <Input placeholder="e.g. Book a discovery call" value={goal} onChange={(e) => setGoal(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed (LinkedIn + Email)</SelectItem>
                    <SelectItem value="email">Email only</SelectItem>
                    <SelectItem value="linkedin">LinkedIn only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Steps</Label>
                <Select value={numSteps} onValueChange={setNumSteps}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n} steps</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Audience (optional)</Label>
                <Input placeholder="SaaS founders, EU" value={audience} onChange={(e) => setAudience(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={gen.isPending} className="w-full" size="sm">
              {gen.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {gen.isPending ? "Generating..." : "Generate sequence"}
            </Button>
          </Card>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Sequence name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold outreach v1" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Steps</h3>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="size-4" /> Add step
              </Button>
            </div>

            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Generate with AI or add steps manually.
              </p>
            )}

            {steps.map((step, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Step {i + 1}</Badge>
                    <Badge variant="outline" className="gap-1">
                      {channelIcon(step.channel)} {channelLabel(step.channel)}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeStep(i)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Channel</Label>
                    <Select value={step.channel} onValueChange={(v: any) => updateStep(i, { channel: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="linkedin_connection">LinkedIn invite</SelectItem>
                        <SelectItem value="linkedin_message">LinkedIn message</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Delay (days)</Label>
                    <Input type="number" min={0} value={step.delay_days}
                      onChange={(e) => updateStep(i, { delay_days: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                {step.channel === "email" && (
                  <div>
                    <Label className="text-xs">Subject</Label>
                    <Input value={step.subject_template || ""} onChange={(e) => updateStep(i, { subject_template: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Body — use {`{{name}}`}, {`{{company}}`}, {`{{title}}`}</Label>
                  <Textarea rows={5} value={step.body_template} onChange={(e) => updateStep(i, { body_template: e.target.value })} />
                </div>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 sticky bottom-0 bg-background pt-3 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || !steps.length || create.isPending} className="flex-1">
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Save sequence
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
