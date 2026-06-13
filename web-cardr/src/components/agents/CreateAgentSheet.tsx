import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAgents } from "@/hooks/useAgents";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CreateAgentSheet = ({ open, onClose }: Props) => {
  const { createAgent } = useAgents();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Name and instructions are required");
      return;
    }
    try {
      await createAgent.mutateAsync({ name, description, system_prompt: systemPrompt });
      toast.success("Agent created");
      setName(""); setDescription(""); setSystemPrompt("");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to create agent");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create custom agent</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="agent-name">Name</Label>
            <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold outreach writer" />
          </div>
          <div>
            <Label htmlFor="agent-desc">Description</Label>
            <Input id="agent-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary of what it does" />
          </div>
          <div>
            <Label htmlFor="agent-prompt">Instructions (system prompt)</Label>
            <Textarea
              id="agent-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are an expert at writing concise cold outreach emails. When given a contact and goal, draft a 3-sentence email…"
              rows={8}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={createAgent.isPending} className="flex-1">
              {createAgent.isPending ? "Creating..." : "Create agent"}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CreateAgentSheet;
