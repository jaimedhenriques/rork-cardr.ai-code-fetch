import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Search, Grid3X3, Users, Delete, Clock, ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, parseISO } from "date-fns";

type Tab = "recents" | "contacts" | "keypad";

interface CallRecord {
  id: string;
  title: string;
  created_at: string;
  duration_seconds: number | null;
  contactName: string | null;
  phone: string | null;
}

const DIAL_KEYS = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

const nameColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 65%)`;
};

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const PhoneDialer = () => {
  const navigate = useNavigate();
  const { contacts } = useApp();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("recents");
  const [search, setSearch] = useState("");
  const [dialNumber, setDialNumber] = useState("");
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch call history from meeting_notes with "phone call" in title
  useEffect(() => {
    if (!user) { setLoadingHistory(false); return; }
    const fetchHistory = async () => {
      setLoadingHistory(true);
      const { data } = await supabase
        .from("meeting_notes")
        .select("id, title, created_at, duration_seconds")
        .eq("user_id", user.id)
        .ilike("title", "%phone call%")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setCallHistory(
          data.map((n) => {
            const match = n.title.match(/Phone call with (.+)/i);
            const contactName = match ? match[1] : null;
            const matchedContact = contactName
              ? contacts.find((c) => c.name.toLowerCase() === contactName.toLowerCase())
              : null;
            return {
              id: n.id,
              title: n.title,
              created_at: n.created_at,
              duration_seconds: n.duration_seconds,
              contactName,
              phone: matchedContact?.phone || null,
            };
          })
        );
      }
      setLoadingHistory(false);
    };
    fetchHistory();
  }, [user, contacts]);

  const sortedContacts = useMemo(() => {
    const withPhone = contacts.filter((c) => c.phone);
    const filtered = search
      ? withPhone.filter(
          (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.phone.includes(search) ||
            c.company.toLowerCase().includes(search.toLowerCase())
        )
      : withPhone;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof sortedContacts> = {};
    sortedContacts.forEach((c) => {
      const letter = c.name[0]?.toUpperCase() || "#";
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => (a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b)));
  }, [sortedContacts]);

  const handleCall = (phoneNumber: string, contactName?: string, contactId?: string) => {
    navigate("/notes/record", {
      state: {
        prefillTitle: contactName ? `Phone call with ${contactName}` : `Phone call`,
        templateId: "phone-call",
        autoRecord: true,
        contactName: contactName || null,
        contactId: contactId || null,
        phoneNumber: phoneNumber || null,
      },
    });
  };

  const handleDial = () => {
    if (dialNumber.length >= 3) {
      handleCall(dialNumber);
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof Clock }[] = [
    { key: "recents", label: "Recents", icon: Clock },
    { key: "contacts", label: "Contacts", icon: Users },
    { key: "keypad", label: "Keypad", icon: Grid3X3 },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-12">
        <PageHeader back title="Phone" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              tab === t.key ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Recents Tab */}
        {tab === "recents" && (
          <motion.div key="recents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 pt-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : callHistory.length === 0 ? (
              <div className="text-center py-16">
                <Clock size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No recent calls</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Calls made through Cardr will appear here</p>
              </div>
            ) : (
              <div className="space-y-1">
                {callHistory.map((call) => {
                  const initial = call.contactName
                    ? call.contactName.split(" ").map((n) => n[0]).join("").slice(0, 2)
                    : "?";
                  const color = call.contactName ? nameColor(call.contactName) : "hsl(0, 0%, 50%)";

                  return (
                    <button
                      key={call.id}
                      onClick={() => navigate(`/notes/${call.id}`)}
                      className="flex items-center gap-3 py-3 w-full text-left group hover:bg-secondary/40 -mx-2 px-2 rounded-xl transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {call.contactName || "Unknown"}
                        </p>
                        <div className="flex items-center gap-2">
                          <Phone size={10} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {call.phone || "Outgoing call"}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right mr-1">
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(parseISO(call.created_at), { addSuffix: true })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {formatDuration(call.duration_seconds)}
                        </p>
                      </div>
                      {call.phone ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCall(call.phone!, call.contactName || undefined); }}
                          className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors active:scale-95"
                          title="Call back"
                        >
                          <Phone size={14} className="text-primary" />
                        </button>
                      ) : (
                        <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Contacts Tab */}
        {tab === "contacts" && (
          <motion.div key="contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 pt-4">
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts"
                className="w-full h-10 rounded-xl bg-card border border-border pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1">
              {grouped.map(([letter, contacts]) => (
                <div key={letter}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1.5 border-b border-border/30">{letter}</p>
                  {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center gap-3 py-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: nameColor(contact.name) }}
                      >
                        {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      </div>
                      <button
                        onClick={() => handleCall(contact.phone, contact.name, contact.id)}
                        className="w-10 h-10 rounded-full bg-muted/50 hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors"
                      >
                        <Phone size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              {sortedContacts.length === 0 && (
                <div className="text-center py-16">
                  <Users size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">{search ? "No contacts found" : "No contacts with phone numbers"}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Keypad Tab */}
        {tab === "keypad" && (
          <motion.div key="keypad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 pt-8 flex flex-col items-center">
            <div className="h-16 flex items-center justify-center mb-6 w-full">
              <p className="text-3xl font-light text-foreground tracking-widest text-center">
                {dialNumber || <span className="text-muted-foreground/30">|</span>}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
              {DIAL_KEYS.map(({ digit, letters }) => (
                <button
                  key={digit}
                  onClick={() => setDialNumber((prev) => prev + digit)}
                  className="w-full aspect-square rounded-full bg-muted/60 hover:bg-muted flex flex-col items-center justify-center transition-colors active:scale-95"
                >
                  <span className="text-2xl font-medium text-foreground">{digit}</span>
                  {letters && <span className="text-[9px] tracking-[0.2em] text-muted-foreground mt-0.5">{letters}</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-8 mt-6 w-full max-w-[280px]">
              <div className="w-16" />
              <button
                onClick={handleDial}
                disabled={dialNumber.length < 3}
                className="w-16 h-16 rounded-full bg-accent flex items-center justify-center transition-colors hover:opacity-90 disabled:opacity-30"
              >
                <Phone size={24} className="text-accent-foreground" />
              </button>
              <button
                onClick={() => setDialNumber((prev) => prev.slice(0, -1))}
                className={`w-16 h-16 flex items-center justify-center transition-opacity ${dialNumber.length === 0 ? "opacity-0" : "opacity-100"}`}
              >
                <Delete size={24} className="text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhoneDialer;
