import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { Users, Mic, Smile, Meh, Frown, CheckCircle2, ListTodo, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface TeamMemberStat {
  userId: string;
  name: string;
  meetings: number;
  minutes: number;
  avgSentiment: number | null;
  questions: number;
  actionItems: number;
  actionItemsDone: number;
  avgTalkDominance: number | null;
  lastMeetingAt: string | null;
}

interface TeamOpenActionItem {
  task: string;
  owner: string | null;
  deadline: string | null;
  priority: string | null;
  memberName: string;
  noteTitle: string;
  createdAt: string;
}

interface TeamAnalyticsData {
  org: { id: string; name: string };
  rangeDays: number;
  totals: {
    meetings: number;
    minutes: number;
    avgSentiment: number | null;
    totalQuestions: number;
    highEngagementPct: number | null;
    avgTalkDominance: number | null;
    actionItemsTotal: number;
    actionItemsDone: number;
  };
  members: TeamMemberStat[];
  timeline: { date: string; meetings: number; minutes: number }[];
  openActionItems: TeamOpenActionItem[];
}

const SentimentIcon = ({ score }: { score: number }) => {
  if (score >= 0.6) return <Smile size={20} className="text-emerald-400" />;
  if (score >= 0.4) return <Meh size={20} className="text-amber-400" />;
  return <Frown size={20} className="text-rose-400" />;
};

const priorityDot = (priority: string | null): string => {
  if (priority === "high") return "bg-rose-400";
  if (priority === "medium") return "bg-amber-400";
  return "bg-muted-foreground/40";
};

/** Org-wide meeting analytics fed by the team-analytics edge function. */
export default function TeamAnalytics({ rangeDays }: { rangeDays: number }) {
  const { t } = useLanguage();
  const [data, setData] = useState<TeamAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: res, error: fnError } = await supabase.functions.invoke("team-analytics", {
        body: { rangeDays },
      });
      if (cancelled) return;
      if (fnError || res?.error) {
        setError(t("analytics.teamLoadFailed"));
        setData(null);
      } else {
        setData(res as TeamAnalyticsData);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [rangeDays, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 space-y-2">
        <Users size={40} className="mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">{error ?? t("analytics.teamLoadFailed")}</p>
      </div>
    );
  }

  const { totals, members, timeline, openActionItems } = data;

  if (totals.meetings === 0) {
    return (
      <div className="text-center py-20 space-y-2">
        <Users size={40} className="mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">{t("analytics.noTeamData")}</p>
        <p className="text-muted-foreground/60 text-xs">{t("analytics.teamRecordToSee")}</p>
      </div>
    );
  }

  const chartData = timeline.map((p) => ({
    ...p,
    label: format(new Date(`${p.date}T00:00:00`), "MMM d"),
  }));

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="card-elevated border-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("analytics.teamMeetings")}</span>
                <Mic size={20} className="text-accent" />
              </div>
              <p className="text-2xl font-bold text-foreground">{totals.meetings}</p>
              <p className="text-[10px] text-muted-foreground">{totals.minutes} {t("analytics.minRecorded")}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="card-elevated border-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("analytics.avgSentiment")}</span>
                {totals.avgSentiment != null && <SentimentIcon score={totals.avgSentiment} />}
              </div>
              <p className="text-2xl font-bold text-foreground">
                {totals.avgSentiment != null ? `${Math.round(totals.avgSentiment * 100)}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">{totals.totalQuestions} {t("analytics.questions").toLowerCase()} · {t("analytics.totalAsked")}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="card-elevated border-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("analytics.actionItems")}</span>
                <CheckCircle2 size={20} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {totals.actionItemsDone}<span className="text-base text-muted-foreground font-semibold">/{totals.actionItemsTotal}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">{t("analytics.completedLower")}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="card-elevated border-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("analytics.talkBalance")}</span>
                <Scale size={20} className="text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {totals.avgTalkDominance != null ? `${totals.avgTalkDominance}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">{t("analytics.avgTopSpeakerShare")}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Meetings over time */}
      {chartData.length >= 2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="card-elevated border-none">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Mic size={14} className="text-accent" />
                {t("analytics.meetingsOverTime")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={26} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number, name: string) => [name === "meetings" ? `${value} meetings` : `${value} min`, ""]}
                  />
                  <Bar dataKey="meetings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Member leaderboard */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="card-elevated border-none">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users size={14} className="text-primary" />
              {t("analytics.memberLeaderboard")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {members.map((m, i) => (
              <div key={m.userId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {m.meetings > 0
                      ? `${m.meetings} meeting${m.meetings !== 1 ? "s" : ""} · ${m.minutes} min · ${m.actionItemsDone}/${m.actionItems} ${t("analytics.actionItems").toLowerCase()}`
                      : t("analytics.noMeetingsYet")}
                  </p>
                </div>
                {m.avgSentiment != null && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    {Math.round(m.avgSentiment * 100)}%
                  </span>
                )}
                {m.avgTalkDominance != null && (
                  <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden shrink-0">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(m.avgTalkDominance, 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Open action items */}
      {openActionItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="card-elevated border-none">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ListTodo size={14} className="text-amber-400" />
                {t("analytics.openActionItems")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {openActionItems.map((item, i) => (
                <div key={`${item.createdAt}-${i}`} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${priorityDot(item.priority)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{item.task}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {[item.owner, item.memberName, item.noteTitle, item.deadline].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  );
}
