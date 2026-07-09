import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useLanguage } from "@/context/LanguageContext";
import { Plus, MapPin, Calendar, Users, BarChart3, Sparkles, ChevronRight, Trash2, Globe, Wand2, Loader2 } from "lucide-react";
import EventFileUploader from "@/components/EventFileUploader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const Events = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(searchParams.get("selected"));
  useEffect(() => {
    const sel = searchParams.get("selected");
    if (sel) setSelectedEvent(sel);
  }, [searchParams]);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", location: "", event_type: "conference",
    start_date: "", end_date: "", website: "",
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: eventContacts = [] } = useQuery({
    queryKey: ["event_contacts", selectedEvent],
    queryFn: async () => {
      if (!selectedEvent) return [];
      const { data, error } = await supabase
        .from("event_contacts")
        .select("*, contacts(*)")
        .eq("event_id", selectedEvent);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEvent,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts_for_events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, company, title")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!selectedEvent,
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("events").insert({
        user_id: user.id,
        title: form.title,
        description: form.description,
        location: form.location,
        event_type: form.event_type,
        start_date: form.start_date || new Date().toISOString(),
        end_date: form.end_date || null,
        website: form.website || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setShowCreate(false);
      setForm({ title: "", description: "", location: "", event_type: "conference", start_date: "", end_date: "", website: "" });
      toast.success(t("events.created"));
    },
    onError: () => toast.error(t("events.failedCreate")),
  });

  const addContact = useMutation({
    mutationFn: async (contactId: string) => {
      if (!user || !selectedEvent) throw new Error("Missing data");
      const { error } = await supabase.from("event_contacts").insert({
        event_id: selectedEvent,
        contact_id: contactId,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_contacts"] });
      toast.success(t("events.contactAdded"));
    },
    onError: () => toast.error(t("events.failedAddContact")),
  });

  const removeContact = useMutation({
    mutationFn: async (ecId: string) => {
      const { error } = await supabase.from("event_contacts").delete().eq("id", ecId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_contacts"] });
      toast.success(t("events.contactRemoved"));
    },
  });

  const handleEnrich = async () => {
    if (!form.title.trim()) {
      toast.error(t("events.enterNameFirst"));
      return;
    }
    setEnriching(true);
    try {
      // Extract year from start_date or current year
      const year = form.start_date
        ? new Date(form.start_date).getFullYear().toString()
        : new Date().getFullYear().toString();

      const { data, error } = await supabase.functions.invoke("enrich-event", {
        body: { title: form.title, website: form.website || null, year },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Only fill empty fields
      setForm(prev => ({
        ...prev,
        description: prev.description || data.description || "",
        location: prev.location || data.location || "",
        start_date: prev.start_date || (data.start_date ? data.start_date : ""),
        end_date: prev.end_date || (data.end_date ? data.end_date : ""),
        event_type: data.event_type || prev.event_type,
        website: prev.website || data.website || "",
      }));
      toast.success(t("events.enrichedAI"));
    } catch (err: any) {
      console.error("Enrich error:", err);
      toast.error(t("events.enrichFailed"));
    }
    setEnriching(false);
  };

  const canEnrich = form.title.trim().length >= 3;

  const generateSummary = async (eventId: string) => {
    setSummaryLoading(true);
    const event = events.find((e: any) => e.id === eventId);
    const { data: contacts } = await supabase
      .from("event_contacts")
      .select("*, contacts(name, company, title, industry, stage_id)")
      .eq("event_id", eventId);

    const contactList = (contacts || []).map((c: any) => c.contacts);
    const industries = [...new Set(contactList.map((c: any) => c.industry).filter(Boolean))];
    const companies = [...new Set(contactList.map((c: any) => c.company).filter(Boolean))];

    const summaryText = `## ${event?.title} — Event Summary\n\n` +
      `📅 ${event?.start_date ? format(new Date(event.start_date), "MMM d, yyyy") : "N/A"}${event?.end_date ? ` — ${format(new Date(event.end_date), "MMM d, yyyy")}` : ""}\n` +
      `📍 ${event?.location || "No location"}\n\n` +
      `### Key Metrics\n` +
      `- **Total contacts made:** ${contactList.length}\n` +
      `- **Companies represented:** ${companies.length}\n` +
      `- **Industries covered:** ${industries.length}\n\n` +
      `### Industries\n${industries.map(i => `- ${i}`).join("\n") || "- No industry data"}\n\n` +
      `### Companies\n${companies.map(c => `- ${c}`).join("\n") || "- No company data"}\n\n` +
      `### Contacts\n${contactList.map((c: any) => `- **${c.name}** — ${c.title} at ${c.company}`).join("\n") || "- No contacts tagged yet"}`;

    setSummary(summaryText);
    setShowSummary(true);
    setSummaryLoading(false);
  };

  const selectedEventData = events.find((e: any) => e.id === selectedEvent);
  const linkedContactIds = new Set(eventContacts.map((ec: any) => ec.contact_id));
  const availableContacts = allContacts.filter((c: any) => !linkedContactIds.has(c.id));

  const upcomingEvents = events.filter((e: any) => new Date(e.start_date) >= new Date());
  const pastEvents = events.filter((e: any) => new Date(e.start_date) < new Date());

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader rightContent={
        <Sheet open={showCreate} onOpenChange={setShowCreate}>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
              <Plus size={12} /> {t("events.newEvent")}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader><SheetTitle className="text-left">{t("events.newEventConference")}</SheetTitle></SheetHeader>
            <div className="space-y-3 mt-4">
              <Input placeholder={t("events.eventName")} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              
              {/* Website — optional */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Globe size={11} className="text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">{t("events.website")} <span className="text-muted-foreground/50">({t("events.optional")})</span></label>
                </div>
                <Input placeholder="https://ces.tech" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
              </div>

              {/* AI Enrichment hint */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Wand2 size={13} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-xs font-semibold text-foreground">{t("events.autoFillAI")}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {t("events.autoFillDesc")}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={handleEnrich}
                      disabled={!canEnrich || enriching}
                    >
                      {enriching ? <><Loader2 size={11} className="animate-spin" /> {t("events.enriching")}</> : <><Sparkles size={11} /> {t("events.enrichDetails")}</>}
                    </Button>
                  </div>
                </div>
              </div>

              <Textarea placeholder={t("events.description")} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <Input placeholder={t("events.location")} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("events.startDate")}</label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("events.endDate")}</label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("events.eventType")}</label>
                <div className="flex gap-2">
                  {["conference", "tradeshow", "meetup", "webinar"].map(type => (
                    <button key={type} onClick={() => setForm(f => ({ ...f, event_type: type }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${form.event_type === type ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={() => createEvent.mutate()} disabled={!form.title || createEvent.isPending}>
                {createEvent.isPending ? t("events.creating") : t("events.createEvent")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      } />

      <div className="px-4 pt-2">
        {selectedEvent && selectedEventData ? (
          /* Event detail view */
          <div>
            <button onClick={() => setSelectedEvent(null)} className="text-xs text-primary mb-3 flex items-center gap-1">
              <ChevronRight size={12} className="rotate-180" /> {t("events.backToEvents")}
            </button>

            <div className="rounded-xl bg-card border border-border/60 p-4 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">{selectedEventData.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedEventData.description}</p>
                </div>
                <Badge variant="secondary" className="text-[11px] capitalize">{selectedEventData.event_type}</Badge>
              </div>
              <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground tabular-nums">
                {selectedEventData.start_date && (
                  <span className="flex items-center gap-1"><Calendar size={10} />{format(new Date(selectedEventData.start_date), "MMM d, yyyy")}</span>
                )}
                {selectedEventData.location && (
                  <span className="flex items-center gap-1"><MapPin size={10} />{selectedEventData.location}</span>
                )}
                {(selectedEventData as any).website && (
                  <a href={(selectedEventData as any).website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <Globe size={10} />{t("events.website")}
                  </a>
                )}
              </div>
            </div>

            {/* Summary button */}
            <Button variant="outline" className="w-full mb-4 gap-2 text-xs" onClick={() => generateSummary(selectedEvent)} disabled={summaryLoading}>
              <Sparkles size={14} /> {summaryLoading ? t("events.generating") : t("events.generateSummary")}
            </Button>

            {/* Event passes / file uploads */}
            <div className="mb-4">
              <EventFileUploader eventId={selectedEvent} />
            </div>

            {/* Contacts in event */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Users size={14} /> {t("events.contacts")} ({eventContacts.length})
                </h3>
              </div>

              {eventContacts.map((ec: any) => (
                <div key={ec.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-secondary/50 mb-1.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{ec.contacts?.name}</p>
                    <p className="text-[11px] text-muted-foreground">{ec.contacts?.title} at {ec.contacts?.company}</p>
                  </div>
                  <button onClick={() => removeContact.mutate(ec.id)} className="p-1.5 rounded-lg hover:bg-destructive/10">
                    <Trash2 size={12} className="text-destructive" />
                  </button>
                </div>
              ))}

              {/* Add contact */}
              {availableContacts.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5">{t("events.tagContact")}</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {availableContacts.slice(0, 20).map((c: any) => (
                      <button key={c.id} onClick={() => addContact.mutate(c.id)}
                        className="w-full flex items-center justify-between py-2 px-3 rounded-xl hover:bg-secondary/50 text-left transition-colors">
                        <div>
                          <p className="text-sm text-foreground">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{c.company}</p>
                        </div>
                        <Plus size={12} className="text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Events list */
          <Tabs defaultValue="upcoming">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="upcoming" className="flex-1 text-xs">{t("events.upcoming")}</TabsTrigger>
              <TabsTrigger value="past" className="flex-1 text-xs">{t("events.past")}</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                  {t("events.noUpcoming")}
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event: any) => (
                    <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event.id)} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past">
              {pastEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">{t("events.noPast")}</div>
              ) : (
                <div className="space-y-2">
                  {pastEvents.map((event: any) => (
                    <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event.id)} showSummary />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Summary sheet */}
      <Sheet open={showSummary} onOpenChange={setShowSummary}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle className="text-left">{t("events.eventSummary")}</SheetTitle></SheetHeader>
          <div className="mt-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm text-foreground">
            {summary}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const EventCard = ({ event, onClick, showSummary }: { event: any; onClick: () => void; showSummary?: boolean }) => (
  <button onClick={onClick} className="w-full rounded-xl bg-card border border-border/60 p-4 text-left hover:border-primary/30 transition-colors">
    <div className="flex items-start justify-between">
      <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
      <Badge variant="secondary" className="text-[11px] capitalize">{event.event_type}</Badge>
    </div>
    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground tabular-nums">
      <span className="flex items-center gap-1">
        <Calendar size={10} />
        {format(new Date(event.start_date), "MMM d, yyyy")}
      </span>
      {event.location && (
        <span className="flex items-center gap-1"><MapPin size={10} />{event.location}</span>
      )}
    </div>
    {event.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{event.description}</p>}
  </button>
);

export default Events;
