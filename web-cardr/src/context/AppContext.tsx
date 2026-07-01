import { useState, createContext, useContext, ReactNode, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { triggerWebhooks } from "@/lib/webhook";
import { fireWebhook } from "@/lib/webhooks";
import { dedupePhonePatch } from "@/lib/phone-dedup";
import { enrichContactViaIcypeas } from "@/lib/icypeas";
import { cleanFolderName, findFolderByName } from "@/lib/folder-match";

export interface Contact {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  mobilePhone?: string;
  workPhone?: string;
  avatar?: string;
  folderId?: string;
  scannedAt: string;
  notes?: string;
  linkedin?: string;
  website?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  enriched?: boolean;
  enrichedAt?: string;
  stageId?: string;
  followUpDate?: string;
  birthday?: string;
  linkedinProfileUrl?: string;
  conversationStatus?: string;
  nextStep?: string;
  nextActionDate?: string;
  companyDescription?: string;
  companyLinkedin?: string;
  companyAddress?: string;
  companyEmail?: string;
  foundingYear?: number;
  annualRevenue?: string;
  companyType?: string;
}

export interface Folder {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
  /** Optional event this folder is grouped under (card-holder feature). */
  eventId?: string;
}

export interface UserProfile {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  avatar?: string;
  bookingUrl?: string;
}

export interface MessageTemplate {
  id: string;
  label: string;
  body: string;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "default-1",
    label: "After Meeting",
    body: "Hi {{firstName}}, it was great meeting you! I'd love to stay connected and explore potential synergies between our companies. Looking forward to keeping in touch.",
  },
  {
    id: "default-2",
    label: "Follow Up",
    body: "Hi {{firstName}}, I enjoyed our conversation at the event. I'd love to continue our discussion about {{company}}. Would you be open to a quick call next week?",
  },
  {
    id: "default-3",
    label: "Introduction",
    body: "Hi {{firstName}}, I came across your profile and was impressed by your work at {{company}}. I'd love to connect and learn more about what you're building.",
  },
];

const FREE_CONTACT_LIMIT = 25;

interface AppState {
  contacts: Contact[];
  folders: Folder[];
  profile: UserProfile;
  messageTemplates: MessageTemplate[];
  loading: boolean;
  isGuest: boolean;
  contactLimit: number;
  canAddContact: boolean;
  /** IDs of contacts currently being auto-enriched in the background. */
  enrichingIds: Set<string>;
  setContacts: (c: Contact[]) => void;
  addContact: (c: Contact) => Promise<Contact | null> | void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  setFolders: (f: Folder[]) => void;
  addFolder: (f: Folder) => Promise<Folder | null>;
  updateFolder: (id: string, updates: Partial<Pick<Folder, "name" | "emoji" | "eventId">>) => Promise<void>;
  deleteFolder: (id: string) => void;
  setProfile: (p: UserProfile) => void;
  setMessageTemplates: (t: MessageTemplate[]) => void;
}

const defaultProfile: UserProfile = {
  name: "",
  title: "",
  company: "",
  email: "",
  phone: "",
  website: "",
  linkedin: "",
};

const GUEST_CONTACTS_KEY = "cardscanpro_guest_contacts";
const GUEST_PROFILE_KEY = "cardscanpro_guest_profile";
const GUEST_FOLDERS_KEY = "cardscanpro_guest_folders";
const TEMPLATES_KEY = "cardscanpro_message_templates";

const loadLocal = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveLocal = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const AppContext = createContext<AppState | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

