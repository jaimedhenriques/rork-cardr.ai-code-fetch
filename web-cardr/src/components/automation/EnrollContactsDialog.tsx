import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useEnrollContacts } from "@/hooks/useAutomationSequences";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sequenceId: string | null;
}

export default function EnrollContactsDialog({ open, onOpenChange, sequenceId }: Props) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const enroll = useEnrollContacts();

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("contacts")
      .select("id, name, company, avatar, email")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setContacts(data || []);
        setLoading(false);
      });
  }, [open, user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleEnroll = async () => {
    if (!sequenceId || selected.size === 0) return;
    await enroll.mutateAsync({ sequenceId, contactIds: Array.from(selected) });
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll contacts</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <ScrollArea className="h-[400px] border rounded-md">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No contacts found</div>
            ) : (
              <div className="divide-y">
                {filtered.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <Avatar className="size-8">
                      <AvatarImage src={c.avatar} />
                      <AvatarFallback>{c.name?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.company || c.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>

          <p className="text-xs text-muted-foreground">{selected.size} selected</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleEnroll} disabled={selected.size === 0 || enroll.isPending}>
            {enroll.isPending && <Loader2 className="size-4 animate-spin" />}
            Enroll {selected.size > 0 && `(${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
