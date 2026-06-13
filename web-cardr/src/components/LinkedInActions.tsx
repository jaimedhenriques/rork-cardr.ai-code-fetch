import { Linkedin, Copy, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useApp } from "@/context/AppContext";

interface LinkedInActionsProps {
  contactName: string;
  contactLinkedIn?: string;
  contactCompany?: string;
  contactTitle?: string;
  className?: string;
}

const interpolate = (body: string, name: string, company: string, title: string) =>
  body
    .replace(/\{\{firstName\}\}/g, name.split(" ")[0] || "there")
    .replace(/\{\{company\}\}/g, company || "your company")
    .replace(/\{\{title\}\}/g, title || "your role");

const LinkedInActions = ({ contactName, contactLinkedIn, contactCompany, contactTitle, className = "" }: LinkedInActionsProps) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const { messageTemplates } = useApp();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    }
  };

  const openLinkedIn = () => {
    if (contactLinkedIn) {
      const url = contactLinkedIn.startsWith("http") ? contactLinkedIn : `https://linkedin.com/in/${contactLinkedIn}`;
      window.open(url, "_blank");
    } else {
      // Search LinkedIn for the contact
      const query = encodeURIComponent(`${contactName} ${contactCompany || ""}`);
      window.open(`https://www.linkedin.com/search/results/people/?keywords=${query}`, "_blank");
    }
  };

  const copyTemplate = async (text: string) => {
    const copied = await copyToClipboard(text);
    if (copied) {
      toast.success("Message copied! Paste it on LinkedIn.");
      setShowTemplates(false);
      return;
    }
    toast.error("Could not copy the message on this device.");
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <button
          onClick={openLinkedIn}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <Linkedin size={13} />
          {contactLinkedIn ? "Open Profile" : "Find on LinkedIn"}
          <ExternalLink size={10} />
        </button>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <MessageSquare size={13} />
          Message Templates
        </button>
      </div>

      {showTemplates && (
        <div className="space-y-1.5 pl-0.5" onClick={(e) => e.stopPropagation()}>
          {messageTemplates.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 py-2">No templates yet. Create one in Settings.</p>
          )}
          {messageTemplates.map((tmpl) => {
            const message = interpolate(tmpl.body, contactName, contactCompany || "", contactTitle || "");
            return (
              <div
                key={tmpl.id}
                className="bg-secondary/60 rounded-xl p-2.5 cursor-pointer hover:bg-secondary transition-colors group"
                  onClick={() => void copyTemplate(message)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tmpl.label}</span>
                  <Copy size={10} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed line-clamp-2">{message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LinkedInActions;
