import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, Check, Loader2, Unplug, Bell, BellOff, Send, ChevronDown } from "lucide-react";
import { useSlackIntegration } from "@/hooks/useSlackIntegration";
import { useLanguage } from "@/context/LanguageContext";

const SlackSettingsPanel = () => {
  const { t } = useLanguage();
  const {
    settings, channels, loading, loadingChannels,
    connected, testResult,
    testConnection, fetchChannels, saveSettings, disconnect,
  } = useSlackIntegration();

  const [selectedChannel, setSelectedChannel] = useState("");
  const [notifyContact, setNotifyContact] = useState(true);
  const [notifyFollowUp, setNotifyFollowUp] = useState(true);
  const [showChannels, setShowChannels] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settings) {
      setSelectedChannel(settings.channel_id);
      setNotifyContact(settings.notify_new_contact);
      setNotifyFollowUp(settings.notify_follow_up);
    }
  }, [settings]);

  const handleConnect = async () => {
    setTesting(true);
    const result = await testConnection();
    setTesting(false);
    if (result?.ok) {
      await fetchChannels();
      setShowChannels(true);
    }
  };

  const handleSave = async () => {
    const channel = channels.find(c => c.id === selectedChannel);
    if (!channel) return;
    await saveSettings({
      channel_id: channel.id,
      channel_name: channel.name,
      notify_new_contact: notifyContact,
      notify_follow_up: notifyFollowUp,
    });
    setShowChannels(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 space-y-3">
        {/* Connected state */}
        {connected && settings && !showChannels && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Check size={14} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {t("integrations.slackConnectedTo")} <span className="font-bold">#{settings.channel_name}</span>
                </p>
                {testResult?.team && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t("integrations.slackWorkspace")}: {testResult.team}
                  </p>
                )}
              </div>
            </div>

            {/* Toggle notifications */}
            <div className="space-y-1">
              <ToggleRow
                icon={Bell}
                label={t("integrations.slackNotifyNewContact")}
                enabled={notifyContact}
                onToggle={async (v) => {
                  setNotifyContact(v);
                  await saveSettings({ ...settings, notify_new_contact: v });
                }}
              />
              <ToggleRow
                icon={Bell}
                label={t("integrations.slackNotifyFollowUp")}
                enabled={notifyFollowUp}
                onToggle={async (v) => {
                  setNotifyFollowUp(v);
                  await saveSettings({ ...settings, notify_follow_up: v });
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { fetchChannels(); setShowChannels(true); }}
                className="flex-1 text-[11px] font-medium text-primary py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                {t("integrations.slackChangeChannel")}
              </button>
              <button
                onClick={disconnect}
                className="flex items-center gap-1 text-[11px] font-medium text-destructive py-2 px-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors"
              >
                <Unplug size={11} /> {t("integrations.slackDisconnect")}
              </button>
            </div>
          </div>
        )}

        {/* Setup / channel selection */}
        {(!connected || showChannels) && (
          <div className="space-y-3">
            {!showChannels && !connected && (
              <button
                onClick={handleConnect}
                disabled={testing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {testing ? (
                  <><Loader2 size={13} className="animate-spin" /> {t("integrations.slackTesting")}</>
                ) : (
                  <><Send size={13} /> {t("integrations.slackSetup")}</>
                )}
              </button>
            )}

            {showChannels && (
              <>
                <p className="text-[11px] text-muted-foreground">{t("integrations.slackSelectChannel")}</p>
                {loadingChannels ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border/60 p-1">
                    {channels.map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChannel(ch.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                          selectedChannel === ch.id
                            ? "bg-primary/10 text-primary font-semibold"
                            : "hover:bg-secondary/60 text-foreground"
                        }`}
                      >
                        <Hash size={12} className="text-muted-foreground shrink-0" />
                        {ch.name}
                        {selectedChannel === ch.id && <Check size={12} className="ml-auto text-primary" />}
                      </button>
                    ))}
                    {channels.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-3">
                        {t("integrations.slackNoChannels")}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!selectedChannel}
                    className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {t("integrations.slackSave")}
                  </button>
                  {connected && (
                    <button
                      onClick={() => setShowChannels(false)}
                      className="py-2 px-4 rounded-xl bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                    >
                      {t("misc.cancel")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const ToggleRow = ({ icon: Icon, label, enabled, onToggle }: {
  icon: any; label: string; enabled: boolean; onToggle: (v: boolean) => void;
}) => (
  <button
    onClick={() => onToggle(!enabled)}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-secondary/40 transition-colors"
  >
    <Icon size={13} className={enabled ? "text-primary" : "text-muted-foreground"} />
    <span className="flex-1 text-xs text-foreground text-left">{label}</span>
    <div className={`w-8 h-5 rounded-full p-0.5 transition-colors ${enabled ? "bg-primary" : "bg-border"}`}>
      <motion.div
        animate={{ x: enabled ? 12 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </div>
  </button>
);

export default SlackSettingsPanel;
