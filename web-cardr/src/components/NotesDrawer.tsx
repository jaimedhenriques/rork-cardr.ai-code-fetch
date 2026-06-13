import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Mic, Mail, MessageSquare, Globe, Sparkles, ChevronRight, Settings2, FolderOpen, Bell, Languages, Shield } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const NOTES_SETTINGS_KEY = "cardscanpro_notes_settings";

interface NotesSettings {
  callRecording: boolean;
  autoTranscribe: boolean;
  aiSummary: boolean;
  emailSync: boolean;
  whatsappSync: boolean;
  smsSync: boolean;
  language: string;
  notifications: boolean;
}

const defaultSettings: NotesSettings = {
  callRecording: false,
  autoTranscribe: true,
  aiSummary: true,
  emailSync: false,
  whatsappSync: false,
  smsSync: false,
  language: "en-US",
  notifications: true,
};

const loadSettings = (): NotesSettings => {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(NOTES_SETTINGS_KEY) || "{}") };
  } catch { return defaultSettings; }
};

interface NotesDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NotesDrawer = ({ open, onClose }: NotesDrawerProps) => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<NotesSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(NOTES_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const toggle = (key: keyof NotesSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const ToggleRow = ({ icon: Icon, label, description, settingKey, premium, upcoming }: {
    icon: any; label: string; description: string; settingKey: keyof NotesSettings; premium?: boolean; upcoming?: boolean;
  }) => (
    <button
      onClick={() => !upcoming && toggle(settingKey)}
      disabled={upcoming}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${upcoming ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary/40"}`}
    >
      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
        <Icon size={15} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-medium ${upcoming ? "text-muted-foreground" : "text-foreground"}`}>{label}</p>
          {upcoming && (
            <span className="text-[9px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">{t("misc.upcoming")}</span>
          )}
          {premium && !upcoming && (
            <span className="text-[9px] font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5">{t("misc.pro")}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      {!upcoming ? (
        <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${settings[settingKey] ? "bg-primary" : "bg-border"}`}>
          <motion.div
            animate={{ x: settings[settingKey] ? 16 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="w-5 h-5 rounded-full bg-white shadow-sm"
          />
        </div>
      ) : (
        <div className="w-10 h-6 rounded-full p-0.5 bg-border">
          <div className="w-5 h-5 rounded-full bg-white/60 shadow-sm" />
        </div>
      )}
    </button>
  );

  const NavRow = ({ icon: Icon, label, description, onClick, upcoming }: {
    icon: any; label: string; description: string; onClick?: () => void; upcoming?: boolean;
  }) => (
    <button
      onClick={upcoming ? undefined : onClick}
      disabled={upcoming}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${upcoming ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary/40"}`}
    >
      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
        <Icon size={15} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-medium ${upcoming ? "text-muted-foreground" : "text-foreground"}`}>{label}</p>
          {upcoming && (
            <span className="text-[9px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">{t("misc.upcoming")}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-[300px] z-[70] bg-background border-r border-border/60 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">{t("notesDrawer.title")}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Recording */}
              <div className="pt-3 pb-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-1">
                  {t("notesDrawer.recording")}
                </p>
                <ToggleRow
                  icon={Phone}
                  label={t("notesDrawer.callRecording")}
                  description={t("notesDrawer.callRecordingDesc")}
                  settingKey="callRecording"
                  upcoming
                />
                <ToggleRow
                  icon={Mic}
                  label={t("notesDrawer.autoTranscribe")}
                  description={t("notesDrawer.autoTranscribeDesc")}
                  settingKey="autoTranscribe"
                />
                <ToggleRow
                  icon={Sparkles}
                  label={t("notesDrawer.aiSummary")}
                  description={t("notesDrawer.aiSummaryDesc")}
                  settingKey="aiSummary"
                />
              </div>

              {/* Integrations */}
              <div className="pt-3 pb-1 border-t border-border/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-1">
                  {t("notesDrawer.syncConversations")}
                </p>
                <ToggleRow
                  icon={Mail}
                  label={t("notesDrawer.emailSync")}
                  description={t("notesDrawer.emailSyncDesc")}
                  settingKey="emailSync"
                  upcoming
                />
                <ToggleRow
                  icon={MessageSquare}
                  label={t("notesDrawer.whatsappSync")}
                  description={t("notesDrawer.whatsappSyncDesc")}
                  settingKey="whatsappSync"
                  upcoming
                />
                <ToggleRow
                  icon={Globe}
                  label={t("notesDrawer.smsSync")}
                  description={t("notesDrawer.smsSyncDesc")}
                  settingKey="smsSync"
                  upcoming
                />
              </div>

              {/* Organization */}
              <div className="pt-3 pb-1 border-t border-border/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-1">
                  {t("notesDrawer.organization")}
                </p>
                <NavRow
                  icon={FolderOpen}
                  label={t("notesDrawer.manageFolders")}
                  description={t("notesDrawer.manageFoldersDesc")}
                  upcoming
                />
                <ToggleRow
                  icon={Bell}
                  label={t("notesDrawer.followUpReminders")}
                  description={t("notesDrawer.followUpRemindersDesc")}
                  settingKey="notifications"
                />
                <NavRow
                  icon={Languages}
                  label={t("notesDrawer.transcriptionLanguage")}
                  description={settings.language === "en-US" ? "English (US)" : settings.language}
                  upcoming
                />
              </div>

              {/* Privacy */}
              <div className="pt-3 pb-4 border-t border-border/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-1">
                  {t("notesDrawer.privacy")}
                </p>
                <NavRow
                  icon={Shield}
                  label={t("notesDrawer.dataPrivacy")}
                  description={t("notesDrawer.dataPrivacyDesc")}
                  upcoming
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotesDrawer;
