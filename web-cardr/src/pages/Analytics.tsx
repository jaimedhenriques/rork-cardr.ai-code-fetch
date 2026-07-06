import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import TeamAnalytics from "@/components/TeamAnalytics";
import { motion } from "framer-motion";
import { BarChart3, MessageCircleQuestion, Smile, Meh, Frown, Zap, TrendingUp, Users, Mic } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays, isAfter } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface MeetingAnalytics {
  talkTimeRatio?: Record<string, number>;
  questionsAsked?: number;
  sentimentScore?: number;
  sentimentLabel?: string;
  engagementLevel?: string;
  topSpeaker?: string;
}

interface NoteWithAnalytics {
  id: string;
  title: string;
  created_at: string;
  analytics: MeetingAnalytics | null;
  duration_seconds: number | null;
}

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 9999 },
];

const SentimentIcon = ({ score }: { score: number }) => {
  if (score >= 0.6) return <Smile size={20} className="text-emerald-400" />;
  if (score >= 0.4) return <Meh size={20} className="text-amber-400" />;
  return <Frown size={20} className="text-rose-400" />;
};

export default function Analytics() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteWithAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [scope, setScope] = useState<"me" | "team">("me");
  const [hasOrg, setHasOrg] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setHasOrg(!!data);
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("meeting_notes")
        .select("id, title, created_at, analytics, duration_seconds")
        .order("created_at", { ascending: true });
      setNotes((data as NoteWithAnalytics[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (rangeDays >= 9999) return notes;
    const cutoff = subDays(new Date(), rangeDays);
    return notes.filter((n) => isAfter(new Date(n.created_at), cutoff));
  }, [notes, rangeDays]);

  const withAnalytics = useMemo(() => filtered.filter((n) => n.analytics && Object.keys(n.analytics).length > 0), [filtered]);

  // === Aggregates ===
  const avgSentiment = useMemo(() => {
    const scores = withAnalytics.map((n) => n.analytics!.sentimentScore).filter((s): s is number => s != null);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }, [withAnalytics]);

  const totalQuestions = useMemo(() => {
    return withAnalytics.reduce((sum, n) => sum + (n.analytics!.questionsAsked ?? 0), 0);
  }, [withAnalytics]);

  const totalMeetingMinutes = useMemo(() => {
    return Math.round(filtered.reduce((sum, n) => sum + (n.duration_seconds ?? 0), 0) / 60);
  }, [filtered]);

  const engagementBreakdown = useMemo(() => {
    const counts: Record<string, number> = { high: 0, medium: 0, low: 0 };
    withAnalytics.forEach((n) => {
      const level = n.analytics!.engagementLevel?.toLowerCase() ?? "medium";
      counts[level] = (counts[level] ?? 0) + 1;
    });
    return counts;
  }, [withAnalytics]);

  // Speaker leaderboard
  const speakerStats = useMemo(() => {
    const map: Record<string, { totalRatio: number; count: number; topCount: number }> = {};
    withAnalytics.forEach((n) => {
      const ratio = n.analytics!.talkTimeRatio;
      if (ratio) {
        Object.entries(ratio).forEach(([speaker, val]) => {
          if (!map[speaker]) map[speaker] = { totalRatio: 0, count: 0, topCount: 0 };
          map[speaker].totalRatio += val;
          map[speaker].count += 1;
        });
      }
      const top = n.analytics!.topSpeaker;
      if (top) {
        if (!map[top]) map[top] = { totalRatio: 0, count: 0, topCount: 0 };
        map[top].topCount += 1;
      }
    });
    return Object.entries(map)
      .map(([name, s]) => ({
        name,
        avgRatio: Math.round((s.totalRatio / Math.max(s.count, 1)) * 100),
        topCount: s.topCount,
        meetings: s.count,
      }))
      .sort((a, b) => b.topCount - a.topCount || b.avgRatio - a.avgRatio)
      .slice(0, 8);
  }, [withAnalytics]);

  // Sentiment over time
  const sentimentTimeline = useMemo(() => {
    return withAnalytics
      .filter((n) => n.analytics!.sentimentScore != null)
      .map((n) => ({
        date: format(new Date(n.created_at), "MMM d"),
        sentiment: Math.round((n.analytics!.sentimentScore ?? 0) * 100),
        title: n.title || "Untitled",
      }));
  }, [withAnalytics]);

  // Engagement bar data
  const engagementData = useMemo(() => [
    { level: "High", count: engagementBreakdown.high, fill: "hsl(var(--accent))" },
    { level: "Medium", count: engagementBreakdown.medium, fill: "hsl(var(--warning, 45 93% 47%))" },
    { level: "Low", count: engagementBreakdown.low, fill: "hsl(var(--muted-foreground))" },
  ], [engagementBreakdown]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-12">
        <PageHeader back title={t("analytics.title")} rightContent={
          <BarChart3 size={18} className="text-primary" />
        } />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Scope toggle (only shown for org members) */}
        {hasOrg && (
          <div className="flex p-1 bg-muted/50 rounded-xl">
            {(["me", "team"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  scope === s
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {s === "me" ? t("analytics.myInsights") : t("analytics.team")}
              </button>
            ))}
          </div>
        )}

        {/* Range Picker */}
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                rangeDays === r.days
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {scope === "team" && hasOrg ? (
          <TeamAnalytics rangeDays={rangeDays} />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : withAnalytics.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <BarChart3 size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">{t("analytics.noDataYet")}</p>
            <p className="text-muted-foreground/60 text-xs">{t("analytics.recordToSee")}</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <Card className="card-elevated border-none">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("analytics.avgSentiment")}</span>
                      {avgSentiment != null && <SentimentIcon score={avgSentiment} />}
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {avgSentiment != null ? `${Math.round(avgSentiment * 100)}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{t("analytics.across")} {withAnalytics.length} {t("analytics.meeting")}{withAnalytics.length !== 1 ? "s" : ""}</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="card-elevated border-none">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("analytics.questions")}</span>
                      <MessageCircleQuestion size={20} className="text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{totalQuestions}</p>
                    <p className="text-[10px] text-muted-foreground">{t("analytics.totalAsked")}</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="card-elevated border-none">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("analytics.meetings")}</span>
                      <Mic size={20} className="text-accent" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
                    <p className="text-[10px] text-muted-foreground">{totalMeetingMinutes} {t("analytics.minRecorded")}</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="card-elevated border-none">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("analytics.engagement")}</span>
                      <Zap size={20} className="text-amber-400" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {engagementBreakdown.high > 0 ? `${Math.round((engagementBreakdown.high / withAnalytics.length) * 100)}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{t("analytics.highEngagement")}</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Sentiment Over Time */}
            {sentimentTimeline.length >= 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="card-elevated border-none">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp size={14} className="text-primary" />
                      {t("analytics.sentimentOverTime")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={sentimentTimeline}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                          formatter={(value: number) => [`${value}%`, "Sentiment"]}
                          labelFormatter={(label) => label}
                        />
                        <Line type="monotone" dataKey="sentiment" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Engagement Breakdown */}
            {withAnalytics.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="card-elevated border-none">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Zap size={14} className="text-amber-400" />
                      {t("analytics.engagementBreakdown")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-4">
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={engagementData} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="level" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} width={60} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                          formatter={(value: number) => [`${value} meetings`, ""]}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                          {engagementData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Top Speakers */}
            {speakerStats.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="card-elevated border-none">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users size={14} className="text-primary" />
                      {t("analytics.mostActiveSpeakers")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {speakerStats.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.meetings} meeting{s.meetings !== 1 ? "s" : ""} · avg {s.avgRatio}% talk time</p>
                        </div>
                        {s.topCount > 0 && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            🎤 {s.topCount}x top
                          </span>
                        )}
                        {/* Talk ratio bar */}
                        <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${s.avgRatio}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
