import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, Loader2 } from "lucide-react";

export type WaitlistPlatform = "ios" | "android" | "mac" | "windows";

const PLATFORM_LABEL: Record<WaitlistPlatform, string> = {
  ios: "iOS",
  android: "Android",
  mac: "macOS",
  windows: "Windows",
};

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: WaitlistPlatform | null;
  source?: string;
}

const WaitlistDialog = ({ open, onOpenChange, platform, source = "landing" }: Props) => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setEmail("");
    setSubmitting(false);
    setDone(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform) return;
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast({ title: "Invalid email", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("platform_waitlist").insert({
      email: parsed.data.email.toLowerCase(),
      platform,
      source,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      referrer: typeof document !== "undefined" ? document.referrer.slice(0, 500) : null,
    });
    setSubmitting(false);
    // Treat duplicate as success (already on the list)
    if (error && !/duplicate key|unique/i.test(error.message)) {
      toast({ title: "Couldn't join waitlist", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
    toast({ title: "You're on the list!", description: `We'll email you when the ${PLATFORM_LABEL[platform]} app is ready.` });
  };

  const label = platform ? PLATFORM_LABEL[platform] : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{done ? `You're on the ${label} waitlist` : `Get notified when ${label} launches`}</DialogTitle>
          <DialogDescription>
            {done
              ? `We'll send a single email to that address the moment the ${label} app is live. No spam, ever.`
              : `Drop your email and we'll let you know the moment the Cardr ${label} app is available.`}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm font-medium text-primary">
            <Check size={16} /> Added — thanks!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              required
              autoFocus
              placeholder="you@work.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting || !email} className="w-full">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Adding…" : `Notify me when ${label} is ready`}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              We only use this email to notify you about the {label} launch.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WaitlistDialog;
