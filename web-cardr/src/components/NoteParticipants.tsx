import { useState, useEffect } from "react";
import { X, UserPlus, Users, Search, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

interface Participant {
  id: string;
  name: string;
  speaker_label: string | null;
  contact_id: string | null;
}

interface NoteParticipantsProps {
  noteId: string;
  open: boolean;
  onClose: () => void;
}

const NoteParticipants = ({ noteId, open, onClose }: NoteParticipantsProps) => {
  const { user } = useAuth();
  const { contacts } = useApp();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [manualName, setManualName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      const { data } = await supabase
        .from("meeting_participants")
        .select("*")
        .eq("meeting_note_id", noteId)
        .eq("user_id", user.id);
      if (data) setParticipants(data.map(d => ({ id: d.id, name: d.name, speaker_label: d.speaker_label, contact_id: d.contact_id })));
      setLoading(false);
    };
    load();
  }, [open, noteId, user]);

  const addFromContact = async (contact: { id: string; name: string }) => {
    if (!user) return;
    if (participants.some(p => p.contact_id === contact.id)) {
      toast.error("Already added");
      return;
    }
    const { data, error } = await supabase
      .from("meeting_participants")
      .insert({ meeting_note_id: noteId, user_id: user.id, name: contact.name, contact_id: contact.id })
      .select()
      .single();
    if (data) {
      setParticipants(prev => [...prev, { id: data.id, name: data.name, speaker_label: data.speaker_label, contact_id: data.contact_id }]);
      toast.success(`Added ${contact.name}`);
    }
    if (error) toast.error("Could not add participant");
    setSearch("");
  };

  const addManual = async () => {
    if (!user || !manualName.trim()) return;
    const { data, error } = await supabase
      .from("meeting_participants")
      .insert({ meeting_note_id: noteId, user_id: user.id, name: manualName.trim() })
      .select()
      .single();
    if (data) {
      setParticipants(prev => [...prev, { id: data.id, name: data.name, speaker_label: data.speaker_label, contact_id: data.contact_id }]);
      toast.success(`Added ${manualName.trim()}`);
      setManualName("");
    }
    if (error) toast.error("Could not add participant");
  };

  const updateSpeakerLabel = async (id: string, label: string) => {
    await supabase.from("meeting_participants").update({ speaker_label: label }).eq("id", id);
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, speaker_label: label } : p));
  };

  const removeParticipant = async (id: string) => {
    await supabase.from("meeting_participants").delete().eq("id", id);
    setParticipants(prev => prev.filter(p => p.id !== id));
    toast.success("Removed");
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) && !participants.some(p => p.contact_id === c.id)
  ).slice(0, 5);

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
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-t-3xl border border-border/60 p-5 pb-8 max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <h3 className="text-base font-display font-bold text-foreground">Participants</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Current participants */}
          {participants.length > 0 && (
            <div className="space-y-2 mb-4">
              {participants.map(p => (
                <div key={p.id} className="card-elevated p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <input
                      value={p.speaker_label || ""}
                      onChange={e => updateSpeakerLabel(p.id, e.target.value)}
                      placeholder="Speaker label (e.g. Speaker 1)"
                      className="text-[11px] text-muted-foreground bg-transparent outline-none w-full placeholder:text-muted-foreground/40"
                    />
                  </div>
                  <button onClick={() => removeParticipant(p.id)} className="shrink-0">
                    <Trash2 size={13} className="text-destructive/60 hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add from contacts */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Add from contacts</p>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="w-full h-9 rounded-xl bg-secondary border border-border pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            {search && filteredContacts.length > 0 && (
              <div className="space-y-1 mb-2">
                {filteredContacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => addFromContact(c)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary/80 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.company}{c.title ? ` · ${c.title}` : ""}</p>
                    </div>
                    <UserPlus size={13} className="text-primary ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add manually */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Add manually</p>
            <div className="flex gap-2">
              <input
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addManual()}
                placeholder="Name"
                className="flex-1 h-9 rounded-xl bg-secondary border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <button onClick={addManual} disabled={!manualName.trim()} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-30">
                Add
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NoteParticipants;