const mapContact = (row: any): Contact => ({
  id: row.id,
  name: row.name,
  company: row.company,
  title: row.title,
  email: row.email,
  phone: row.phone,
  mobilePhone: row.mobile_phone || undefined,
  workPhone: row.work_phone || undefined,
  avatar: row.avatar,
  folderId: row.folder_id,
  scannedAt: row.scanned_at,
  notes: row.notes,
  linkedin: row.linkedin,
  website: row.website,
  location: row.location,
  industry: row.industry,
  companySize: row.company_size,
  enriched: row.enriched,
  enrichedAt: row.enriched_at,
  stageId: row.stage_id,
  followUpDate: row.follow_up_date,
  birthday: row.birthday,
  linkedinProfileUrl: row.linkedin_profile_url,
  conversationStatus: row.conversation_status,
  nextStep: row.next_step,
  nextActionDate: row.next_action_date,
  companyDescription: row.company_description,
  companyLinkedin: row.company_linkedin,
  companyAddress: row.company_address,
  companyEmail: row.company_email,
  foundingYear: row.founding_year,
  annualRevenue: row.annual_revenue,
  companyType: row.company_type,
});

const mapFolder = (row: any): Folder => ({
  id: row.id,
  name: row.name,
  emoji: row.emoji,
  createdAt: row.created_at,
  eventId: row.event_id ?? undefined,
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const isGuest = !user;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [messageTemplates, setMessageTemplatesState] = useState<MessageTemplate[]>(() =>
    loadLocal<MessageTemplate[]>(TEMPLATES_KEY, DEFAULT_TEMPLATES)
  );
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  const markEnriching = useCallback((id: string, active: boolean) => {
    setEnrichingIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const canAddContact = contacts.length < FREE_CONTACT_LIMIT || !isGuest;

  // Load data
  useEffect(() => {
    if (isGuest) {
      setContacts(loadLocal(GUEST_CONTACTS_KEY, []));
      setFolders(loadLocal(GUEST_FOLDERS_KEY, []));
      setProfileState(loadLocal(GUEST_PROFILE_KEY, defaultProfile));
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      const [contactsRes, foldersRes, profileRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("user_id", user.id).order("scanned_at", { ascending: false }),
        supabase.from("folders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);

      if (contactsRes.data) setContacts(contactsRes.data.map(mapContact));
      if (foldersRes.data) setFolders(foldersRes.data.map(mapFolder));
      if (profileRes.data) {
        setProfileState({
          name: profileRes.data.name,
          title: profileRes.data.title,
          company: profileRes.data.company,
          email: profileRes.data.email || user.email || "",
          phone: profileRes.data.phone,
          website: profileRes.data.website,
          linkedin: profileRes.data.linkedin,
          avatar: profileRes.data.avatar,
          bookingUrl: (profileRes.data as any).booking_url || "",
        });
      }

      // Migrate guest data if any
      const guestContacts = loadLocal<Contact[]>(GUEST_CONTACTS_KEY, []);
      if (guestContacts.length > 0) {
        for (const c of guestContacts) {
          await supabase.from("contacts").insert({
            user_id: user.id,
            name: c.name, company: c.company, title: c.title,
            email: c.email, phone: c.phone, avatar: c.avatar,
            folder_id: c.folderId || null, notes: c.notes,
            linkedin: c.linkedin, website: c.website, location: c.location,
            industry: c.industry, company_size: c.companySize,
            enriched: c.enriched || false, enriched_at: c.enrichedAt || null,
            scanned_at: c.scannedAt,
          });
        }
        localStorage.removeItem(GUEST_CONTACTS_KEY);
        localStorage.removeItem(GUEST_FOLDERS_KEY);
        localStorage.removeItem(GUEST_PROFILE_KEY);
        // Reload contacts after migration
        const refreshed = await supabase.from("contacts").select("*").eq("user_id", user.id).order("scanned_at", { ascending: false });
        if (refreshed.data) setContacts(refreshed.data.map(mapContact));
      }

      setLoading(false);
    };

    loadData();
  }, [user, isGuest]);

  // Fire follow_up.due webhook for overdue contacts (once per contact per session)
  useEffect(() => {
    if (loading || contacts.length === 0) return;
    const FIRED_KEY = "cardscanpro_followup_fired";
    let fired: string[] = [];
    try { fired = JSON.parse(sessionStorage.getItem(FIRED_KEY) || "[]"); } catch {}
    const now = Date.now();
    const due = contacts.filter((c) => {
      if (!c.followUpDate || fired.includes(c.id)) return false;
      const t = new Date(c.followUpDate).getTime();
      return !isNaN(t) && t <= now;
    });
    if (due.length === 0) return;
    for (const c of due) {
      triggerWebhooks("follow_up.due", {
        id: c.id, name: c.name, company: c.company, email: c.email,
        followUpDate: c.followUpDate, nextStep: c.nextStep,
      });
      fired.push(c.id);
    }
    try { sessionStorage.setItem(FIRED_KEY, JSON.stringify(fired)); } catch {}
  }, [contacts, loading]);

  const addContact = useCallback(async (c: Contact): Promise<Contact | null> => {
    if (isGuest) {
      const updated = [c, ...contacts];
      setContacts(updated);
      saveLocal(GUEST_CONTACTS_KEY, updated);
      // Auto-enrich for guest users too
      if (!c.enriched && c.name) {
        markEnriching(c.id, true);
        enrichContactViaIcypeas({ name: c.name, company: c.company, title: c.title, email: c.email, linkedin: c.linkedin, website: c.website }).then((enrichData) => {
          if (enrichData?.enriched) {
            const e = enrichData.enriched;
            const updates: Partial<Contact> = { enriched: true, enrichedAt: new Date().toISOString() };
            if (e.linkedin) updates.linkedin = e.linkedin;
            if (e.website) updates.website = e.website;
            if (e.location) updates.location = e.location;
            if (e.industry) updates.industry = e.industry;
            if (e.companySize) updates.companySize = e.companySize;
            if (e.email && !c.email) updates.email = e.email;
            if (e.title && !c.title) updates.title = e.title;
            if (e.avatar) updates.avatar = e.avatar;
            const phonePatch = dedupePhonePatch(
              { phone: c.phone, mobilePhone: c.mobilePhone, workPhone: c.workPhone },
              { phone: e.phone, mobilePhone: e.mobilePhone, workPhone: e.workPhone },
            );
            if (phonePatch.mobilePhone) updates.mobilePhone = phonePatch.mobilePhone;
            if (phonePatch.workPhone) updates.workPhone = phonePatch.workPhone;
            if (phonePatch.phone && !c.phone) updates.phone = phonePatch.phone;
            setContacts((prev) => {
              const newList = prev.map((ct) => ct.id === c.id ? { ...ct, ...updates } : ct);
              saveLocal(GUEST_CONTACTS_KEY, newList);
              return newList;
            });
          }
        }).catch((err) => console.warn("Auto-enrich failed:", err)).finally(() => markEnriching(c.id, false));
      }
      return c;
    }
    if (!user) return null;
    const { data, error } = await supabase.from("contacts").insert({
      user_id: user.id, name: c.name, company: c.company, title: c.title,
      email: c.email, phone: c.phone, avatar: c.avatar,
      folder_id: c.folderId || null, notes: c.notes,
      linkedin: c.linkedin, website: c.website, location: c.location,
      industry: c.industry, company_size: c.companySize,
      enriched: c.enriched || false, enriched_at: c.enrichedAt || null,
      scanned_at: c.scannedAt,
    }).select().single();
    if (data) {
      const mapped = mapContact(data);
      setContacts((prev) => [mapped, ...prev]);
      // Send contact confirmation email
      if (mapped.email) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "contact-confirmation",
            recipientEmail: mapped.email,
            idempotencyKey: `contact-confirm-${mapped.id}`,
            templateData: { name: mapped.name || undefined },
          },
        }).catch((err) => console.warn("Contact confirmation email failed:", err));
      }
      // Trigger contact.created webhook (legacy localStorage + new subscriptions)
      const contactPayload = {
        id: mapped.id,
        name: mapped.name, company: mapped.company, title: mapped.title,
        email: mapped.email, phone: mapped.phone, scannedAt: mapped.scannedAt,
        linkedin: mapped.linkedin, website: mapped.website, location: mapped.location,
        industry: mapped.industry,
      };
      triggerWebhooks("contact.created", contactPayload);
      fireWebhook("contact.created", contactPayload);
      // Enqueue scan sync job — batched worker fans out to integrations,
      // appends to the rolling CSV, and refreshes the digital business card.
      supabase.from("scan_sync_jobs").insert({
        user_id: user.id,
        contact_id: mapped.id,
        pending_actions: ["integrations", "csv", "card"],
      }).then(({ error: jobErr }) => {
        if (jobErr) console.warn("scan_sync_jobs enqueue failed:", jobErr);
      });
      // Auto-enrich in background (fire-and-forget)
      if (!mapped.enriched && mapped.name) {
        markEnriching(mapped.id, true);
        enrichContactViaIcypeas({ name: mapped.name, company: mapped.company, title: mapped.title, email: mapped.email, linkedin: mapped.linkedin, website: mapped.website }).then((enrichData) => {
          if (enrichData?.enriched) {
            const e = enrichData.enriched;
            const updates: Partial<Contact> = {};
            if (e.linkedin) updates.linkedin = e.linkedin;
            if (e.website) updates.website = e.website;
            if (e.location) updates.location = e.location;
            if (e.industry) updates.industry = e.industry;
            if (e.companySize) updates.companySize = e.companySize;
            if (e.linkedin_profile_url) updates.linkedinProfileUrl = e.linkedin_profile_url;
            if (e.email && !mapped.email) updates.email = e.email;
            if (e.title && !mapped.title) updates.title = e.title;
            if (e.avatar) updates.avatar = e.avatar;
            const phonePatch = dedupePhonePatch(
              { phone: mapped.phone, mobilePhone: mapped.mobilePhone, workPhone: mapped.workPhone },
              { phone: e.phone, mobilePhone: e.mobilePhone, workPhone: e.workPhone },
            );
            if (phonePatch.mobilePhone) updates.mobilePhone = phonePatch.mobilePhone;
            if (phonePatch.workPhone) updates.workPhone = phonePatch.workPhone;
            if (phonePatch.phone && !mapped.phone) updates.phone = phonePatch.phone;
            if (e.companyDescription) updates.companyDescription = e.companyDescription;
            if (e.companyLinkedin) updates.companyLinkedin = e.companyLinkedin;
            if (e.companyAddress) updates.companyAddress = e.companyAddress;
            if (e.companyEmail) updates.companyEmail = e.companyEmail;
            if (e.foundingYear) updates.foundingYear = Number(e.foundingYear);
            if (e.annualRevenue) updates.annualRevenue = e.annualRevenue;
            if (e.companyType) updates.companyType = e.companyType;
            updates.enriched = true;
            updates.enrichedAt = new Date().toISOString();
            // Update in DB
            const dbUpdates: any = {};
            if (updates.linkedin) dbUpdates.linkedin = updates.linkedin;
            if (updates.website) dbUpdates.website = updates.website;
            if (updates.location) dbUpdates.location = updates.location;
            if (updates.industry) dbUpdates.industry = updates.industry;
            if (updates.companySize) dbUpdates.company_size = updates.companySize;
            if (updates.linkedinProfileUrl) dbUpdates.linkedin_profile_url = updates.linkedinProfileUrl;
            if (updates.email) dbUpdates.email = updates.email;
            if (updates.title) dbUpdates.title = updates.title;
            if (updates.avatar) dbUpdates.avatar = updates.avatar;
            if (updates.mobilePhone) dbUpdates.mobile_phone = updates.mobilePhone;
            if (updates.workPhone) dbUpdates.work_phone = updates.workPhone;
            if (updates.phone) dbUpdates.phone = updates.phone;
            if (updates.companyDescription) dbUpdates.company_description = updates.companyDescription;
            if (updates.companyLinkedin) dbUpdates.company_linkedin = updates.companyLinkedin;
            if (updates.companyAddress) dbUpdates.company_address = updates.companyAddress;
            if (updates.companyEmail) dbUpdates.company_email = updates.companyEmail;
            if (updates.foundingYear) dbUpdates.founding_year = updates.foundingYear;
            if (updates.annualRevenue) dbUpdates.annual_revenue = updates.annualRevenue;
            if (updates.companyType) dbUpdates.company_type = updates.companyType;
            dbUpdates.enriched = true;
            dbUpdates.enriched_at = updates.enrichedAt;
            supabase.from("contacts").update(dbUpdates).eq("id", mapped.id).eq("user_id", user!.id).then(() => {});
            setContacts((prev) => prev.map((ct) => ct.id === mapped.id ? { ...ct, ...updates } : ct));
          }
        }).catch((err) => console.warn("Auto-enrich failed:", err)).finally(() => markEnriching(mapped.id, false));
      }
      if (error) console.error("Error adding contact:", error);
      return mapped;
    }
    if (error) console.error("Error adding contact:", error);
    return null;
  }, [user, isGuest, contacts]);

  const updateContact = useCallback(async (id: string, updates: Partial<Contact>) => {
    if (isGuest) {
      const updated = contacts.map((c) => (c.id === id ? { ...c, ...updates } : c));
      setContacts(updated);
      saveLocal(GUEST_CONTACTS_KEY, updated);
      return;
    }
    if (!user) return;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.mobilePhone !== undefined) dbUpdates.mobile_phone = updates.mobilePhone;
    if (updates.workPhone !== undefined) dbUpdates.work_phone = updates.workPhone;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.folderId !== undefined) dbUpdates.folder_id = updates.folderId;
    if (updates.linkedin !== undefined) dbUpdates.linkedin = updates.linkedin;
    if (updates.website !== undefined) dbUpdates.website = updates.website;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.industry !== undefined) dbUpdates.industry = updates.industry;
    if (updates.companySize !== undefined) dbUpdates.company_size = updates.companySize;
    if (updates.enriched !== undefined) dbUpdates.enriched = updates.enriched;
    if (updates.enrichedAt !== undefined) dbUpdates.enriched_at = updates.enrichedAt;
    if (updates.stageId !== undefined) dbUpdates.stage_id = updates.stageId;
    if (updates.followUpDate !== undefined) dbUpdates.follow_up_date = updates.followUpDate;
    if (updates.birthday !== undefined) dbUpdates.birthday = updates.birthday;
    if (updates.linkedinProfileUrl !== undefined) dbUpdates.linkedin_profile_url = updates.linkedinProfileUrl;
    if (updates.conversationStatus !== undefined) dbUpdates.conversation_status = updates.conversationStatus;
    if (updates.nextStep !== undefined) dbUpdates.next_step = updates.nextStep;
    if (updates.nextActionDate !== undefined) dbUpdates.next_action_date = updates.nextActionDate;
    if (updates.companyDescription !== undefined) dbUpdates.company_description = updates.companyDescription;
    if (updates.companyLinkedin !== undefined) dbUpdates.company_linkedin = updates.companyLinkedin;
    if (updates.companyAddress !== undefined) dbUpdates.company_address = updates.companyAddress;
    if (updates.companyEmail !== undefined) dbUpdates.company_email = updates.companyEmail;
    if (updates.foundingYear !== undefined) dbUpdates.founding_year = updates.foundingYear;
    if (updates.annualRevenue !== undefined) dbUpdates.annual_revenue = updates.annualRevenue;
    if (updates.companyType !== undefined) dbUpdates.company_type = updates.companyType;
    await supabase.from("contacts").update(dbUpdates).eq("id", id).eq("user_id", user.id);
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    // Trigger contact.updated webhook (legacy + new)
    const existing = contacts.find((c) => c.id === id);
    const updatePayload = {
      id,
      changes: updates,
      contact: existing ? { ...existing, ...updates } : { id, ...updates },
    };
    triggerWebhooks("contact.updated", updatePayload);
    fireWebhook("contact.updated", updatePayload);
  }, [user, isGuest, contacts]);

  const deleteContact = useCallback(async (id: string) => {
    if (isGuest) {
      const updated = contacts.filter((c) => c.id !== id);
      setContacts(updated);
      saveLocal(GUEST_CONTACTS_KEY, updated);
      return;
    }
    if (!user) return;
    await supabase.from("contacts").delete().eq("id", id).eq("user_id", user.id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    fireWebhook("contact.deleted", { id });
  }, [user, isGuest, contacts]);

  const addFolder = useCallback(async (f: Folder): Promise<Folder | null> => {
    // Normalize incoming name and short-circuit if a matching folder already
    // exists (case/whitespace-insensitive) — prevents duplicate folders.
    const cleanName = cleanFolderName(f.name);
    if (!cleanName) return null;
    const existing = findFolderByName(folders, cleanName);
    if (existing) return existing;
    const toCreate: Folder = { ...f, name: cleanName };
    if (isGuest) {
      const updated = [toCreate, ...folders];
      setFolders(updated);
      saveLocal(GUEST_FOLDERS_KEY, updated);
      return toCreate;
    }
    if (!user) return null;
    const { data, error } = await supabase.from("folders").insert({
      user_id: user.id, name: toCreate.name, emoji: toCreate.emoji,
      event_id: toCreate.eventId ?? null,
    } as any).select().single();
    if (error) { console.error("Error adding folder:", error); return null; }
    if (!data) return null;
    const created = mapFolder(data);
    setFolders((prev) => [created, ...prev]);
    return created;
  }, [user, isGuest, folders]);

  const updateFolder = useCallback(async (id: string, updates: Partial<Pick<Folder, "name" | "emoji" | "eventId">>) => {
    if (isGuest) {
      setFolders((prev) => {
        const next = prev.map((f) => (f.id === id ? { ...f, ...updates } : f));
        saveLocal(GUEST_FOLDERS_KEY, next);
        return next;
      });
      return;
    }
    if (!user) return;
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.emoji !== undefined) payload.emoji = updates.emoji;
    if (updates.eventId !== undefined) payload.event_id = updates.eventId ?? null;
    const { error } = await supabase.from("folders").update(payload as any).eq("id", id).eq("user_id", user.id);
    if (error) { console.error("Error updating folder:", error); return; }
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, [user, isGuest]);

  const deleteFolder = useCallback(async (id: string) => {
    if (isGuest) {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      const updatedContacts = contacts.map((c) => (c.folderId === id ? { ...c, folderId: undefined } : c));
      setContacts(updatedContacts);
      saveLocal(GUEST_FOLDERS_KEY, folders.filter((f) => f.id !== id));
      saveLocal(GUEST_CONTACTS_KEY, updatedContacts);
      return;
    }
    if (!user) return;
    await supabase.from("contacts").update({ folder_id: null }).eq("folder_id", id).eq("user_id", user.id);
    await supabase.from("folders").delete().eq("id", id).eq("user_id", user.id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setContacts((prev) => prev.map((c) => (c.folderId === id ? { ...c, folderId: undefined } : c)));
  }, [user, isGuest, contacts, folders]);

  const setProfile = useCallback(async (p: UserProfile) => {
    if (isGuest) {
      setProfileState(p);
      saveLocal(GUEST_PROFILE_KEY, p);
      return;
    }
    if (!user) return;
    await supabase.from("profiles").update({
      name: p.name, title: p.title, company: p.company,
      email: p.email, phone: p.phone, website: p.website,
      linkedin: p.linkedin, avatar: p.avatar, booking_url: p.bookingUrl || "",
    } as any).eq("id", user.id);
    setProfileState(p);
  }, [user, isGuest]);

  const setMessageTemplates = useCallback((templates: MessageTemplate[]) => {
    setMessageTemplatesState(templates);
    saveLocal(TEMPLATES_KEY, templates);
  }, []);

  return (
    <AppContext.Provider value={{
      contacts, setContacts, addContact, updateContact, deleteContact,
      folders, setFolders, addFolder, updateFolder, deleteFolder,
      profile, setProfile, loading, messageTemplates, setMessageTemplates,
      isGuest, contactLimit: FREE_CONTACT_LIMIT, canAddContact, enrichingIds,
    }}>
      {children}
    </AppContext.Provider>
  );
};
