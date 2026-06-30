import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Loader2, Sparkles, Mic, Square, AlertCircle, RotateCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

interface NoteForContext {
  title: string;
  summary: string | null;
  key_topics: string[];
  action_items: { task: string; owner?: string; deadline?: string }[];
  follow_ups: { description: string; with?: string }[];
  decisions: string[];
  manual_notes: string | null;
  transcript: string | null;
  created_at: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Who have I promised to follow up with?",
  "What needs my attention this week?",
  "Summarize my recent meetings",
  "What key decisions were made?",
];

const CHAT_URL = `${SUPABASE_FUNCTIONS_URL}/notes-chat`;

export default function NotesChatSheet({ notes, open, onClose }: { notes: NoteForContext[]; open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessages, setLastMessages] = useState<Msg[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const isVoiceSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (!isVoiceSupported) {
      toast.error("Speech recognition not supported. Try Chrome.");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) setInput((prev) => (prev ? prev + " " + text : text));
    };
    recognition.onerror = (e: any) => {
      if (e.error !== "aborted" && e.error !== "no-speech") toast.error(`Mic error: ${e.error}`);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, [listening, isVoiceSupported]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const runChat = async (allMsgs: Msg[]) => {
    setLastMessages(allMsgs);
    setError(null);
    setLoading(true);

    let assistantSoFar = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: allMsgs, notes }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "AI request failed");
      }

      if (!resp.body) throw new Error("No stream");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim() || !line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to get response");
    }
    setLoading(false);
  };

  const send = (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    runChat(allMsgs);
  };

  const handleRetry = () => {
    if (lastMessages) runChat(lastMessages);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed inset-0 z-[60] bg-background flex flex-col"
      >
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-base font-display font-bold text-foreground">Ask your notes</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="pt-8 space-y-4">
                <p className="text-center text-sm text-muted-foreground">Ask anything about your meetings</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs font-medium bg-card border border-border rounded-full px-3 py-1.5 text-foreground hover:bg-secondary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-foreground [&_p]:my-1 [&_li]:my-0.5 [&_ul]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <Loader2 size={16} className="text-primary animate-spin" />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-destructive">Couldn't reach the assistant</p>
                  <p className="text-[12px] text-destructive/80 mt-0.5 break-words">{error}</p>
                </div>
                <button
                  onClick={handleRetry}
                  disabled={loading || !lastMessages}
                  className="flex items-center gap-1.5 rounded-lg bg-destructive/15 px-2.5 py-1.5 text-[12px] font-semibold text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-40 shrink-0"
                >
                  <RotateCw size={12} className={loading ? "animate-spin" : ""} />
                  Retry
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-5 pb-[env(safe-area-inset-bottom,12px)] pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
                placeholder="Chat with all your meetings…"
                className="flex-1 h-10 rounded-xl bg-card border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={toggleVoice}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  listening
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {listening ? <Square size={14} /> : <Mic size={16} />}
              </button>
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40"
              >
                <Send size={14} className="text-primary-foreground" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
