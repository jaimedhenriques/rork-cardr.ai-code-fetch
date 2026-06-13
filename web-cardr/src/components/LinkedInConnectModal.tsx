import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Linkedin, Wand2, X, Copy, Check, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, type Contact } from "@/context/AppContext";
import { toast } from "sonner";

const TONES = [
  { id: "professional", label: "Professional", emoji: "💼" },
  { id: "friendly", label: "Friendly", emoji: "😊" },
  { id: "casual", label: "Casual", emoji: "✌️" },
  { id: "enthusiastic", label: "Enthusiastic", emoji: "🚀" },
];

type MessageType = "connection_request" | "direct_message";

interface Props {
  contact: Partial<Contact>;
  open: boolean;
  onClose: () => void;
  defaultType?: MessageType;
}

const LinkedInConnectModal = ({ contact, open, onClose, defaultType = "connection_request" }: Props) => {
  const { profile } = useApp();
  const [type, setType] = useState<MessageType>(defaultType);
  const [tone, setTone] = useState("professional");
  const [customContext, setCustomContext] = useState("");
  const [message, setMessage] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const charLimit = type === "connection_request" ? 300 : 2000;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-linkedin", {
        body: {
          contact: {
            name: contact.name,
            company: contact.company,
            title: contact.title,
            industry: (contact as any).industry,
            location: (contact as any).location,
            notes: contact.notes,
          },
          senderName: profile.name,
          senderCompany: profile.company,
          type,
          tone,
          customContext: customContext.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.draft) {
        setMessage(data.draft.message || "");
        setCharCount(data.draft.characterCount || data.draft.message?.length || 0);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate message");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Message copied! Paste it on LinkedIn.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success("Message copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAndOpen = async () => {
    await handleCopy();
    openLinkedIn();
  };

  const openLinkedIn = () => {
    const linkedin = contact.linkedin || (contact as any).linkedinProfileUrl;
    if (linkedin) {
      const url = linkedin.startsWith("http") ? linkedin : `https://linkedin.com/in/${linkedin}`;
      window.open(url, "_blank");
    } else {
      const query = encodeURIComponent(`${contact.name} ${contact.company || ""}`);
      window.open(`https://www.linkedin.com/search/results/people/?keywords=${query}`, "_blank");
    }
  };

  const handleMessageChange = (val: string) => {
    if (type === "connection_request" && val.length > 300) return;
    setMessage(val);
    setCharCount(val.length);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="w-full max-w-md card-elevated p-5 max-h-[85vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[hsl(210,80%,55%)]/10 flex items-center justify-center">
                <Linkedin size={16} className="text-[hsl(210,80%,55%)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">LinkedIn Outreach</h3>
                <p className="text-[10px] text-muted-foreground">AI-powered message for {contact.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <X size={13} className="text-muted-foreground" />
            </button>
          </div>

          {/* Type Toggle */}
          <div className="flex gap-1.5 mb-3 p-1 bg-secondary/60 rounded-xl">
            <button
              onClick={() => { setType("connection_request"); setMessage(""); }}
              className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${
                type === "connection_request"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🤝 Connection Request
            </button>
            <button
              onClick={() => { setType("direct_message"); setMessage(""); }}
              className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${
                type === "direct_message"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              💬 Direct Message
            </button>
          </div>

          {/* Tone Selector */}
          <div className="mb-3">
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">Tone</label>
            <div className="flex gap-1.5 flex-wrap">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    tone === t.id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border/60 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Context */}
          <div className="mb-3">
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">
              Additional context <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <input
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="e.g. Met at TechCrunch, interested in AI..."
              className="input-field text-xs"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm mb-4 disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Generating...</>
            ) : message ? (
              <><RefreshCw size={14} /> Regenerate</>
            ) : (
              <><Wand2 size={14} /> Generate {type === "connection_request" ? "Connection Note" : "Message"}</>
            )}
          </button>

          {/* Message Preview */}
          {message && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Message</label>
                  <span className={`text-[10px] font-semibold ${charCount > charLimit ? "text-destructive" : charCount > charLimit * 0.9 ? "text-warning" : "text-muted-foreground"}`}>
                    {charCount}/{charLimit}
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  rows={type === "connection_request" ? 4 : 6}
                  className="input-field text-xs resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyAndOpen}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                >
                  <Linkedin size={13} /> Copy & Open LinkedIn
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-secondary text-foreground text-sm font-semibold transition-all active:scale-[0.97]"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Quick Open LinkedIn */}
              {!contact.linkedin && !(contact as any).linkedinProfileUrl && (
                <p className="text-[10px] text-muted-foreground/60 text-center">
                  No LinkedIn URL saved — we'll search for {contact.name} on LinkedIn
                </p>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LinkedInConnectModal;
