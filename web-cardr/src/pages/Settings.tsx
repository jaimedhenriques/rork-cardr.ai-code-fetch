import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useCallback, useEffect } from "react";
import { isIosNative, hidePaidSurfaces, isIosPlatform } from "@/lib/iosCompliance";
import IosManagePlanNotice from "@/components/IosManagePlanNotice";
import IosPlanStatusCard from "@/components/IosPlanStatusCard";
import IosSubscriptionStatusPanel from "@/components/IosSubscriptionStatusPanel";
import RestorePurchasesButton from "@/components/RestorePurchasesButton";
import { useRestoreBannerPref } from "@/hooks/useRestoreBannerPref";
import { useReferralLogMode, type ReferralLogMode } from "@/hooks/useReferralLogMode";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  User, Mail, Phone, Building2, Globe, Linkedin, Briefcase, Check, LogOut, LogIn,
  Plus, Trash2, Pencil, MessageSquare, X, Tag, Layout, ChevronRight,
  Languages, Mic, Settings2, HelpCircle, Send, Trash, Upload, BookOpen, Zap, Globe2,
  Coins, Wallet, Key, CalendarCheck, Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MessageTemplate } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import ZapierWebhook from "@/components/ZapierWebhook";
import ApiKeyManager from "@/components/ApiKeyManager";
import SwipeToDelete from "@/components/SwipeToDelete";
import IntegrationsSection from "@/components/IntegrationsSection";
import CrmAutoSyncSettings from "@/components/CrmAutoSyncSettings";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import NavCustomizer from "@/components/NavCustomizer";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { useReferral } from "@/hooks/useReferral";
import ContactImportModal from "@/components/ContactImportModal";

import ExportTimezoneSection from "@/components/ExportTimezoneSection";
import PreprocessStatsCard from "@/components/settings/PreprocessStatsCard";
import UsageCreditsCard from "@/components/UsageCreditsCard";
import { APP_LANGUAGES, TRANSCRIPTION_LANGUAGES } from "@/lib/translations";

type SettingsView = "main" | "profile" | "appLanguage" | "transcriptionLanguage" | "meeting" | "templates" | "tags" | "nav" | "integrations" | "apiKeys" | "exportTimezone";

