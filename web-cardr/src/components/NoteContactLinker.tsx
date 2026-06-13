import { useState, useMemo } from "react";
import { Search, Link2, UserPlus, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface MentionedPerson {
  name: string;
  role?: string;
  context?: string;
  contactId?: string;
  linkedContactName?: string;
}

interface NoteContactLinkerProps {
  noteId: string;
  mentionedPeople: MentionedPerson[];
  open: boolean;
  onClose: () => void;
  onLinked: (personName: string, contactId: string, contactName: string) => void;
  onUnlinked?: (personName: string) => void;
}

const NoteContactLinker = ({ noteId, mentionedPeople, open, onClose, onLinked, onUnlinked }: NoteContactLinkerProps) => {
  const { user } = useAuth();
  const { contacts } = useApp();
  const [linked, setLinked] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    mentionedPeople.forEach((p) => {
      if (p.contactId) initial[p.name] = p.contactId;
    });
    return initial;
  });
  const [searchIdx, setSearchIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const suggestions = useMemo(() => {
    return mentionedPeople.map((person) => {
      const name = person.name.toLowerCase();
      const matches = contacts.filter((c) => {
        const cName = c.name.toLowerCase();
        return cName.includes(name) || name.includes(cName) ||
          name.split(" ").some((w: string) => w.length > 2 && cName.includes(w));
      }).slice(0, 3);
      return { person, matches };
    });
  }, [mentionedPeople, contacts]);

  const filteredContacts = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [search, contacts]);

  const linkContact = async (personName: string, contactId: string, contactName: string) => {
    if (!user) return;
    const existing = await supabase
      .from("meeting_participants")
      .select("id")
      .eq("meeting_note_id", noteId)
      .eq("contact_id", contactId)
      .eq("user_id", user.id);

    if (!existing.data?.length) {
      await supabase.from("meeting_participants").insert({
        meeting_note_id: noteId,
        user_id: user.id,
        name: contactName,
        contact_id: contactId,
      });
    }
    setLinked((prev) => ({ ...prev, [personName]: contactId }));
    toast.success(`Linked ${personName} → ${contactName}`);
    onLinked(personName, contactId, contactName);
  };

  const unlinkContact = async (personName: string) => {
    if (!user) return;
    const contactId = linked[personName];
    if (contactId) {
      await supabase
        .from("meeting_participants")
        .delete()
        .eq("meeting_note_id", noteId)
        .eq("contact_id", contactId)
        .eq("user_id", user.id);
    }
    setLinked((prev) => {
      const next = { ...prev };
      delete next[personName];
      return next;
    });
    toast.success(`Unlinked ${personName}`);
    onUnlinked?.(personName);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-t-3xl border border-border/60 p-5 pb-8 max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-primary" />
              <h3 className="text-base font-display font-bold text-foreground">Link Contacts</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            {mentionedPeople.length > 0
              ? `AI detected ${mentionedPeople.length} people. Link them to your contacts for richer context.`
              : "Search and link contacts to this note."}
          </p>

          {/* Always show a search bar at the top */}
          <div className="mb-4">
            <div className="relative mb-1">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts to link…"
                className="w-full h-9 rounded-lg bg-secondary border border-border pl-7 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            {search && filteredContacts.length > 0 && (
              <div className="space-y-0.5">
                {filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      linkContact(c.name, c.id, c.name);
                      setSearch("");
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/80 transition-colors text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.company}{c.title ? ` · ${c.title}` : ""}</p>
                    </div>
                    <Link2 size={11} className="text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {search && filteredContacts.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">No contacts match "{search}"</p>
            )}
          </div>

          <div className="space-y-3">
            {suggestions.map(({ person, matches }, idx) => (
              <div key={idx} className="card-elevated p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">{person.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{person.name}</p>
                    {person.role && <p className="text-[10px] text-muted-foreground">{person.role}</p>}
                  </div>
                  {linked[person.name] ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                        <Check size={12} /> Linked
                      </span>
                      <button
                        onClick={() => unlinkContact(person.name)}
                        className="flex items-center gap-0.5 text-[10px] font-semibold text-destructive hover:text-destructive/80 transition-colors"
                      >
                        <X size={11} /> Unlink
                      </button>
                    </div>
                  ) : null}
                </div>

                {!linked[person.name] && (
                  <>
                    {matches.length > 0 ? (
                      <div className="space-y-1 ml-9">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Suggested matches</p>
                        {matches.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => linkContact(person.name, c.id, c.name)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/80 transition-colors text-left"
                          >
                            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent">
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground truncate">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{c.company}{c.title ? ` · ${c.title}` : ""}</p>
                            </div>
                            <Link2 size={11} className="text-primary shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {searchIdx === idx ? (
                      <div className="ml-9 mt-1">
                        <div className="relative mb-1">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search contacts…"
                            autoFocus
                            className="w-full h-8 rounded-lg bg-secondary border border-border pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        {filteredContacts.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              linkContact(person.name, c.id, c.name);
                              setSearchIdx(null);
                              setSearch("");
                            }}
                            className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary/80 text-left"
                          >
                            <p className="text-xs text-foreground truncate">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{c.company}</p>
                          </button>
                        ))}
                        <button onClick={() => { setSearchIdx(null); setSearch(""); }} className="text-[10px] text-muted-foreground mt-1">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSearchIdx(idx)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary ml-9 mt-1"
                      >
                        <Search size={10} /> Search contacts
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NoteContactLinker;
