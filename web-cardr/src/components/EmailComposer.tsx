import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Wand2, X, Send, Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, type Contact } from "@/context/AppContext";
import { toast } from "sonner";

const TONES = [
  { id: "formal", label: "Formal", emoji: "🎩" },
  { id: "friendly", label: "Friendly", emoji: "😊" },
  { id: "casual", label: "Casual", emoji: "✌️" },
  { id: "concise", label: "Concise", emoji: "⚡" },
];

const PURPOSES = [
  "Follow-up after meeting",
  "Introduction / first contact",
  "Schedule a call",
  "Thank you note",
  "Partnership proposal",
  "Custom",
];

interface Props {
  contact: Contact;
  open: boolean;
  onClose: () => void;
}

const EmailComposer = ({ contact, open, onClose }: Props) => {
  const { profile } = useApp();
  const [tone, setTone] = useState("friendly");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [customPurpose, setCustomPurpose] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          contact: {
            name: contact.name,
            company: contact.company,
            title: contact.title,
            email: contact.email,
            notes: contact.notes,
          },
          senderName: profile.name,
          senderCompany: profile.company,
          tone,
          purpose: purpose === "Custom" ? customPurpose : purpose,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.draft) {
        setSubject(data.draft.subject || "");
        setBody(data.draft.body || "");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate email");
    } finally {
      setLoading(false);
    }
  };

  const handleSendViaMailto = () => {
    if (!contact.email) {
      toast.error("No email address for this contact");
      return;
    }
    const mailto = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    toast.success("Email copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-md card-elevated p-5 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">AI Email Composer</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
            <X size={13} className="text-muted-foreground" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          To: <span className="font-semibold text-foreground">{contact.name}</span>
          {contact.email && <span className="text-muted-foreground/70"> ({contact.email})</span>}
        </p>

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
                    ? "border-primary bg-primary-light text-primary font-semibold"
                    : "border-border/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Purpose Selector */}
        <div className="mb-3">
          <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">Purpose</label>
          <div className="flex gap-1.5 flex-wrap">
            {PURPOSES.map((p) => (
              <button
                key={p}
                onClick={() => setPurpose(p)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  purpose === p
                    ? "border-primary bg-primary-light text-primary font-semibold"
                    : "border-border/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {purpose === "Custom" && (
            <input
              value={customPurpose}
              onChange={(e) => setCustomPurpose(e.target.value)}
              placeholder="Describe the purpose..."
              className="input-field mt-2 text-xs"
            />
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm mb-4 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Drafting...
            </>
          ) : (
            <>
              <Wand2 size={14} /> Generate Email
            </>
          )}
        </button>

        {/* Draft Preview */}
        {(subject || body) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="input-field text-xs resize-none leading-relaxed"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSendViaMailto}
                disabled={!contact.email}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <Send size={13} /> Open in Email
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-secondary text-foreground text-sm font-semibold transition-all active:scale-[0.97]"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default EmailComposer;
