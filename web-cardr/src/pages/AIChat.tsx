import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, Sparkles, Mic, MicOff, AlertCircle, RotateCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useApp, type Contact } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNavigate } from "react-router-dom";
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";


type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${SUPABASE_FUNCTIONS_URL}/ai-chat`;

const suggestions = [
  "Give me a monthly networking summary",
  "How many contacts per pipeline stage?",
  "Who should I follow up with?",
  "Summarize all my meeting notes",
  "Show industry breakdown of my contacts",
  "What events did I attend and who did I meet?",
  "Create a contact named John Smith at Acme Corp",
];

const AIChat = () => {
  const { contacts, folders, addContact, updateContact, deleteContact } = useApp();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessages, setLastUserMessages] = useState<Msg[] | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice recognition
  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        setInput(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error !== "aborted") {
        toast.error("Voice recognition failed");
      }
    };

    recognition.start();
    setIsListening(true);
  }, [isListening]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Process tool calls returned by AI
  const processToolCalls = useCallback(async (toolCalls: any[]) => {
    const results: string[] = [];
    for (const call of toolCalls) {
      const { name, arguments: args } = call.function || call;
      const parsed = typeof args === "string" ? JSON.parse(args) : args;

      switch (name) {
        case "navigate_to": {
          navigate(parsed.path);
          results.push(`Navigated to ${parsed.path}`);
          break;
        }
        case "create_contact": {
          const newContact: Contact = {
            id: crypto.randomUUID(),
            name: parsed.name,
            company: parsed.company || "",
            title: parsed.title || "",
            email: parsed.email || "",
            phone: parsed.phone || "",
            scannedAt: new Date().toISOString(),
            notes: parsed.notes || "",
          };
          addContact(newContact);
          results.push(`Created contact: ${parsed.name}`);
          toast.success(`Created contact: ${parsed.name}`);
          break;
        }
        case "update_contact": {
          const contact = contacts.find(
            (c) => c.name.toLowerCase() === parsed.contact_name?.toLowerCase() || c.id === parsed.contact_id
          );
          if (contact) {
            const updates: Partial<Contact> = {};
            if (parsed.company) updates.company = parsed.company;
            if (parsed.title) updates.title = parsed.title;
            if (parsed.email) updates.email = parsed.email;
            if (parsed.phone) updates.phone = parsed.phone;
            if (parsed.notes) updates.notes = parsed.notes;
            if (parsed.stage_id) updates.stageId = parsed.stage_id;
            updateContact(contact.id, updates);
            results.push(`Updated contact: ${contact.name}`);
            toast.success(`Updated ${contact.name}`);
          } else {
            results.push(`Contact not found: ${parsed.contact_name || parsed.contact_id}`);
          }
          break;
        }
        case "delete_contact": {
          const contact = contacts.find(
            (c) => c.name.toLowerCase() === parsed.contact_name?.toLowerCase() || c.id === parsed.contact_id
          );
          if (contact) {
            deleteContact(contact.id);
            results.push(`Deleted contact: ${contact.name}`);
            toast.success(`Deleted ${contact.name}`);
          } else {
            results.push(`Contact not found: ${parsed.contact_name || parsed.contact_id}`);
          }
          break;
        }
        case "move_contacts_to_stage": {
          const stageId = parsed.stage_id;
          const contactNames: string[] = parsed.contact_names || [];
          let moved = 0;
          for (const name of contactNames) {
            const c = contacts.find((ct) => ct.name.toLowerCase() === name.toLowerCase());
            if (c) {
              updateContact(c.id, { stageId });
              moved++;
            }
          }
          results.push(`Moved ${moved} contacts to stage`);
          if (moved > 0) toast.success(`Moved ${moved} contacts`);
          break;
        }
        case "enrich_contacts": {
          const toEnrich = parsed.contact_names
            ? contacts.filter((c) => parsed.contact_names.some((n: string) => c.name.toLowerCase() === n.toLowerCase()) && !c.enriched)
            : contacts.filter((c) => !c.enriched);
          let enriched = 0;
          for (const contact of toEnrich.slice(0, 10)) {
            try {
              const { data } = await supabase.functions.invoke("enrich-contact", {
                body: { contact: { name: contact.name, company: contact.company, title: contact.title, email: contact.email } },
              });
              if (data?.enriched) {
                const updates: Partial<Contact> = { enriched: true, enrichedAt: new Date().toISOString() };
                if (data.enriched.linkedin) updates.linkedin = data.enriched.linkedin;
                if (data.enriched.website) updates.website = data.enriched.website;
                if (data.enriched.location) updates.location = data.enriched.location;
                if (data.enriched.industry) updates.industry = data.enriched.industry;
                updateContact(contact.id, updates);
                enriched++;
              }
            } catch { /* skip */ }
          }
          results.push(`Enriched ${enriched} contacts`);
          if (enriched > 0) toast.success(`Enriched ${enriched} contacts`);
          break;
        }
        default:
          results.push(`Unknown action: ${name}`);
      }
    }
    return results;
  }, [contacts, addContact, updateContact, deleteContact, navigate]);

  const streamChat = async (userMessages: Msg[]) => {
    // Load pipeline stages and notes for context
    let stages: any[] = [];
    let notes: any[] = [];
    if (user) {
      const [stageRes, noteRes] = await Promise.all([
        supabase.from("pipeline_stages").select("id, name, color, sort_order").eq("user_id", user.id).order("sort_order"),
        supabase.from("meeting_notes").select("id, title, summary, key_topics, action_items, decisions, follow_ups, manual_notes, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (stageRes.data) stages = stageRes.data;
      if (noteRes.data) notes = noteRes.data;
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: userMessages,
        contacts: contacts.map((c) => ({
          id: c.id, name: c.name, title: c.title, company: c.company,
          email: c.email, phone: c.phone, linkedin: c.linkedin,
          location: c.location, industry: c.industry, notes: c.notes,
          scannedAt: c.scannedAt, enriched: c.enriched, stageId: c.stageId,
          conversationStatus: c.conversationStatus,
        })),
        folders: folders.map((f) => ({ id: f.id, name: f.name, emoji: f.emoji })),
        stages: stages.map((s) => ({ id: s.id, name: s.name })),
        notes,
        enableTools: true,
      }),
    });

    if (!resp.ok || !resp.body) {
      const err = await resp.json().catch(() => ({ error: "Failed to connect" }));
      throw new Error(err.error || "Failed to connect");
    }

    // Check if it's a tool call response (non-streaming JSON)
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await resp.json();
      if (data.tool_calls) {
        const results = await processToolCalls(data.tool_calls);
        const resultMsg = results.join("\n");
        setMessages((prev) => [...prev, { role: "assistant", content: `✅ Done!\n\n${resultMsg}${data.message ? `\n\n${data.message}` : ""}` }]);
        return;
      }
      if (data.message) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        return;
      }
    }

    // Stream SSE
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

  return (
    <div className="min-h-screen flex flex-col pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-3">
        <PageHeader />
        <div className="flex items-center gap-3 -mt-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center">
            <Sparkles size={18} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-foreground">{t("aiChat.title")}</h1>
            <p className="text-[11px] text-muted-foreground">{t("aiChat.subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="pt-8 pb-4">
            <p className="text-sm text-muted-foreground text-center mb-5">
              {t("aiChat.emptyHint")}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1.5 hover:bg-primary/15 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={13} className="text-primary" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
              msg.role === "user"
                ? "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground"
                : "bg-card border border-border/60 text-foreground"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-neutral max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0.5 text-sm">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User size={13} className="text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot size={13} className="text-primary" />
            </div>
            <div className="bg-card border border-border/60 rounded-2xl px-3.5 py-2.5">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
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

      {/* Input */}
      <div className="px-5 py-3 border-t border-border/60 bg-background">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening…" : t("aiChat.placeholder")}
            className={`flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 ${isListening ? "ring-2 ring-primary/40" : ""}`}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={toggleListening}
            disabled={isLoading}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isListening
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0"
          >
            <Send size={15} className="text-primary-foreground" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChat;
