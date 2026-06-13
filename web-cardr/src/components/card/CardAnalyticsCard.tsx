import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Eye, Share2, UserPlus, TrendingUp } from "lucide-react";
import { fetchCardAnalytics, type CardAnalytics } from "@/lib/cardAnalytics";

interface CardAnalyticsCardProps {
  slug: string | null | undefined;
}

/** Owner-facing view/share/save analytics for a digital card. */
const CardAnalyticsCard = ({ slug }: CardAnalyticsCardProps) => {
  const [data, setData] = useState<CardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchCardAnalytics(slug);
    setData(result);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxTrend = useMemo(
    () => Math.max(1, ...(data?.viewsTrend ?? [0])),
    [data],
  );

  const stats = [
    { icon: Eye, label: "Views", value: data?.views ?? 0, color: "text-primary" },
    { icon: Share2, label: "Shares", value: data?.shares ?? 0, color: "text-accent" },
    { icon: UserPlus, label: "Saves", value: data?.saves ?? 0, color: "text-emerald-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated rounded-2xl p-5 mt-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={15} className="text-primary" />
        <h2 className="text-sm font-display font-bold text-foreground">Card Analytics</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-secondary/40 p-3 text-center">
            <Icon size={16} className={`mx-auto mb-1.5 ${color}`} />
            <p className="text-lg font-bold text-foreground tabular-nums">
              {loading ? "—" : value.toLocaleString()}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Views · last 7 days</p>
        <div className="flex items-end justify-between gap-1.5 h-16">
          {(data?.viewsTrend ?? [0, 0, 0, 0, 0, 0, 0]).map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(count / maxTrend) * 100}%` }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 200, damping: 20 }}
                className="w-full min-h-[3px] rounded-full bg-gradient-to-t from-primary to-accent"
              />
            </div>
          ))}
        </div>
      </div>

      {!loading && data && data.views + data.shares + data.saves === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          No activity yet. Share your card to start tracking views.
        </p>
      )}
    </motion.div>
  );
};

export default CardAnalyticsCard;
