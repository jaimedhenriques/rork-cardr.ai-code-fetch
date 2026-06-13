import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle, ArrowLeft, Download, ExternalLink, FileWarning, Loader2,
  RefreshCw, Settings2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  type EditorPrefs,
  loadEditorPrefs,
  saveEditorPrefs,
  buildEditorUrl,
} from "@/lib/editorDeepLink";

interface CiRun {
  id: string;
  source: string;
  status: string;
  branch: string | null;
  commit_sha: string | null;
  triggered_by: string | null;
  total_errors: number;
  total_warnings: number;
  created_at: string;
}

interface CiError {
  id: string;
  run_id: string;
  source: string;
  severity: "error" | "warning" | "info";
  file_path: string | null;
  line_number: number | null;
  column_number: number | null;
  rule: string | null;
  code: string | null;
  message: string;
}

const SOURCES = ["all", "tsc", "eslint", "vite", "ci"];

export default function CiErrors() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = usePlatformAdmin();

  const [runs, setRuns] = useState<CiRun[]>([]);
  const [errors, setErrors] = useState<CiError[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [source, setSource] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<EditorPrefs>(loadEditorPrefs);

  useEffect(() => {
    saveEditorPrefs(prefs);
  }, [prefs]);

  const loadRuns = async () => {
    setLoading(true);
    let q = supabase
      .from("ci_runs" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (source !== "all") q = q.eq("source", source);
    const { data } = await q;
    const list = (data as unknown as CiRun[]) ?? [];
    setRuns(list);
    if (list.length && !selectedRun) setSelectedRun(list[0].id);
    setLoading(false);
  };

  const loadErrors = async (runId: string) => {
    let q = supabase
      .from("ci_errors" as never)
      .select("*")
      .eq("run_id", runId)
      .order("severity", { ascending: true })
      .order("file_path", { ascending: true })
      .limit(1000);
    if (severity !== "all") q = q.eq("severity", severity);
    const { data } = await q;
    setErrors((data as unknown as CiError[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, source]);

  useEffect(() => {
    if (selectedRun) loadErrors(selectedRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRun, severity]);

  const grouped = useMemo(() => {
    const m = new Map<string, CiError[]>();
    for (const e of errors) {
      const k = e.file_path ?? "(unknown)";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [errors]);

  const handleExport = useCallback(async () => {
    const targetRun = runs.find((r) => r.id === selectedRun) ?? runs[0];
    if (!targetRun) return;

    const { data: allErrors } = await supabase
      .from("ci_errors" as never)
      .select("*")
      .eq("run_id", targetRun.id)
      .order("file_path", { ascending: true })
      .limit(1000);

    const escape = (s: string) => {
      const str = String(s ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    // Metadata
    lines.push(`run_source,${escape(targetRun.source)}`);
    lines.push(`run_status,${escape(targetRun.status)}`);
    lines.push(`run_branch,${escape(targetRun.branch ?? "")}`);
    lines.push(`run_commit,${escape(targetRun.commit_sha ?? "")}`);
    lines.push(`run_triggered_by,${escape(targetRun.triggered_by ?? "")}`);
    lines.push(`run_total_errors,${targetRun.total_errors}`);
    lines.push(`run_total_warnings,${targetRun.total_warnings}`);
    lines.push(`run_created_at,${escape(targetRun.created_at)}`);
    lines.push("");
    // Headers
    lines.push("file_path,line_number,column_number,severity,rule_code,message");
    // Errors
    const errorList = ((allErrors as unknown as CiError[]) ?? []);
    for (const e of errorList) {
      lines.push(
        `${escape(e.file_path)},${e.line_number ?? ""},${e.column_number ?? ""},${escape(e.severity)},${escape(e.rule ?? e.code ?? "")},${escape(e.message)}`
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ci-run-${targetRun.source}-${targetRun.created_at.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [runs, selectedRun]);

  if (adminLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">Admins only.</p>
        <Button variant="outline" onClick={() => navigate("/app")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to="/app/admin"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">CI Errors</h1>
              <p className="text-sm text-muted-foreground">
                Parsed typecheck, lint and build failures from ingested logs.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto grid gap-6 px-4 py-6 lg:grid-cols-[360px,1fr]">
        <Card className="self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Runs</CardTitle>
            <div className="pt-2">
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {runs.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No runs ingested yet.
              </p>
            )}
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRun(r.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-accent ${
                  selectedRun === r.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.source}</span>
                  <Badge
                    variant={r.status === "passed" ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {r.status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{r.total_errors}E</span>
                  <span>{r.total_warnings}W</span>
                  {r.branch && <span className="truncate">· {r.branch}</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {selectedRun ? "Errors" : "Select a run"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!runs.length}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    title={
                      prefs.root
                        ? `Open in ${prefs.editor} · root: ${prefs.root}`
                        : "Configure editor deep-links"
                    }
                  >
                    <Settings2
                      size={14}
                      className={prefs.root ? "" : "text-amber-400"}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Editor</Label>
                    <Select
                      value={prefs.editor}
                      onValueChange={(v) =>
                        setPrefs((p) => ({ ...p, editor: v as EditorPrefs["editor"] }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vscode">VS Code</SelectItem>
                        <SelectItem value="vscode-insiders">VS Code Insiders</SelectItem>
                        <SelectItem value="cursor">Cursor</SelectItem>
                        <SelectItem value="windsurf">Windsurf</SelectItem>
                        <SelectItem value="jetbrains">JetBrains (WebStorm)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Local repo root</Label>
                    <Input
                      value={prefs.root}
                      onChange={(e) =>
                        setPrefs((p) => ({ ...p, root: e.target.value }))
                      }
                      placeholder="/Users/me/code/cardscanpro"
                      className="h-8 text-xs font-mono"
                      spellCheck={false}
                    />
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Absolute path to this repo on your machine. The link joins
                      this with the file path the type-checker reported.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all</SelectItem>
                  <SelectItem value="error">error</SelectItem>
                  <SelectItem value="warning">warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {grouped.length === 0 && selectedRun && (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <FileWarning className="h-6 w-6" />
                <p className="text-sm">No issues match this filter.</p>
              </div>
            )}
            {grouped.map(([file, items]) => {
              const fileUrl = buildEditorUrl(prefs, file, 1, 1);
              return (
                <div key={file}>
                  <div className="mb-2 flex items-center gap-2">
                    {fileUrl ? (
                      <a
                        href={fileUrl}
                        title={`Open ${file} in ${prefs.editor}`}
                        className="inline-flex items-center gap-1 text-xs font-medium font-mono text-primary hover:underline"
                      >
                        {file}
                        <ExternalLink size={10} className="opacity-60" />
                      </a>
                    ) : (
                      <code className="text-xs font-medium">{file}</code>
                    )}
                    <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                  </div>
                  <div className="rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Line</TableHead>
                          <TableHead className="w-24">Severity</TableHead>
                          <TableHead className="w-40">Rule / Code</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((e) => {
                          const errUrl = buildEditorUrl(prefs, e.file_path ?? file, e.line_number ?? undefined, e.column_number ?? undefined);
                          return (
                            <TableRow key={e.id}>
                              <TableCell className="font-mono text-xs">
                                {errUrl ? (
                                  <a
                                    href={errUrl}
                                    title={`Open ${e.file_path ?? file}:${e.line_number ?? 1}:${e.column_number ?? 1} in ${prefs.editor}`}
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    {e.line_number ?? "-"}:{e.column_number ?? "-"}
                                    <ExternalLink size={9} className="opacity-60" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {e.line_number ?? "-"}:{e.column_number ?? "-"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={e.severity === "error" ? "destructive" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {e.severity}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-[11px] text-muted-foreground">
                                {e.rule ?? e.code ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm">{e.message}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
