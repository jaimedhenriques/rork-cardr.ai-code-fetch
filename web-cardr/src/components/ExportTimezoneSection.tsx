import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Search, Globe2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const browserTz = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
})();

const FALLBACK_TZS = [
  "UTC",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Europe/Amsterdam", "Europe/Stockholm",
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Sao_Paulo",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Asia/Shanghai", "Australia/Sydney",
];

function getAllTimezones(): string[] {
  // @ts-ignore — supportedValuesOf available in modern runtimes
  return (Intl as any).supportedValuesOf?.("timeZone") ?? FALLBACK_TZS;
}

export default function ExportTimezoneSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: defaultTz, isLoading } = useQuery({
    queryKey: ["profile-default-export-tz"],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("default_export_timezone")
        .eq("id", userId)
        .maybeSingle();
      return (data?.default_export_timezone as string | null) ?? null;
    },
    enabled: !!userId,
  });

  const effective = defaultTz ?? browserTz;

  const saveTz = useMutation({
    mutationFn: async (tz: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ default_export_timezone: tz })
        .eq("id", userId);
      if (error) throw error;
      return tz;
    },
    onSuccess: (tz) => {
      queryClient.setQueryData(["profile-default-export-tz"], tz);
      toast.success(`${tz} is now your default export timezone.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save timezone"),
  });

  const allTzs = useMemo(() => {
    const all = getAllTimezones();
    const pinned = Array.from(new Set([
      ...(defaultTz ? [defaultTz] : []),
      browserTz,
      "UTC",
    ]));
    return [...pinned, ...all.filter((t) => !pinned.includes(t))];
  }, [defaultTz]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTzs;
    return allTzs.filter((t) => t.toLowerCase().includes(q));
  }, [allTzs, search]);

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Globe2 size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Current default
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm font-semibold text-foreground truncate">{effective}</p>
            {defaultTz ? (
              <Badge variant="secondary" className="text-[10px]">Your default</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Browser fallback</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Used by new export schedules and one-click email exports unless you override per schedule.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search timezones…"
          className="pl-9"
        />
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No timezones match “{search}”.
            </div>
          ) : (
            filtered.map((tz) => {
              const isCurrent = tz === effective;
              const isSavedDefault = tz === defaultTz;
              const isBrowser = tz === browserTz;
              return (
                <button
                  key={tz}
                  type="button"
                  onClick={() => saveTz.mutate(tz)}
                  disabled={saveTz.isPending || isSavedDefault}
                  className={cn(
                    "w-full flex items-center justify-between py-3 px-4 border-b border-border/40 last:border-b-0 transition-colors text-left",
                    isCurrent ? "bg-primary/5" : "active:bg-secondary/30 hover:bg-secondary/20",
                    saveTz.isPending && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-foreground truncate">{tz}</span>
                    {isSavedDefault && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">Your default</Badge>
                    )}
                    {!isSavedDefault && isBrowser && (
                      <Badge variant="outline" className="text-[10px] shrink-0">Browser</Badge>
                    )}
                  </div>
                  {isCurrent && <Check size={16} className="text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {defaultTz && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => saveTz.mutate(browserTz)}
          disabled={saveTz.isPending}
        >
          Reset to browser timezone ({browserTz})
        </Button>
      )}
    </div>
  );
}
