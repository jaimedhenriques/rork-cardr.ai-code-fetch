import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RefreshCw, Trash2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface PipedreamConnection {
  id: string;
  app_slug: string;
  app_name: string;
  pipedream_account_id: string;
  status: string;
  environment: string;
  connected_at: string;
  updated_at: string;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Active
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10">
        <AlertTriangle className="h-3 w-3 mr-1" /> Error
      </Badge>
    );
  }
  if (status === "revoked") {
    return (
      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" /> Revoked
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

export default function PipedreamConnectionsTable() {
  const [rows, setRows] = useState<PipedreamConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pipedream_connections")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setRows((data ?? []) as PipedreamConnection[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const retry = async (conn: PipedreamConnection) => {
    setRetrying(conn.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "pipedream-list-accounts",
        { body: { app_slug: conn.app_slug, app_name: conn.app_name, persist: true } },
      );
      if (error) throw new Error(error.message);
      const accounts = (data as { accounts?: Array<{ id: string; healthy?: boolean; dead?: boolean }> } | null)?.accounts ?? [];
      const match = accounts.find((a) => a.id === conn.pipedream_account_id);
      await load();
      if (!match) {
        toast.error("Account not found on Pipedream — you may need to reconnect.");
      } else if (match.dead) {
        toast.error(`${conn.app_name} access was revoked. Reconnect to restore.`);
      } else if (match.healthy === false) {
        toast.error(`${conn.app_name} is unhealthy. Try reconnecting.`);
      } else {
        toast.success(`${conn.app_name} is healthy`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Retry failed";
      toast.error(msg);
    } finally {
      setRetrying(null);
    }
  };

  const remove = async (conn: PipedreamConnection) => {
    if (!confirm(`Remove ${conn.app_name} connection?`)) return;
    const { error } = await supabase
      .from("pipedream_connections")
      .delete()
      .eq("id", conn.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${conn.app_name} removed`);
      load();
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Connection health</h4>
          <p className="text-xs text-muted-foreground">
            Last sync, errors, and quick retry for every connected integration.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connections…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground text-center">
          No connections yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead>Last error</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{c.app_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {c.app_slug} · {c.environment}
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.updated_at
                    ? formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })
                    : "—"}
                </TableCell>
                <TableCell className="max-w-[260px]">
                  {c.last_error ? (
                    <span className="text-xs text-destructive line-clamp-2" title={c.last_error}>
                      {c.last_error}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => retry(c)}
                      disabled={retrying === c.id}
                    >
                      {retrying === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1.5 hidden sm:inline">Retry</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(c)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
