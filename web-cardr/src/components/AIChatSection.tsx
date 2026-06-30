import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, Sparkles, Trash2, Mic, Square, AlertCircle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import ReactMarkdown from "react-markdown";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${SUPABASE_FUNCTIONS_URL}/ai-chat`;

const AIChatSection = () => {
  const { contacts, folders } = useApp();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessages, setLastUserMessages] = useState<Msg[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const suggestions = [
    t("ai.whoDidIMeet"),
    t("ai.contactsInTech"),
    t("ai.suggestFollowUps"),
    t("ai.summarizeActivity"),
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const streamChat = async (userMessages: Msg[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages: userMessages,
        contacts: contacts.map((c) => ({
          name: c.name, title: c.title, company: c.company,
          email: c.email, phone: c.phone, linkedin: c.linkedin,
          location: c.location, industry: c.industry, notes: c.notes,
          scannedAt: c.scannedAt,
        })),
        folders: folders.map((f) => ({ name: f.name, emoji: f.emoji })),
      }),
    });

    if (!resp.ok || !resp.body) {
      const err = await resp.json().catch(() => ({ error: "Failed to connect" }));
      throw new Error(err.error || "Failed to connect");
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantSoFar = "";

    const updateAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    let streamDone = false;
    while (!streamDone) {
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
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) updateAssistant(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  };

  const runChat = async (userMessages: Msg[]) => {
    setLastUserMessages(userMessages);
    setError(null);
    setIsLoading(true);
    try {
      await streamChat(userMessages);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (text?: string) => {
    const message = text || input.trim();
    if (!message || isLoading) return;

    const userMsg: Msg = { role: "user", content: message };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    await runChat(next);
  };

  const handleRetry = () => {
    if (lastUserMessages) runChat(lastUserMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="card-elevated overflow-hidden flex flex-col" style={{ minHeight: hasMessages ? 420 : "auto" }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border/60">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center">
          <Sparkles size={16} className="text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">{t("ai.title")}</p>
          <p className="text-[11px] text-muted-foreground">{t("ai.subtitle")}</p>
        </div>
        {hasMessages && (
          <button
            onClick={() => setMessages([])}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title={t("ai.clearChat")}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Messages area */}
      {hasMessages ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 320 }}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-primary" />
                </div>
              )}
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-neutral max-w-none [&_p]:m-0 [&_ul]:my-1.5 [&_li]:my-0.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 text-[13px] leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User size={14} className="text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
                <Bot size={14} className="text-primary" />
              </div>
              <div className="bg-secondary rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t("ai.thinking")}</span>
              </div>
            </div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3"
            >
              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-destructive">{t("ai.errorTitle")}</p>
                <p className="text-[12px] text-destructive/80 mt-0.5">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                disabled={isLoading || !lastUserMessages}
                className="flex items-center gap-1.5 rounded-lg bg-destructive/15 px-2.5 py-1.5 text-[12px] font-semibold text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-40"
              >
                <RotateCw size={12} className={isLoading ? "animate-spin" : ""} />
                {t("ai.retry")}
              </button>
            </motion.div>
          )}
        </div>
      ) : (
        /* Empty state with suggestions */
        <div className="px-4 py-5 flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground mb-1">{t("ai.askAnything")}</p>
            <p className="text-xs text-muted-foreground">{t("ai.canSearch")}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-xs font-medium text-primary bg-primary-light rounded-full px-3.5 py-2 hover:bg-primary/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-3 border-t border-border/60 mt-auto">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("ai.placeholder")}
            rows={1}
            className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
            disabled={isLoading}
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={toggleVoice}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              listening
                ? "bg-destructive text-destructive-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {listening ? <Square size={14} /> : <Mic size={16} />}
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0"
          >
            <Send size={16} className="text-primary-foreground" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChatSection;