const Settings = () => {
  const { profile, setProfile, isGuest, messageTemplates, setMessageTemplates, contacts } = useApp();
  const { stats: referralStats } = useReferral();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(profile);
  const { navIds, setNavIds, quickIds, setQuickIds } = useNavPreferences();
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [view, setView] = useState<SettingsView>("main");
  const [showImport, setShowImport] = useState(false);
  
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { autoDismiss: restoreAutoDismiss, setAutoDismiss: setRestoreAutoDismiss } = useRestoreBannerPref();
  const { mode: referralLogMode, setMode: setReferralLogMode } = useReferralLogMode();

  const { appLang, transcriptionLang, setAppLang, setTranscriptionLang, t, translating } = useLanguage();
  const currentAppLang = APP_LANGUAGES.find(l => l.code === appLang) || APP_LANGUAGES[0];
  const currentTranscriptionLang = TRANSCRIPTION_LANGUAGES.find(l => l.code === transcriptionLang) || TRANSCRIPTION_LANGUAGES[0];

  const handleSelectAppLang = (code: string) => {
    setAppLang(code);
    toast.success(t("settings.languageUpdated"));
    setView("main");
  };

  const handleSelectTranscriptionLang = (code: string) => {
    setTranscriptionLang(code);
    toast.success(t("settings.languageUpdated"));
    setView("main");
  };

  // Tag management state
  interface TagItem { id: string; name: string; color: string }
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [showTagEditor, setShowTagEditor] = useState(false);

  const TAG_COLORS = [
    "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
    "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
  ];

  const loadTags = useCallback(async () => {
    if (!user) return;
    setLoadingTags(true);
    const { data } = await supabase.from("tags").select("id, name, color").eq("user_id", user.id).order("created_at", { ascending: true });
    setTags(data || []);
    setLoadingTags(false);
  }, [user]);

  useEffect(() => { loadTags(); }, [loadTags]);

  const handleSaveTag = async () => {
    if (!editingTag || !user) return;
    if (!editingTag.name.trim()) { toast.error(t("settings.tagRequired")); return; }
    const exists = tags.some((t) => t.id === editingTag.id);
    if (exists) {
      const { error } = await supabase.from("tags").update({ name: editingTag.name, color: editingTag.color }).eq("id", editingTag.id);
      if (error) { toast.error(t("settings.failedUpdateTag")); return; }
      toast.success(t("settings.tagUpdated"));
    } else {
      const { error } = await supabase.from("tags").insert({ name: editingTag.name, color: editingTag.color, user_id: user.id });
      if (error) { toast.error(t("settings.failedCreateTag")); return; }
      toast.success(t("settings.tagCreated"));
    }
    setShowTagEditor(false);
    loadTags();
  };

  const handleDeleteTag = async (tagId: string) => {
    const { error } = await supabase.from("tags").delete().eq("id", tagId);
    if (error) { toast.error(t("settings.failedDeleteTag")); return; }
    toast.success(t("settings.tagDeleted"));
    loadTags();
  };

  const handleSave = async () => {
    setSaving(true);
    await setProfile(form);
    setSaving(false);
    toast.success(t("settings.profileUpdated"));
  };

  const fields = [
    { key: "name" as const, label: t("field.fullName"), icon: User, placeholder: "Your name" },
    { key: "title" as const, label: t("field.jobTitle"), icon: Briefcase, placeholder: "e.g. VP of Sales" },
    { key: "company" as const, label: t("field.company"), icon: Building2, placeholder: "Your company" },
    { key: "email" as const, label: t("field.email"), icon: Mail, placeholder: "your@email.com" },
    { key: "phone" as const, label: t("field.phone"), icon: Phone, placeholder: "+1 (555) 000-0000" },
    { key: "website" as const, label: t("field.website"), icon: Globe, placeholder: "yoursite.com" },
    { key: "linkedin" as const, label: t("field.linkedin"), icon: Linkedin, placeholder: "linkedin.com/in/you" },
    { key: "bookingUrl" as const, label: "Booking Link", icon: CalendarCheck, placeholder: "calendly.com/you or cal.com/you" },
  ];

  // ── Settings Row Component ──
  const SettingsRow = ({ label, value, onClick, icon: Icon, upcoming }: { label: string; value?: string; onClick: () => void; icon?: any; upcoming?: boolean }) => (
    <button
      onClick={upcoming ? undefined : onClick}
      disabled={upcoming}
      className={`w-full flex items-center justify-between py-3.5 border-b border-border/40 last:border-b-0 group transition-colors ${upcoming ? "opacity-50 cursor-not-allowed" : "active:bg-secondary/30"}`}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon size={16} className="text-muted-foreground" />}
        <span className={`text-sm ${upcoming ? "text-muted-foreground" : "text-foreground"}`}>{label}</span>
        {upcoming && (
          <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">UPCOMING</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {value && !upcoming && <span className="text-sm text-muted-foreground">{value}</span>}
        <ChevronRight size={16} className="text-muted-foreground/50" />
      </div>
    </button>
  );

  // ── Sub-page Header ──
  const SubHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 mb-6">
      <button onClick={onBack} className="text-primary text-sm font-medium">{t("action.back")}</button>
      <h1 className="text-xl font-display font-bold text-foreground">{title}</h1>
    </motion.div>
  );

  // ── App Language View ──
  if (view === "appLanguage") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title={t("settings.appLanguage")} onBack={() => setView("main")} />
        <p className="text-sm text-muted-foreground mb-5">{t("settings.appLanguageDesc")}</p>
        {translating && (
          <div className="text-center text-xs text-primary mb-3 animate-pulse">{t("misc.translating")}</div>
        )}
        <div className="card-elevated overflow-hidden">
          {APP_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectAppLang(lang.code)}
              className={cn(
                "w-full flex items-center justify-between py-3.5 px-4 border-b border-border/40 last:border-b-0 transition-colors",
                appLang === lang.code ? "bg-primary/5" : "active:bg-secondary/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm text-foreground">{lang.label}</span>
              </div>
              {appLang === lang.code && <Check size={16} className="text-primary" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Transcription Language View ──
  if (view === "transcriptionLanguage") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title={t("settings.transcriptionLanguage")} onBack={() => setView("main")} />
        <p className="text-sm text-muted-foreground mb-5">{t("settings.transcriptionDesc")}</p>
        <div className="card-elevated overflow-hidden">
          {TRANSCRIPTION_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectTranscriptionLang(lang.code)}
              className={cn(
                "w-full flex items-center justify-between py-3.5 px-4 border-b border-border/40 last:border-b-0 transition-colors",
                transcriptionLang === lang.code ? "bg-primary/5" : "active:bg-secondary/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm text-foreground">{lang.label}</span>
              </div>
              {transcriptionLang === lang.code && <Check size={16} className="text-primary" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Avatar Upload ──
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.imageOnly"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settings.imageTooLarge"));
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/avatar.${ext}`;

    // Remove old avatar files first
    const { data: existing } = await supabase.storage.from("avatars").list(user.id);
    if (existing && existing.length > 0) {
      await supabase.storage.from("avatars").remove(existing.map(f => `${user.id}/${f.name}`));
    }

    const { error } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (error) {
      toast.error(t("settings.failedUpload"));
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    const updatedForm = { ...form, avatar: avatarUrl };
    setForm(updatedForm);
    await setProfile(updatedForm);
    toast.success(t("settings.avatarUpdated"));
    setUploadingAvatar(false);
  };

  // ── Profile View ──
  if (view === "profile") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title={t("settings.editProfile")} onBack={() => setView("main")} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-5">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-6">
            <label htmlFor="avatar-upload" className="relative cursor-pointer group">
              {form.avatar ? (
                <img
                  src={form.avatar}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-border group-hover:border-primary transition-colors"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold border-2 border-border group-hover:border-primary transition-colors">
                  {(form.name?.[0] || form.email?.[0] || "U").toUpperCase()}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                {uploadingAvatar ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload size={13} className="text-primary-foreground" />
                )}
              </div>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
            <p className="text-[11px] text-muted-foreground mt-2">{t("settings.tapToUpload")}</p>
          </div>

          <div className="space-y-3">
            {fields.map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key}>
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Icon size={11} /> {label}
                </label>
                <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="input-field" />
              </div>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? t("settings.saving") : t("settings.saveChanges")} {!saving && <Check size={15} />}
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Templates View ──
  if (view === "templates") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title={t("settings.messageTemplates")} onBack={() => setView("main")} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-muted-foreground">
              Use <span className="font-mono bg-secondary px-1 rounded">{"{{firstName}}"}</span>, <span className="font-mono bg-secondary px-1 rounded">{"{{company}}"}</span> as variables.
            </p>
            <button
              onClick={() => {
                setEditingTemplate({ id: crypto.randomUUID(), label: "", body: "" });
                setShowTemplateEditor(true);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={13} /> {t("action.new")}
            </button>
          </div>
          {messageTemplates.length === 0 && (
            <p className="text-sm text-muted-foreground/60 text-center py-4">{t("settings.noTemplates")}</p>
          )}
          <div className="space-y-2">
            {messageTemplates.map((tmpl) => (
              <div key={tmpl.id} className="bg-secondary/60 rounded-xl p-3 group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">{tmpl.label || t("notes.untitledMeeting")}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingTemplate({ ...tmpl }); setShowTemplateEditor(true); }} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                      <Pencil size={11} className="text-muted-foreground" />
                    </button>
                    <button onClick={() => { setMessageTemplates(messageTemplates.filter((t) => t.id !== tmpl.id)); toast.success(t("settings.templateDeleted")); }} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-destructive-light transition-colors">
                      <Trash2 size={11} className="text-destructive" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{tmpl.body}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Template Editor Modal */}
        {showTemplateEditor && editingTemplate && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare size={15} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {messageTemplates.some((t) => t.id === editingTemplate.id) ? t("settings.editTemplate") : t("settings.newTemplate")}
                  </h3>
                </div>
                <button onClick={() => setShowTemplateEditor(false)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                  <X size={13} className="text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">{t("settings.templateName")}</label>
                  <input value={editingTemplate.label} onChange={(e) => setEditingTemplate({ ...editingTemplate, label: e.target.value })} placeholder="e.g. Coffee Invite" className="input-field" maxLength={60} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">{t("settings.messageBody")}</label>
                  <textarea value={editingTemplate.body} onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })} placeholder="Hi {{firstName}}, great meeting you at..." className="input-field min-h-[120px] resize-none" maxLength={1000} rows={5} />
                  <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{editingTemplate.body.length}/1000</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!editingTemplate.label.trim() || !editingTemplate.body.trim()) { toast.error(t("settings.nameBodyRequired")); return; }
                  const exists = messageTemplates.some((t) => t.id === editingTemplate.id);
                  if (exists) { setMessageTemplates(messageTemplates.map((t) => (t.id === editingTemplate.id ? editingTemplate : t))); toast.success(t("settings.templateUpdated")); }
                  else { setMessageTemplates([...messageTemplates, editingTemplate]); toast.success(t("settings.templateCreated")); }
                  setShowTemplateEditor(false);
                }}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm"
              >
                <Check size={14} /> {t("settings.saveTemplate")}
              </button>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // ── Tags View ──
  if (view === "tags") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title={t("settings.tags")} onBack={() => setView("main")} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-5">
          <div className="flex items-center justify-end mb-4">
            <button
              onClick={() => { setEditingTag({ id: crypto.randomUUID(), name: "", color: TAG_COLORS[0] }); setShowTagEditor(true); }}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={13} /> {t("action.new")}
            </button>
          </div>
          {loadingTags && <p className="text-xs text-muted-foreground text-center py-4">{t("settings.loadingTags")}</p>}
          {!loadingTags && tags.length === 0 && (
            <p className="text-sm text-muted-foreground/60 text-center py-4">{t("settings.noTags")}</p>
          )}
          <div className="space-y-2">
            {tags.map((tag) => (
              <SwipeToDelete key={tag.id} onDelete={() => handleDeleteTag(tag.id)}>
                <div className="flex items-center gap-3 bg-secondary/60 rounded-xl p-3">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-xs font-semibold text-foreground truncate">{tag.name}</span>
                  <button onClick={() => { setEditingTag({ ...tag }); setShowTagEditor(true); }} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                    <Pencil size={11} className="text-muted-foreground" />
                  </button>
                </div>
              </SwipeToDelete>
            ))}
          </div>
        </motion.div>

        {/* Tag Editor Modal */}
        <AnimatePresence>
          {showTagEditor && editingTag && (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full max-w-md card-elevated p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tag size={15} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">{tags.some((t) => t.id === editingTag.id) ? t("settings.editTag") : t("settings.newTag")}</h3>
                  </div>
                  <button onClick={() => setShowTagEditor(false)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                    <X size={13} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">{t("settings.tagName")}</label>
                    <input value={editingTag.name} onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })} placeholder="e.g. Hot Lead, VIP" className="input-field" maxLength={40} />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">{t("settings.color")}</label>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLORS.map((c) => (
                        <button key={c} onClick={() => setEditingTag({ ...editingTag, color: c })} className={cn("w-8 h-8 rounded-xl transition-all flex items-center justify-center", editingTag.color === c ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-105")} style={{ backgroundColor: c, ...(editingTag.color === c ? { ringColor: c } : {}) }}>
                          {editingTag.color === c && <Check size={14} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={handleSaveTag} className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm">
                  <Check size={14} /> {t("settings.saveTag")}
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Navigation View ──
  if (view === "nav") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title={t("settings.customizeNav")} onBack={() => setView("main")} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-5">
          <p className="text-[11px] text-muted-foreground mb-4">{t("settings.navHint")}</p>
          <NavCustomizer navIds={navIds} setNavIds={setNavIds} quickIds={quickIds} setQuickIds={setQuickIds} />
        </motion.div>
      </div>
    );
  }

  // ── Integrations View ──
  if (view === "integrations") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title={t("integrations.hubTitle")} onBack={() => setView("main")} />
        <IntegrationsSection />
        <CrmAutoSyncSettings />
        <div className="mt-3">
          <ZapierWebhook />
        </div>
      </div>
    );
  }

  // ── Meeting Settings View ──
  if (view === "meeting") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title={t("settings.meetingSettings")} onBack={() => setView("main")} />

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated overflow-hidden mb-3">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-foreground">{t("settings.sharing")}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t("settings.sharingHint")}</p>
          </div>
          <div className="px-4 opacity-50">
            <div className="flex items-center justify-between py-3.5 border-b border-border/40">
              <span className="text-sm text-muted-foreground">{t("settings.autoShareNotes")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">UPCOMING</span>
                <span className="text-sm text-muted-foreground">{t("settings.off")}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-muted-foreground">{t("settings.defaultPermission")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">UPCOMING</span>
                <span className="text-sm text-muted-foreground">{t("settings.viewer")}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="card-elevated overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-foreground">{t("settings.aiNotetaker")}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t("settings.aiNotetakerHint")}
            </p>
          </div>
          <div className="px-4 opacity-50">
            <div className="flex items-center justify-between py-3.5 border-b border-border/40">
              <span className="text-sm text-muted-foreground">{t("settings.autoJoin")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">UPCOMING</span>
                <span className="text-sm text-muted-foreground">{t("settings.manual")}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3.5 border-b border-border/40">
              <span className="text-sm text-muted-foreground">{t("settings.autoCapture")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">UPCOMING</span>
                <span className="text-sm text-muted-foreground">{t("settings.off")}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-muted-foreground">{t("settings.emailHost")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">UPCOMING</span>
                <span className="text-sm text-muted-foreground">{t("settings.off")}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── API Keys View ──
  if (view === "apiKeys") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title="MCP API Keys" onBack={() => setView("main")} />
        <ApiKeyManager />
      </div>
    );
  }

  // ── Default Export Timezone View ──
  if (view === "exportTimezone") {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <PageHeader />
        <SubHeader title="Default export timezone" onBack={() => setView("main")} />
        <p className="text-sm text-muted-foreground mb-5">
          Pick the timezone applied to new export schedules and one-click email exports. You can still override it per schedule.
        </p>
        <ExportTimezoneSection />
      </div>
    );
  }

  // ── Main Settings View ──
  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <PageHeader />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl font-display font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t("settings.subtitle")}</p>
      </motion.div>

      {/* Profile Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
        <button
          onClick={() => setView("profile")}
          className="w-full card-elevated p-4 flex items-center gap-3 mb-5 active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 avatar-circle text-sm shrink-0">
            {(profile.name || user?.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-foreground truncate">{profile.name || t("settings.profile")}</p>
            <p className="text-xs text-muted-foreground truncate">{profile.title ? `${profile.title}${profile.company ? ` ${t("misc.at")} ${profile.company}` : ""}` : user?.email || t("misc.tapToEdit")}</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
        </button>
      </motion.div>

      {/* PREFERENCES Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2 px-1">{t("settings.preferences")}</p>
        <div className="card-elevated overflow-hidden px-4 mb-5">
          <SettingsRow label={t("settings.appLanguage")} value={currentAppLang.label} onClick={() => setView("appLanguage")} icon={Globe2} />
          <SettingsRow label={t("settings.transcriptionLanguage")} value={currentTranscriptionLang.label} onClick={() => setView("transcriptionLanguage")} icon={Languages} />
          <SettingsRow label={t("settings.meetingSettings")} onClick={() => setView("meeting")} icon={Mic} />
          <SettingsRow label={t("settings.messageTemplates")} value={`${messageTemplates.length}`} onClick={() => setView("templates")} icon={MessageSquare} />
          <SettingsRow label={t("settings.tags")} value={`${tags.length}`} onClick={() => setView("tags")} icon={Tag} />
          <SettingsRow label="Default export timezone" onClick={() => setView("exportTimezone")} icon={Clock} />
        </div>
      </motion.div>

      {/* SETUP Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2 px-1">{t("settings.setup")}</p>
        <div className="card-elevated overflow-hidden px-4 mb-5">
          <SettingsRow label={t("settings.connectCalendars")} onClick={() => navigate("/calendar")} icon={BookOpen} upcoming />
          <SettingsRow label={t("settings.importContacts")} onClick={() => setShowImport(true)} icon={Upload} />
          <SettingsRow label={t("settings.integrations")} onClick={() => setView("integrations")} icon={Globe} />
          <SettingsRow label="MCP API Keys" onClick={() => setView("apiKeys")} icon={Key} />
          <SettingsRow label={t("settings.customizeNav")} onClick={() => setView("nav")} icon={Layout} />
        </div>
      </motion.div>

      {/* DIAGNOSTICS Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2 px-1">Diagnostics</p>
        <PreprocessStatsCard />
      </motion.div>

      {/* SUPPORT Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2 px-1">{t("settings.support")}</p>
        <div className="card-elevated overflow-hidden px-4 mb-5">
          <SettingsRow label={t("settings.faq")} onClick={() => {}} icon={HelpCircle} upcoming />
          <SettingsRow label={t("settings.sendFeedback")} onClick={() => {}} icon={Send} upcoming />
        </div>
      </motion.div>

      {/* PLAN & USAGE Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2 px-1">{t("settings.planUsage")}</p>
        <UsageCreditsCard />
        <div className="card-elevated overflow-hidden p-4 mb-5">
          {hidePaidSurfaces() && (
            <div className="space-y-3">
              <IosPlanStatusCard />
              {isIosPlatform() && <IosSubscriptionStatusPanel />}
              <IosManagePlanNotice />
              {/* Restore Purchases is an iOS App Store concept — show only on native iOS builds. */}
              {isIosPlatform() && (
                <>
                  <RestorePurchasesButton />
                  <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-semibold text-foreground">{t("settings.restoreAutoDismiss")}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {t("settings.restoreAutoDismissDesc")}
                      </p>
                    </div>
                    <Switch
                      checked={restoreAutoDismiss}
                      onCheckedChange={setRestoreAutoDismiss}
                      aria-label={t("settings.restoreAutoDismissAria")}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          {/* Referral-stats log verbosity — segmented control */}
          <div className="mt-3 mb-1">
            <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{t("settings.referralLogMode")}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {t("settings.referralLogModeDesc")}
                  </p>
                </div>
              </div>
              <div
                role="radiogroup"
                aria-label={t("settings.referralLogModeAria")}
                className="grid grid-cols-3 gap-1 rounded-lg bg-background/60 p-1"
              >
                {(["full", "sampled", "off"] as ReferralLogMode[]).map((m) => {
                  const active = referralLogMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setReferralLogMode(m)}
                      className={cn(
                        "px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                      )}
                    >
                      {t(`settings.referralLogMode.${m}` as any)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* REFERRAL CREDITS — hidden on native (Phase-1 compliance) */}
      {!isGuest && !hidePaidSurfaces() && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
          <div className="card-elevated overflow-hidden p-4 mb-5">
            <button
              onClick={() => navigate("/referrals")}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Wallet size={16} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("settings.availableCredits")}
                  </p>
                  <p className="text-lg font-display font-bold text-foreground tabular-nums">
                    ${((referralStats?.available_credits_cents || 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  ${((referralStats?.total_credits_earned_cents || 0) / 100).toFixed(2)} {t("settings.earned")}
                </span>
                <ChevronRight size={14} className="text-muted-foreground/50" />
              </div>
            </button>
            {(referralStats?.available_credits_cents || 0) > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2.5 px-12">
                {t("settings.autoApplied")}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ACCOUNT Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2 px-1">{t("settings.account")}</p>
        <div className="card-elevated overflow-hidden px-4">
          {isGuest ? (
            <button
              onClick={() => navigate("/auth")}
              className="w-full flex items-center gap-3 py-3.5"
            >
              <LogIn size={16} className="text-primary" />
              <span className="text-sm font-semibold text-primary">{t("settings.signIn")}</span>
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between py-3.5 border-b border-border/40">
                <span className="text-sm text-foreground">{user?.email}</span>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 py-3.5 border-b border-border/40"
              >
                <LogOut size={16} className="text-destructive" />
                <span className="text-sm font-semibold text-destructive">{t("settings.logOut")}</span>
              </button>
              <button
                onClick={() => navigate("/app/settings/delete-account")}
                className="w-full flex items-center gap-3 py-3.5"
              >
                <Trash2 size={16} className="text-destructive" />
                <span className="text-sm font-semibold text-destructive">Delete account</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      <ContactImportModal open={showImport} onClose={() => setShowImport(false)} />
      
    </div>
  );
};

export default Settings;
