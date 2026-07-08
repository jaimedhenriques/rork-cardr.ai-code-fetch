import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Loader2, Mail, AlertTriangle, ListChecks, CalendarPlus, Sparkles, AlertCircle, RotateCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

interface NoteChatProps {
  note: {
    title: string;
    transcript: string | null;
    summary: string | null;
    key_topics: string[];
    action_items: any[];
    follow_ups: any[];
    decisions: string[];
    insights: string[];
    mentioned_people: any[];
    open_questions: string[];
    manual_notes: string | null;
    created_at: string;
  };
}

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  { label: "Write follow-up email", icon: Mail, prompt: "Draft a professional follow-up email based on this meeting. Reference specific discussion points, agreed actions, and next steps. Make it ready to send." },
  { label: "List objections", icon: AlertTriangle, prompt: "Extract every objection, concern, or pushback raised during this meeting. Quote exact words where possible and suggest how to address each one." },
  { label: "Pending commitments", icon: ListChecks, prompt: "List all commitments, promises, and deadlines mentioned in this meeting. Who promised what, and by when?" },
  { label: "Follow-up agenda", icon: CalendarPlus, prompt: "Create an agenda for a follow-up meeting based on unresolved topics, open questions, and pending action items from this meeting." },
  { label: "Key takeaways", icon: Sparkles, prompt: "What are the 3-5 most important takeaways from this meeting that I should remember?" },
];

const NoteChat = ({ note }: NoteChatProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessages, setLastMessages] = useState<Msg[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const runChat = useCallback(async (newMessages: Msg[]) => {
    setLastMessages(newMessages);
    setError(null);
    setStreaming(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/note-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ messages: newMessages, note }),
        }
      );

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "AI unavailable" }));
        throw new Error(err.error || "Something went wrong.");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error("note-chat stream error:", e);
      setError(e?.message || "Failed to connect to AI.");
    } finally {
      setStreaming(false);
    }
  }, [note]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    runChat(newMessages);
  }, [messages, streaming, runChat]);

  const handleRetry = () => {
    if (lastMessages) runChat(lastMessages);
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <>
      {/* Floating toggle */}
      {!open && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-5 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
        >
          <MessageSquare size={20} className="text-primary-foreground" />
        </motion.button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-x-0 bottom-0 z-50 max-w-lg mx-auto"
          >
            <div className="bg-card border border-border rounded-t-2xl shadow-2xl flex flex-col" style={{ height: "60vh", maxHeight: 520 }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ask about this note</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{note.title}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Ask anything about this meeting, or try a quick action:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleQuickAction(action.prompt)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-border/60 text-xs font-medium text-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors"
                        >
                          <action.icon size={12} />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-foreground rounded-bl-md"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}

                {streaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-secondary rounded-2xl rounded-bl-md px-3.5 py-2.5">
                      <Loader2 size={14} className="text-primary animate-spin" />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5">
                    <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-destructive">Couldn't reach the assistant</p>
                      <p className="text-[11px] text-destructive/80 mt-0.5 break-words">{error}</p>
                    </div>
                    <button
                      onClick={handleRetry}
                      disabled={streaming || !lastMessages}
                      className="flex items-center gap-1 rounded-lg bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-40 shrink-0"
                    >
                      <RotateCw size={11} className={streaming ? "animate-spin" : ""} />
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Quick actions after first exchange */}
              {messages.length > 0 && !streaming && (
                <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                  {QUICK_ACTIONS.slice(0, 3).map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.prompt)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/80 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors whitespace-nowrap shrink-0"
                    >
                      <action.icon size={10} />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-4 pb-4 pt-2 border-t border-border/60">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(input);
                      }
                    }}
                    placeholder="Ask about this meeting…"
                    rows={1}
                    className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none outline-none focus:ring-1 focus:ring-primary/30 max-h-20"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || streaming}
                    className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {streaming ? (
                      <Loader2 size={14} className="text-primary-foreground animate-spin" />
                    ) : (
                      <Send size={14} className="text-primary-foreground" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NoteChat;
