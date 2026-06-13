import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * High-level "health dashboard" for connected Pipedream apps.
 * Aggregates rows from `pipedream_connections` into per-app summary cards
 * showing status, when each app last reconnected, and overall health.
 *
 * Subscribes to realtime updates so the view always reflects the latest
 * connection state without manual refreshes.
 */

type ConnectionStatus = "active" | "error" | "revoked" | string;

interface PipedreamConnectionRow {
  id: string;
  app_slug: string;
  app_name: string;
  status: ConnectionStatus;
  environment: string;
  connected_at: string | null;
  updated_at: string | null;
  last_error: string | null;
}

interface AppGroup {
  app_slug: string;
  app_name: string;
  totalAccounts: number;
  active: number;
  errored: number;
  revoked: number;
  lastConnectedAt: string | null;
  lastUpdatedAt: string | null;
  lastError: string | null;
  environments: Set<string>;
}

type Health = "healthy" | "degraded" | "down" | "unknown";

function deriveHealth(group: AppGroup): Health {
  if (group.totalAccounts === 0) return "unknown";
  if (group.active === 0 && (group.errored > 0 || group.revoked > 0)) return "down";
  if (group.errored > 0 || group.revoked > 0) return "degraded";
  if (group.active > 0) return "healthy";
  return "unknown";
}

function HealthBadge({ health }: { health: Health }) {
  const map: Record<
    Health,
    { label: string; classes: string; Icon: typeof CheckCircle2 }
  > = {
    healthy: {
      label: "Healthy",
      classes: "border-green-500/30 text-green-500 bg-green-500/10",
      Icon: CheckCircle2,
    },
    degraded: {
      label: "Degraded",
      classes: "border-amber-500/30 text-amber-500 bg-amber-500/10",
      Icon: AlertTriangle,
    },
    down: {
      label: "Down",
      classes: "border-destructive/40 text-destructive bg-destructive/10",
      Icon: XCircle,
    },
    unknown: {
      label: "Unknown",
      classes: "border-muted-foreground/30 text-muted-foreground",
      Icon: Activity,
    },
  };
  const { label, classes, Icon } = map[health];
  return (
    <Badge variant="outline" className={cn(classes, "gap-1")}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}

function groupByApp(rows: PipedreamConnectionRow[]): AppGroup[] {
  const map = new Map<string, AppGroup>();
  for (const r of rows) {
    const key = r.app_slug;
    let g = map.get(key);
    if (!g) {
      g = {
        app_slug: r.app_slug,
        app_name: r.app_name || r.app_slug,
        totalAccounts: 0,
        active: 0,
        errored: 0,
        revoked: 0,
        lastConnectedAt: null,
        lastUpdatedAt: null,
        lastError: null,
        environments: new Set(),
      };
      map.set(key, g);
    }
    g.totalAccounts += 1;
    if (r.status === "active") g.active += 1;
    else if (r.status === "error") g.errored += 1;
    else if (r.status === "revoked") g.revoked += 1;
    if (r.environment) g.environments.add(r.environment);
    if (r.connected_at && (!g.lastConnectedAt || r.connected_at > g.lastConnectedAt)) {
      g.lastConnectedAt = r.connected_at;
    }
    if (r.updated_at && (!g.lastUpdatedAt || r.updated_at > g.lastUpdatedAt)) {
      g.lastUpdatedAt = r.updated_at;
    }
    // Surface the most recent error message across accounts.
    if (r.last_error && (!g.lastError || (r.updated_at ?? "") >= (g.lastUpdatedAt ?? ""))) {
      g.lastError = r.last_error;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    // Surface unhealthy apps first, then most recent activity.
    const ha = deriveHealth(a);
    const hb = deriveHealth(b);
    const rank: Record<Health, number> = { down: 0, degraded: 1, unknown: 2, healthy: 3 };
    if (rank[ha] !== rank[hb]) return rank[ha] - rank[hb];
    return (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "");
  });
}

export default function IntegrationsStatusView() {
  const [rows, setRows] = useState<PipedreamConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (mode: "initial" | "manual" = "initial") => {
    if (mode === "manual") setRefreshing(true);
    const { data, error } = await supabase
      .from("pipedream_connections")
      .select("id, app_slug, app_name, status, environment, connected_at, updated_at, last_error")
      .order("updated_at", { ascending: false });
    if (!error) setRows((data ?? []) as PipedreamConnectionRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void load("initial");
    // Realtime: any insert/update/delete on the user's connections refreshes the view.
    const channel = supabase
      .channel("pipedream-connections-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipedream_connections" },
        () => {
          void load("initial");
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const groups = useMemo(() => groupByApp(rows), [rows]);

  const totals = useMemo(() => {
    const t = { healthy: 0, degraded: 0, down: 0, unknown: 0 };
    for (const g of groups) t[deriveHealth(g)] += 1;
    return t;
  }, [groups]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plug className="h-4 w-4" /> Integrations status
          </h4>
          <p className="text-xs text-muted-foreground">
            Per-app connection health and last activity. Updates in realtime.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <span className="text-green-500">{totals.healthy} healthy</span>
            <span>·</span>
            <span className="text-amber-500">{totals.degraded} degraded</span>
            <span>·</span>
            <span className="text-destructive">{totals.down} down</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load("manual")}
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1.5">Refresh</span>
          </Button>
        </div>
      </div>

      {loading && groups.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
        </div>
      ) : groups.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground text-center">
          No integrations connected yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
          {groups.map((g) => {
            const health = deriveHealth(g);
            return (
              <div
                key={g.app_slug}
                className="rounded-md border border-border bg-background/50 p-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{g.app_name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {g.app_slug}
                      {g.environments.size > 0 && ` · ${Array.from(g.environments).join(", ")}`}
                    </div>
                  </div>
                  <HealthBadge health={health} />
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Accounts</dt>
                  <dd className="text-foreground text-right">
                    {g.active}/{g.totalAccounts} active
                  </dd>

                  <dt className="text-muted-foreground">Connected</dt>
                  <dd className="text-foreground text-right">
                    {g.lastConnectedAt
                      ? formatDistanceToNow(new Date(g.lastConnectedAt), { addSuffix: true })
                      : "—"}
                  </dd>

                  <dt className="text-muted-foreground">Last activity</dt>
                  <dd className="text-foreground text-right">
                    {g.lastUpdatedAt
                      ? formatDistanceToNow(new Date(g.lastUpdatedAt), { addSuffix: true })
                      : "—"}
                  </dd>

                  {(g.errored > 0 || g.revoked > 0) && (
                    <>
                      <dt className="text-muted-foreground">Issues</dt>
                      <dd className="text-right">
                        {g.errored > 0 && (
                          <span className="text-destructive">{g.errored} errored</span>
                        )}
                        {g.errored > 0 && g.revoked > 0 && " · "}
                        {g.revoked > 0 && (
                          <span className="text-muted-foreground">{g.revoked} revoked</span>
                        )}
                      </dd>
                    </>
                  )}
                </dl>

                {g.lastError && (
                  <p
                    className="text-[11px] text-destructive line-clamp-2 mt-1"
                    title={g.lastError}
                  >
                    {g.lastError}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
