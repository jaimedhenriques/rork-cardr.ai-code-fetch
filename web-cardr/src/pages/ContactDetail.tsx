import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, Globe, MapPin, Building2, Linkedin, Calendar, Sparkles, Plus, MessageSquare, ChevronRight, Loader2, Wand2, Pencil, Check, X, GitBranch, Share2, Target, Mic, FileText, DollarSign, CalendarDays, Briefcase, Download, MoreHorizontal, Tag, Trash2, CalendarCheck } from "lucide-react";
import EditableField from "@/components/EditableField";
import PageHeader from "@/components/PageHeader";
import EmailComposer from "@/components/EmailComposer";
import LinkedInConnectModal from "@/components/LinkedInConnectModal";
import OutreachDraftDialog from "@/components/agents/OutreachDraftDialog";
import OutreachHistoryPanel from "@/components/agents/OutreachHistoryPanel";
import ScanArtifactsPanel from "@/components/ScanArtifactsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { getEngagementScore } from "@/lib/engagement";
import { isFeatureEnabled, notifyComingSoon } from "@/lib/featureFlags";
import { ComingSoonBadge } from "@/components/ComingSoonBadge";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: any;
  created_at: string;
}

const ACTIVITY_ICONS: Record<string, string> = {
  note: "📝",
  stage_change: "🔄",
  meeting: "🎤",
  call: "📞",
  email: "✉️",
  follow_up: "⏰",
  enrichment: "✨",
  other: "📌",
};

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { contacts, updateContact, profile } = useApp();
  const { t } = useLanguage();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [newActivityTitle, setNewActivityTitle] = useState("");
  const [newActivityType, setNewActivityType] = useState("note");
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [showOutreachDialog, setShowOutreachDialog] = useState(false);
  const [editingHeader, setEditingHeader] = useState<"name" | "title" | "company" | null>(null);
  const [headerDraft, setHeaderDraft] = useState("");
  const [linkedNotes, setLinkedNotes] = useState<any[]>([]);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [contactTags, setContactTags] = useState<{ id: string; tag_id: string; name: string; color: string }[]>([]);

  const contact = contacts.find((c) => c.id === id);

  const fetchActivities = useCallback(async () => {
    if (!user || !id) { setLoading(false); return; }
    const { data } = await supabase
      .from("contact_activities")
      .select("*")
      .eq("contact_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setActivities(data);
    setLoading(false);
  }, [user, id]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  // Fetch notes linked to this contact via meeting_participants
  useEffect(() => {
    if (!user || !id) return;
    const fetchLinkedNotes = async () => {
      // Get meeting_note_ids where this contact is a participant
      const { data: participants } = await supabase
        .from("meeting_participants")
        .select("meeting_note_id")
        .eq("contact_id", id)
        .eq("user_id", user.id);
      if (!participants?.length) return;

      const noteIds = [...new Set(participants.map(p => p.meeting_note_id))];
      const { data: notes } = await supabase
        .from("meeting_notes")
        .select("id, title, summary, created_at, duration_seconds")
        .in("id", noteIds)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (notes) setLinkedNotes(notes);
    };
    fetchLinkedNotes();

    // Also search notes by contact name in mentioned_people (JSON)
    if (contact?.name) {
      supabase
        .from("meeting_notes")
        .select("id, title, summary, created_at, duration_seconds, mentioned_people")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (!data) return;
          const nameL = contact.name.toLowerCase();
          const matched = data.filter(n => {
            const people = (n.mentioned_people as any[]) || [];
            return people.some((p: any) => p.name?.toLowerCase().includes(nameL));
          });
          setLinkedNotes(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const newNotes = matched.filter(n => !existingIds.has(n.id));
            return [...prev, ...newNotes];
          });
        });
    }
  }, [user, id, contact?.name]);

  // Load pipeline stages
  useEffect(() => {
    if (!user) return;
    supabase.from("pipeline_stages").select("*").eq("user_id", user.id).order("sort_order").then(({ data }) => {
      if (data) setStages(data);
    });
  }, [user]);

  // Fetch contact tags
  const fetchContactTags = useCallback(async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from("contact_tags")
      .select("id, tag_id, tags(name, color)")
      .eq("contact_id", id);
    if (data) {
      setContactTags(data.map((ct: any) => ({
        id: ct.id,
        tag_id: ct.tag_id,
        name: ct.tags?.name || "",
        color: ct.tags?.color || "#6366f1",
      })));
    }
  }, [user, id]);

  useEffect(() => { fetchContactTags(); }, [fetchContactTags]);

  useEffect(() => {
    if (contact) {
      if ((contact as any).follow_up_date) {
        setFollowUpDate(format(parseISO((contact as any).follow_up_date), "yyyy-MM-dd"));
      }
      setNextStep(contact.nextStep || "");
      if (contact.nextActionDate) {
        setNextActionDate(format(parseISO(contact.nextActionDate), "yyyy-MM-dd"));
      }
    }
  }, [contact]);

  const addActivity = async () => {
    if (!newActivityTitle.trim() || !user || !id) return;
    const { data } = await supabase.from("contact_activities").insert({
      user_id: user.id,
      contact_id: id,
      type: newActivityType,
      title: newActivityTitle.trim(),
    }).select().single();
    if (data) {
      setActivities((prev) => [data, ...prev]);
      setNewActivityTitle("");
      setShowAddActivity(false);
      toast.success(t("contactDetail.activityLogged"));
    }
  };

  const handleFollowUpChange = async (date: string) => {
    setFollowUpDate(date);
    if (!user || !id) return;
    const val = date ? new Date(date).toISOString() : null;
    await supabase.from("contacts").update({ follow_up_date: val, follow_up_sent_at: null } as any).eq("id", id).eq("user_id", user.id);
    toast.success(date ? t("contactDetail.followUpSet") : t("contactDetail.followUpCleared"));
  };

  const handleFieldSave = (field: string, value: string) => {
    if (!id) return;
    updateContact(id, { [field]: value || undefined });
    toast.success(t("contactDetail.updated"));
  };

  const handleHeaderSave = () => {
    if (!editingHeader || !id) return;
    const trimmed = headerDraft.trim();
    if (editingHeader === "name" && !trimmed) { toast.error(t("contactDetail.nameRequired")); return; }
    updateContact(id, { [editingHeader]: trimmed });
    setEditingHeader(null);
    toast.success(t("contactDetail.updated"));
  };

  const startHeaderEdit = (field: "name" | "title" | "company") => {
    setHeaderDraft(contact?.[field] || "");
    setEditingHeader(field);
  };

  const handleSaveVCF = useCallback(() => {
    if (!contact) return;
    const lines = [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${contact.name}`,
      contact.title ? `TITLE:${contact.title}` : "",
      contact.company ? `ORG:${contact.company}` : "",
      contact.email ? `EMAIL:${contact.email}` : "",
      contact.phone ? `TEL:${contact.phone}` : "",
      contact.website ? `URL:${contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}` : "",
      contact.linkedin ? `X-SOCIALPROFILE;type=linkedin:${contact.linkedin.startsWith("http") ? contact.linkedin : `https://linkedin.com/in/${contact.linkedin}`}` : "",
      "END:VCARD",
    ].filter(Boolean).join("\n");
    const blob = new Blob([lines], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contact.name.replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Contact card downloaded — open it to add to Contacts");
  }, [contact]);

  const handleShareContact = useCallback(async () => {
    if (!contact) return;
    const text = `${contact.name}${contact.title ? ` — ${contact.title}` : ""}${contact.company ? ` at ${contact.company}` : ""}\n${contact.email ? `Email: ${contact.email}\n` : ""}${contact.phone ? `Phone: ${contact.phone}\n` : ""}${contact.linkedin ? `LinkedIn: ${contact.linkedin}` : ""}`;
    if (navigator.share) {
      try { await navigator.share({ title: contact.name, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Contact info copied to clipboard");
    }
  }, [contact]);

  const handleAddTag = useCallback(async () => {
    if (!newTag.trim() || !user || !id) return;
    let tagId: string;
    const { data: existing } = await supabase.from("tags").select("id").eq("user_id", user.id).eq("name", newTag.trim()).maybeSingle();
    if (existing) {
      tagId = existing.id;
    } else {
      const { data: created } = await supabase.from("tags").insert({ user_id: user.id, name: newTag.trim() }).select("id").single();
      if (!created) { toast.error("Failed to create tag"); return; }
      tagId = created.id;
    }
    const { error } = await supabase.from("contact_tags").insert({ contact_id: id, tag_id: tagId });
    if (error?.code === "23505") { toast("Tag already added"); }
    else if (error) { toast.error("Failed to add tag"); }
    else { toast.success(`Tag "${newTag.trim()}" added`); fetchContactTags(); }
    setNewTag("");
    setShowTagInput(false);
  }, [newTag, user, id, fetchContactTags]);

  const handleRemoveTag = useCallback(async (contactTagId: string, tagName: string) => {
    const { error } = await supabase.from("contact_tags").delete().eq("id", contactTagId);
    if (error) { toast.error("Failed to remove tag"); return; }
    setContactTags(prev => prev.filter(t => t.id !== contactTagId));
    toast.success(`Tag "${tagName}" removed`);
  }, []);

  const handleRemoveLead = useCallback(async () => {
    if (!user || !id) return;
    const confirmed = window.confirm(`Remove ${contact?.name} from your contacts? This cannot be undone.`);
    if (!confirmed) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Failed to remove contact"); return; }
    toast.success("Contact removed");
    navigate("/contacts");
  }, [user, id, contact?.name, navigate]);

  if (!contact) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">{t("contactDetail.notFound")}</p>
        <button onClick={() => navigate("/contacts")} className="mt-3 text-sm text-primary font-semibold">{t("contactDetail.goBack")}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <div className="flex items-center justify-between mb-2">
        <PageHeader back="/contacts" />
        <div className="relative">
          <button
            onClick={() => setShowActionMenu((p) => !p)}
            className="w-9 h-9 rounded-xl bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <MoreHorizontal size={18} className="text-foreground" />
          </button>
          {showActionMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setShowActionMenu(false); setShowTagInput(false); }} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
              >
                <button onClick={() => { handleSaveVCF(); setShowActionMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors">
                  <Download size={15} className="text-success" /> Save to Contacts
                </button>
                <button onClick={() => { handleShareContact(); setShowActionMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors">
                  <Share2 size={15} className="text-primary" /> Share Contact
                </button>
                <div className="h-px bg-border/60" />
                {!showTagInput ? (
                  <button onClick={() => setShowTagInput(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors">
                    <Tag size={15} className="text-accent-foreground" /> Add Tag
                  </button>
                ) : (
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    <Tag size={14} className="text-muted-foreground shrink-0" />
                    <input
                      autoFocus
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(); if (e.key === "Escape") { setShowTagInput(false); setNewTag(""); } }}
                      placeholder="Tag name…"
                      className="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    <button onClick={handleAddTag} className="w-6 h-6 rounded-md bg-success/10 flex items-center justify-center">
                      <Check size={11} className="text-success" />
                    </button>
                  </div>
                )}
                <div className="h-px bg-border/60" />
                <button onClick={() => { handleRemoveLead(); setShowActionMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 size={15} /> Remove Lead
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Contact Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5">
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} className="w-16 h-16 rounded-full object-cover mx-auto mb-3" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
        ) : null}
        <div className={`w-16 h-16 avatar-circle text-lg mx-auto mb-3 ${contact.avatar ? "hidden" : ""}`}>
          {contact.name.split(" ").map((n) => n[0]).join("")}
        </div>
        {editingHeader === "name" ? (
          <div className="flex items-center justify-center gap-2 mb-1">
            <input
              autoFocus
              value={headerDraft}
              onChange={(e) => setHeaderDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleHeaderSave(); if (e.key === "Escape") setEditingHeader(null); }}
              className="text-xl font-display font-bold text-foreground text-center bg-secondary/80 rounded-lg px-3 py-1 border border-border/60 focus:border-primary focus:outline-none w-48"
            />
            <button onClick={handleHeaderSave} className="w-6 h-6 rounded-md bg-success/10 flex items-center justify-center"><Check size={12} className="text-success" /></button>
            <button onClick={() => setEditingHeader(null)} className="w-6 h-6 rounded-md bg-destructive/10 flex items-center justify-center"><X size={12} className="text-destructive" /></button>
          </div>
        ) : (
          <h1 onClick={() => startHeaderEdit("name")} className="text-xl font-display font-bold text-foreground cursor-pointer hover:text-primary transition-colors group inline-flex items-center gap-1.5">
            {contact.name}
            <Pencil size={10} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
          </h1>
        )}
        {editingHeader === "title" || editingHeader === "company" ? (
          <div className="flex items-center justify-center gap-2 mt-1">
            <input
              autoFocus
              value={headerDraft}
              onChange={(e) => setHeaderDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleHeaderSave(); if (e.key === "Escape") setEditingHeader(null); }}
              placeholder={editingHeader === "title" ? "Job title" : "Company"}
              className="text-xs text-center bg-secondary/80 rounded-lg px-3 py-1 border border-border/60 focus:border-primary focus:outline-none w-40"
            />
            <button onClick={handleHeaderSave} className="w-5 h-5 rounded-md bg-success/10 flex items-center justify-center"><Check size={10} className="text-success" /></button>
            <button onClick={() => setEditingHeader(null)} className="w-5 h-5 rounded-md bg-destructive/10 flex items-center justify-center"><X size={10} className="text-destructive" /></button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => startHeaderEdit("title")}>{contact.title || t("contactDetail.addTitle")}</span>
            {" · "}
            <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => startHeaderEdit("company")}>{contact.company || t("contactDetail.addCompany")}</span>
          </p>
        )}
        {contact.enriched && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <Sparkles size={10} className="text-success" />
            <span className="text-[10px] text-success font-semibold">{t("contactDetail.enriched")}</span>
          </div>
        )}
        {(() => {
          const engagement = getEngagementScore(contact);
          return (
            <div className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold ${engagement.bgColor} ${engagement.color}`}>
              <span>{engagement.tier}</span>
              <span>·</span>
              <span>{engagement.label}</span>
              {engagement.daysSinceActivity !== null && engagement.daysSinceActivity > 0 && (
                <span className="text-muted-foreground font-normal">({engagement.daysSinceActivity}d ago)</span>
              )}
            </div>
          );
        })()}
        {contactTags.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            {contactTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary/80 text-foreground border border-border/40"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
                <button
                  onClick={() => handleRemoveTag(tag.id, tag.name)}
                  className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-destructive/20 transition-colors"
                >
                  <X size={8} className="text-muted-foreground hover:text-destructive" />
                </button>
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Pipeline Status Dropdown */}
      {stages.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.01 }} className="card-elevated p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch size={14} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t("contactDetail.pipelineStatus")}</h3>
          </div>
          <select
            value={contact.stageId || ""}
            onChange={(e) => {
              const stageId = e.target.value || undefined;
              updateContact(id!, { stageId });
              const stageName = stages.find((s) => s.id === e.target.value)?.name || "Unassigned";
              toast.success(`Status: ${stageName}`);
              if (user && e.target.value) {
                supabase.from("contact_activities").insert({
                  user_id: user.id,
                  contact_id: id!,
                  type: "stage_change",
                  title: `Moved to ${stageName}`,
                }).then(() => fetchActivities());
              }
            }}
            className="input-field text-sm"
          >
            <option value="">{t("pipeline.unassigned")}</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </motion.div>
      )}

      {/* Export History */}
      {activities.filter((a) => a.type === "export").length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.012 }} className="card-elevated p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Share2 size={14} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t("contactDetail.exportHistory")}</h3>
          </div>
          <div className="space-y-1.5">
            {activities.filter((a) => a.type === "export").map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>📤</span>
                <span>{a.title}</span>
                <span className="text-muted-foreground/50 ml-auto">{format(parseISO(a.created_at), "MMM d, h:mm a")}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* AI Outreach Drafter — generates personalized email + LinkedIn from badge/notes */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.014 }} className="mb-2">
        <button
          onClick={() => setShowOutreachDialog(true)}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98]"
        >
          <Sparkles size={15} /> AI Outreach Drafter
        </button>
      </motion.div>

      {/* Outreach run history */}
      {id && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0145 }} className="mb-3">
          <OutreachHistoryPanel contactId={id} />
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.015 }} className="mb-4 flex gap-2">
        <button onClick={() => setShowLinkedInModal(true)} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-2xl bg-[hsl(210,80%,55%)]/10 text-[hsl(210,80%,55%)] hover:bg-[hsl(210,80%,55%)]/20 transition-all active:scale-[0.97]">
          <Linkedin size={14} /> {t("contactDetail.linkedinOutreach")}
        </button>
        <button onClick={() => setShowEmailComposer(true)} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-[0.97]">
          <Wand2 size={14} /> {t("contactDetail.aiEmail")}
        </button>
      </motion.div>

      {/* Book Meeting */}
      {profile.bookingUrl && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.016 }} className="mb-4">
          <button
            onClick={() => {
              const url = profile.bookingUrl!.startsWith("http") ? profile.bookingUrl! : `https://${profile.bookingUrl}`;
              window.open(url, "_blank");
            }}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-2xl bg-success/10 text-success hover:bg-success/20 transition-all active:scale-[0.97]"
          >
            <CalendarCheck size={15} /> Book Meeting
          </button>
        </motion.div>
      )}

      {/* Contact Info — All Editable */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="card-elevated p-4 space-y-3 mb-4">
        <EditableField
          icon={Mail} iconBgClassName="bg-primary/10" iconClassName="text-primary"
          label="Email" value={contact.email || ""} placeholder="john@company.com"
          onSave={(v) => handleFieldSave("email", v)}
          href={contact.email ? `mailto:${contact.email}` : undefined}
        />
        <div className="relative">
          <EditableField
            icon={Phone} iconBgClassName="bg-success/10" iconClassName="text-success"
            label="Phone" value={contact.phone || ""} placeholder="+1 555 0123"
            onSave={(v) => handleFieldSave("phone", v)}
            href={contact.phone && isFeatureEnabled("twilioDialer") ? `tel:${contact.phone}` : undefined}
            onAction={contact.phone ? () => {
              if (!isFeatureEnabled("twilioDialer")) {
                notifyComingSoon("Phone calling is in review for the mobile app.");
                return;
              }
              navigate("/notes/record", {
                state: {
                  prefillTitle: `Phone call with ${contact.name}`,
                  templateId: "phone-call",
                  autoRecord: true,
                  contactName: contact.name,
                  contactId: contact.id,
                },
              });
              setTimeout(() => window.open(`tel:${contact.phone}`, "_self"), 300);
            } : undefined}
          />
          {!isFeatureEnabled("twilioDialer") && (
            <ComingSoonBadge className="absolute top-2 right-2 z-10" />
          )}
        </div>
        <EditableField
          icon={Linkedin} iconBgClassName="bg-[hsl(210,80%,55%)]/10" iconClassName="text-[hsl(210,80%,55%)]"
          label="LinkedIn" value={contact.linkedin || ""} placeholder="linkedin.com/in/username"
          onSave={(v) => handleFieldSave("linkedin", v)}
          href={contact.linkedin ? (contact.linkedin.startsWith("http") ? contact.linkedin : `https://${contact.linkedin}`) : undefined}
        />
        <EditableField
          icon={Globe} iconBgClassName="bg-accent/50" iconClassName="text-foreground"
          label="Website" value={contact.website || ""} placeholder="example.com"
          onSave={(v) => handleFieldSave("website", v)}
          href={contact.website ? (contact.website.startsWith("http") ? contact.website : `https://${contact.website}`) : undefined}
        />
        <EditableField
          icon={MapPin} iconBgClassName="bg-warning/10" iconClassName="text-warning"
          label="Location" value={contact.location || ""} placeholder="San Francisco, CA"
          onSave={(v) => handleFieldSave("location", v)}
        />
        <EditableField
          icon={Building2} iconBgClassName="bg-secondary" iconClassName="text-muted-foreground"
          label="Industry" value={contact.industry || ""} placeholder="Technology"
          onSave={(v) => handleFieldSave("industry", v)}
        />
      </motion.div>

      {/* Company Intelligence */}
      {(contact.companyDescription || contact.companyLinkedin || contact.companyAddress || contact.companyEmail || contact.foundingYear || contact.annualRevenue || contact.companyType) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.025 }} className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-accent/60 flex items-center justify-center">
              <Building2 size={13} className="text-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Company Intelligence</h3>
            <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">AI Enriched</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {contact.companyDescription && (
              <div className="rounded-xl border-l-[3px] border-l-primary bg-card p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText size={11} className="text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Description</span>
                </div>
                <p className="text-[12px] text-foreground leading-relaxed">{contact.companyDescription}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {contact.companyType && (
                <div className="rounded-xl border-l-[3px] border-l-[hsl(var(--accent))] bg-card p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Briefcase size={11} className="text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Type</span>
                  </div>
                  <p className="text-[12px] font-medium text-foreground">{contact.companyType}</p>
                </div>
              )}
              {contact.foundingYear && (
                <div className="rounded-xl border-l-[3px] border-l-warning bg-card p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarDays size={11} className="text-warning" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Founded</span>
                  </div>
                  <p className="text-[12px] font-medium text-foreground">{contact.foundingYear}</p>
                </div>
              )}
              {contact.annualRevenue && (
                <div className="rounded-xl border-l-[3px] border-l-success bg-card p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign size={11} className="text-success" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue</span>
                  </div>
                  <p className="text-[12px] font-medium text-foreground">{contact.annualRevenue}</p>
                </div>
              )}
              {contact.companyEmail && (
                <div className="rounded-xl border-l-[3px] border-l-primary bg-card p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Mail size={11} className="text-primary" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Company Email</span>
                  </div>
                  <a href={`mailto:${contact.companyEmail}`} className="text-[12px] font-medium text-primary truncate block">{contact.companyEmail}</a>
                </div>
              )}
            </div>
            {contact.companyLinkedin && (
              <div className="rounded-xl border-l-[3px] border-l-[hsl(210,80%,55%)] bg-card p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Linkedin size={11} className="text-[hsl(210,80%,55%)]" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Company LinkedIn</span>
                </div>
                <a href={contact.companyLinkedin.startsWith("http") ? contact.companyLinkedin : `https://${contact.companyLinkedin}`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[hsl(210,80%,55%)] truncate block">{contact.companyLinkedin.replace(/https?:\/\/(www\.)?/, '')}</a>
              </div>
            )}
            {contact.companyAddress && (
              <div className="rounded-xl border-l-[3px] border-l-warning bg-card p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin size={11} className="text-warning" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Company Address</span>
                </div>
                <p className="text-[12px] text-foreground">{contact.companyAddress}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Next Step & Action Date */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.035 }} className="card-elevated p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t("contactDetail.nextStep")}</h3>
        </div>
        <input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          onBlur={() => {
            if (!id) return;
            updateContact(id, { nextStep: nextStep.trim() });
          }}
          placeholder={t("contactDetail.nextStepPlaceholder")}
          className="input-field text-sm mb-3"
        />
        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Calendar size={11} /> {t("contactDetail.actionDate")}
        </label>
        <input
          type="date"
          value={nextActionDate}
          onChange={async (e) => {
            const val = e.target.value;
            setNextActionDate(val);
            if (!id) return;
            const isoVal = val ? new Date(val).toISOString() : null;
            updateContact(id, { nextActionDate: isoVal || undefined });
            // Auto-set follow-up date if not already set or if it matches the old action date
            if (val && (!followUpDate || followUpDate === nextActionDate)) {
              setFollowUpDate(val);
              handleFollowUpChange(val);
            }
            toast.success(val ? t("contactDetail.actionDateSet") : t("contactDetail.actionDateCleared"));
          }}
          className="input-field text-sm"
        />
      </motion.div>

      {/* Follow-up Date */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="card-elevated p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={14} className="text-warning" />
          <h3 className="text-sm font-semibold text-foreground">{t("contactDetail.followUpReminder")}</h3>
          {nextActionDate && followUpDate === nextActionDate && (
            <span className="text-[9px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">{t("contactDetail.autoFromAction")}</span>
          )}
        </div>
        <input type="date" value={followUpDate} onChange={(e) => handleFollowUpChange(e.target.value)} className="input-field text-sm" />
      </motion.div>

      {/* Birthday */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-elevated p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">🎂</span>
          <h3 className="text-sm font-semibold text-foreground">{t("contactDetail.birthday")}</h3>
        </div>
        <input
          type="date"
          value={(contact as any).birthday || ""}
          onChange={async (e) => {
            if (!user || !id) return;
            await supabase.from("contacts").update({ birthday: e.target.value || null }).eq("id", id).eq("user_id", user.id);
            toast.success(e.target.value ? t("contactDetail.birthdaySaved") : t("contactDetail.birthdayCleared"));
          }}
          className="input-field text-sm"
        />
      </motion.div>

      {/* Linked Meeting Notes */}
      {linkedNotes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.055 }} className="card-elevated p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Mic size={14} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t("contactDetail.meetingNotes")}</h3>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">{linkedNotes.length}</span>
          </div>
          <div className="space-y-2">
            {linkedNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Mic size={12} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{note.title || t("contactDetail.untitled")}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{format(parseISO(note.created_at), "MMM d, h:mm a")}</span>
                    {note.duration_seconds > 0 && (
                      <span className="text-[10px] text-muted-foreground">· {Math.floor(note.duration_seconds / 60)} min</span>
                    )}
                  </div>
                  {note.summary && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{note.summary}</p>
                  )}
                </div>
                <ChevronRight size={14} className="text-muted-foreground/40 shrink-0 mt-2" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Scan artifacts (debug / audit) */}
      {user && id && <ScanArtifactsPanel contactId={id} userId={user.id} />}

      {/* Activity Timeline */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">{t("contactDetail.activity")}</h3>
          <button onClick={() => setShowAddActivity(!showAddActivity)} className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center">
            <Plus size={12} className="text-primary" />
          </button>
        </div>

        {showAddActivity && (
          <div className="card-elevated p-3 mb-3 space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(ACTIVITY_ICONS).map(([type, emoji]) => (
                <button key={type} onClick={() => setNewActivityType(type)} className={`text-xs px-2 py-1 rounded-full border ${newActivityType === type ? "border-primary bg-primary-light text-primary" : "border-border/60 text-muted-foreground"}`}>
                  {emoji} {type}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newActivityTitle} onChange={(e) => setNewActivityTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addActivity()} placeholder={t("contactDetail.whatHappened")} className="input-field flex-1" />
              <button onClick={addActivity} className="btn-primary px-3 py-2 text-xs rounded-xl">{t("contactDetail.log")}</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="text-primary animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare size={24} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">{t("contactDetail.noActivity")}</p>
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((a, i) => (
              <div key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs shrink-0">
                    {ACTIVITY_ICONS[a.type] || "📌"}
                  </div>
                  {i < activities.length - 1 && <div className="w-px flex-1 bg-border/60 my-1" />}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                  {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{format(parseISO(a.created_at), "MMM d, h:mm a")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Email Composer */}
      {contact && <EmailComposer contact={contact} open={showEmailComposer} onClose={() => setShowEmailComposer(false)} />}
      {/* LinkedIn Outreach */}
      {contact && <LinkedInConnectModal contact={contact} open={showLinkedInModal} onClose={() => setShowLinkedInModal(false)} />}
      {/* AI Outreach Drafter (email + LinkedIn) */}
      {contact && <OutreachDraftDialog contact={contact} open={showOutreachDialog} onClose={() => setShowOutreachDialog(false)} />}
    </div>
  );
};

const InfoRow = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
    <Icon size={12} className="text-primary shrink-0" />
    <span className="truncate">{label}</span>
  </div>
);

export default ContactDetail;
