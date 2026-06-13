import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mail, Linkedin, Copy, Send, Loader2, RefreshCw, CheckCircle2, Zap, ArrowLeft, Eye, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  email?: string;
  linkedin?: string | null;
  linkedin_profile_url?: string | null;
}

interface Drafts {
  email: { subject: string; body: string };
  linkedin: { message: string };
  personalization_notes?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  contact: Contact;
}

type Step = "setup" | "review" | "sent";

const OutreachDraftDialog = ({ open, onClose, contact }: Props) => {
  const [step, setStep] = useState<Step>("setup");
  const [tone, setTone] = useState("friendly");
  const [purpose, setPurpose] = useState("Follow-up after meeting");
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Drafts | null>(null);

  // Editable draft fields
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [linkedinMsg, setLinkedinMsg] = useState("");

  // Review mode (preview vs edit per channel)
  const [emailMode, setEmailMode] = useState<"preview" | "edit">("preview");
  const [linkedinMode, setLinkedinMode] = useState<"preview" | "edit">("preview");

  const [emailSent, setEmailSent] = useState(false);
  const [linkedinSent, setLinkedinSent] = useState(false);

  const reset = () => {
    setStep("setup");
    setDrafts(null);
    setEmailSent(false);
    setLinkedinSent(false);
    setEmailMode("preview");
    setLinkedinMode("preview");
  };

  const generate = async () => {
    setLoading(true);
    setEmailSent(false);
    setLinkedinSent(false);
    try {
      const { data, error } = await supabase.functions.invoke("draft-outreach", {
        body: { contact_id: contact.id, tone, purpose },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const d = data.drafts as Drafts;
      setDrafts(d);
      setEmailSubject(d.email.subject);
      setEmailBody(d.email.body);
      setLinkedinMsg(d.linkedin.message);
      setStep("review");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate drafts");
    } finally {
      setLoading(false);
    }
  };

  const isDirty =
    !!drafts &&
    (emailSubject !== drafts.email.subject ||
      emailBody !== drafts.email.body ||
      linkedinMsg !== drafts.linkedin.message);

  const logActivity = async (channel: "email" | "linkedin", title: string, description: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("contact_activities").insert({
        contact_id: contact.id,
        user_id: user.id,
        type: channel === "email" ? "email" : "other",
        title,
        description,
        metadata: { channel, source: "ai_outreach_drafter", purpose, tone, edited: isDirty },
      });
    } catch (e) {
      console.warn("activity log failed", e);
    }
  };

  const sendEmail = async () => {
    if (!contact.email) {
      toast.error("No email address on file for this contact");
      return;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    const url = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(url, "_blank");
    setEmailSent(true);
    toast.success("Email opened in your client", { description: "Hit send to deliver." });
    await logActivity("email", `Email sent: ${emailSubject}`, emailBody);
  };

  const sendLinkedIn = async () => {
    if (!linkedinMsg.trim()) {
      toast.error("LinkedIn message is empty");
      return;
    }
    try { await navigator.clipboard.writeText(linkedinMsg); } catch {}
    const url = contact.linkedin_profile_url || contact.linkedin;
    const target = url
      ? (url.startsWith("http") ? url : `https://${url}`)
      : "https://www.linkedin.com/messaging/";
    window.open(target, "_blank");
    setLinkedinSent(true);
    toast.success("Message copied — LinkedIn opened", { description: "Paste into the chat to send." });
    await logActivity("linkedin", "LinkedIn message sent", linkedinMsg);
  };

  const sendBoth = async () => {
    if (contact.email) await sendEmail();
    await new Promise((r) => setTimeout(r, 250));
    await sendLinkedIn();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canSendBoth = !!contact.email && !!linkedinMsg && !!emailBody;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              {step === "setup" && "AI Outreach Drafter"}
              {step === "review" && "Review draft"}
              {step === "sent" && "Outreach sent"}
            </DialogTitle>
            {step === "review" && (
              <div className="flex items-center gap-2">
                {isDirty && <Badge variant="secondary" className="text-[10px]">Edited</Badge>}
                <Badge variant="outline" className="text-[10px] capitalize">{tone}</Badge>
              </div>
            )}
          </div>
          <DialogDescription>
            {step === "setup" && (
              <>Generate personalized drafts for <span className="font-medium text-foreground">{contact.name}</span>.</>
            )}
            {step === "review" && (
              <>Review and edit before confirming. Nothing is sent until you click <span className="font-medium text-foreground">Confirm & send</span>.</>
            )}
            {step === "sent" && <>Activity logged to {contact.name}'s timeline.</>}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — SETUP */}
        {step === "setup" && (
          <div className="space-y-4 mt-2">
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="concise">Concise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purpose / goal</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Schedule a follow-up call" />
            </div>
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="animate-spin" size={16} /> Generating…</> : <><Sparkles size={16} /> Generate drafts</>}
            </Button>
          </div>
        )}

        {/* STEP 2 — REVIEW */}
        {step === "review" && drafts && (
          <div className="mt-2">
            {drafts.personalization_notes && (
              <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground mb-3">
                <span className="font-semibold text-foreground">Personalization:</span> {drafts.personalization_notes}
              </div>
            )}

            <Tabs defaultValue="email">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="email">
                  <Mail size={14} className="mr-1.5" /> Email
                  {emailSent && <CheckCircle2 size={12} className="ml-1.5 text-primary" />}
                </TabsTrigger>
                <TabsTrigger value="linkedin">
                  <Linkedin size={14} className="mr-1.5" /> LinkedIn
                  {linkedinSent && <CheckCircle2 size={12} className="ml-1.5 text-primary" />}
                </TabsTrigger>
              </TabsList>

              {/* EMAIL */}
              <TabsContent value="email" className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    To: <span className="text-foreground font-medium">{contact.email || "— no email on file —"}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmailMode(emailMode === "preview" ? "edit" : "preview")}
                  >
                    {emailMode === "preview" ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
                  </Button>
                </div>

                {emailMode === "edit" ? (
                  <>
                    <div>
                      <Label>Subject</Label>
                      <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                    </div>
                    <div>
                      <Label>Body</Label>
                      <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={10} />
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <div className="px-4 py-2.5 border-b bg-muted/30">
                      <div className="text-xs text-muted-foreground">Subject</div>
                      <div className="text-sm font-medium text-foreground">{emailSubject || <em className="text-muted-foreground">empty</em>}</div>
                    </div>
                    <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                      {emailBody || <em className="text-muted-foreground">empty</em>}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={sendEmail} disabled={!contact.email} className="flex-1">
                    <Send size={14} /> {emailSent ? "Send again" : "Confirm & send email"}
                  </Button>
                  <Button variant="outline" onClick={() => copy(`${emailSubject}\n\n${emailBody}`)}><Copy size={14} /></Button>
                </div>
              </TabsContent>

              {/* LINKEDIN */}
              <TabsContent value="linkedin" className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {linkedinMsg.length}/300 characters
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLinkedinMode(linkedinMode === "preview" ? "edit" : "preview")}
                  >
                    {linkedinMode === "preview" ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
                  </Button>
                </div>

                {linkedinMode === "edit" ? (
                  <Textarea value={linkedinMsg} onChange={(e) => setLinkedinMsg(e.target.value)} rows={6} maxLength={300} />
                ) : (
                  <div className="rounded-lg border bg-card px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                    {linkedinMsg || <em className="text-muted-foreground">empty</em>}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={sendLinkedIn} className="flex-1">
                    <Send size={14} /> {linkedinSent ? "Send again" : "Confirm & send LinkedIn"}
                  </Button>
                  <Button variant="outline" onClick={() => copy(linkedinMsg)}><Copy size={14} /></Button>
                </div>
              </TabsContent>
            </Tabs>

            {canSendBoth && (
              <Button onClick={sendBoth} variant="secondary" className="w-full mt-3">
                <Zap size={14} /> Confirm & send both
              </Button>
            )}

            <div className="flex items-center gap-2 mt-3">
              <Button variant="ghost" onClick={() => setStep("setup")} className="flex-1 text-xs">
                <ArrowLeft size={14} /> Back
              </Button>
              <Button variant="ghost" onClick={generate} disabled={loading} className="flex-1 text-xs">
                {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />} Regenerate
              </Button>
            </div>

            {(emailSent || linkedinSent) && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs mt-3 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary" />
                <span>
                  Sent via {[emailSent && "Email", linkedinSent && "LinkedIn"].filter(Boolean).join(" + ")} — activity logged.
                </span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OutreachDraftDialog;
