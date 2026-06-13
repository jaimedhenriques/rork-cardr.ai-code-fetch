import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  company: string;
}

interface Props {
  agentId?: string;
  onGenerated: (proposalId: string) => void;
}

const PROJECT_TYPES = [
  "Website redesign",
  "Mobile app development",
  "Brand identity",
  "Marketing campaign",
  "Consulting engagement",
  "SaaS implementation",
  "Custom",
];

const ProposalBuilderForm = ({ agentId, onGenerated }: Props) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string>("");
  const [projectType, setProjectType] = useState("Website redesign");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("contacts").select("id, name, company").order("name").limit(200).then(({ data }) => {
      setContacts((data ?? []) as Contact[]);
    });
  }, [user]);

  const handleGenerate = async () => {
    if (!projectType) {
      toast.error("Project type is required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: {
          agent_id: agentId,
          contact_id: contactId || null,
          project_type: projectType,
          budget,
          timeline,
          notes,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Proposal generated");
      onGenerated((data as any).proposal_id);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate proposal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Contact (optional)</Label>
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger><SelectValue placeholder="Select a contact or leave blank" /></SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Project type</Label>
        <Select value={projectType} onValueChange={setProjectType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROJECT_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Budget range</Label>
          <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="$10k–$25k" />
        </div>
        <div>
          <Label>Timeline</Label>
          <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="6–8 weeks" />
        </div>
      </div>

      <div>
        <Label>Notes for the agent</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything specific to mention — tone, must-haves, prior conversations…" rows={4} />
      </div>

      <Button onClick={handleGenerate} disabled={loading} className="w-full">
        {loading ? <><Loader2 className="animate-spin mr-2" size={16} /> Generating proposal…</> : <><Sparkles size={16} className="mr-2" /> Generate proposal</>}
      </Button>
    </div>
  );
};

export default ProposalBuilderForm;
