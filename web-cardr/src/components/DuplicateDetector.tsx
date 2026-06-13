import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Merge, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useApp, type Contact } from "@/context/AppContext";
import { toast } from "sonner";

interface DuplicateGroup {
  key: string;
  contacts: Contact[];
  reason: string;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const findDuplicates = (contacts: Contact[]): DuplicateGroup[] => {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  // Check by email
  const byEmail = new Map<string, Contact[]>();
  for (const c of contacts) {
    if (c.email) {
      const key = normalize(c.email);
      if (key) {
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key)!.push(c);
      }
    }
  }
  for (const [email, cs] of byEmail) {
    if (cs.length > 1) {
      const key = `email:${email}`;
      groups.push({ key, contacts: cs, reason: `Same email: ${cs[0].email}` });
      cs.forEach((c) => seen.add(c.id));
    }
  }

  // Check by phone
  const byPhone = new Map<string, Contact[]>();
  for (const c of contacts) {
    if (c.phone) {
      const key = c.phone.replace(/[^0-9+]/g, "");
      if (key.length >= 7) {
        if (!byPhone.has(key)) byPhone.set(key, []);
        byPhone.get(key)!.push(c);
      }
    }
  }
  for (const [phone, cs] of byPhone) {
    if (cs.length > 1) {
      const allSeen = cs.every((c) => seen.has(c.id));
      if (!allSeen) {
        groups.push({ key: `phone:${phone}`, contacts: cs, reason: `Same phone: ${cs[0].phone}` });
        cs.forEach((c) => seen.add(c.id));
      }
    }
  }

  // Check by name (fuzzy)
  const byName = new Map<string, Contact[]>();
  for (const c of contacts) {
    const key = normalize(c.name);
    if (key.length >= 3) {
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(c);
    }
  }
  for (const [name, cs] of byName) {
    if (cs.length > 1) {
      const allSeen = cs.every((c) => seen.has(c.id));
      if (!allSeen) {
        groups.push({ key: `name:${name}`, contacts: cs, reason: `Same name: ${cs[0].name}` });
      }
    }
  }

  return groups;
};

const DuplicateDetector = () => {
  const { contacts, updateContact, deleteContact } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);

  const duplicates = useMemo(() => findDuplicates(contacts), [contacts]);

  const handleMerge = (group: DuplicateGroup) => {
    // Keep the first (oldest by scannedAt), merge data from others
    const sorted = [...group.contacts].sort(
      (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
    );
    const primary = sorted[0];
    const others = sorted.slice(1);

    // Merge: fill empty fields from duplicates
    const merged: Partial<Contact> = {};
    for (const other of others) {
      if (!primary.email && other.email) merged.email = other.email;
      if (!primary.phone && other.phone) merged.phone = other.phone;
      if (!primary.title && other.title) merged.title = other.title;
      if (!primary.company && other.company) merged.company = other.company;
      if (!primary.linkedin && other.linkedin) merged.linkedin = other.linkedin;
      if (!primary.website && other.website) merged.website = other.website;
      if (!primary.location && other.location) merged.location = other.location;
      if (!primary.industry && other.industry) merged.industry = other.industry;
      if (!primary.companySize && other.companySize) merged.companySize = other.companySize;
      if (!primary.notes && other.notes) merged.notes = other.notes;
      else if (other.notes && primary.notes && other.notes !== primary.notes) {
        merged.notes = `${primary.notes}\n\n---\n${other.notes}`;
      }
      if (other.enriched && !primary.enriched) {
        merged.enriched = true;
        merged.enrichedAt = other.enrichedAt;
      }
    }

    // Apply merged data to primary
    if (Object.keys(merged).length > 0) {
      updateContact(primary.id, merged);
    }

    // Delete duplicates
    for (const other of others) {
      deleteContact(other.id);
    }

    toast.success(`Merged ${group.contacts.length} contacts into "${primary.name}"`);
    setMerging(null);
  };

  if (duplicates.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full card-elevated p-3 flex items-center gap-2.5 text-left"
      >
        <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <AlertTriangle size={14} className="text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            {duplicates.length} potential duplicate{duplicates.length > 1 ? "s" : ""} found
          </p>
          <p className="text-[10px] text-muted-foreground">Tap to review and merge</p>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 mt-2">
              {duplicates.map((group) => (
                <div key={group.key} className="card-elevated p-3">
                  <p className="text-[10px] font-semibold text-warning uppercase tracking-wider mb-2">{group.reason}</p>
                  <div className="space-y-1.5 mb-2.5">
                    {group.contacts.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-6 avatar-circle text-[9px] shrink-0">
                          {c.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground">{c.name}</span>
                          <span className="text-muted-foreground"> · {c.company || "No company"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleMerge(group)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <Merge size={12} /> Merge into one
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DuplicateDetector;
