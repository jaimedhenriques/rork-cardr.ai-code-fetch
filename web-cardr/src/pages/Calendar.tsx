import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, addWeeks, subWeeks, addYears, subYears, addDays, subDays,
  startOfWeek, endOfWeek, startOfYear, endOfYear, isToday, startOfDay, endOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Bot, CalendarDays, List, Users, X, Search, RefreshCw, Unlink, Check, Crown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { isIosNative } from "@/lib/iosCompliance";
import PageHeader from "@/components/PageHeader";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import CalendarGridView from "@/components/calendar/CalendarGridView";
import CalendarListView from "@/components/calendar/CalendarListView";
import CalendarEventCard from "@/components/calendar/CalendarEventCard";
import ReminderAlertSection from "@/components/calendar/ReminderAlertSection";

type ViewMode = "grid" | "list";
type TimeRange = "day" | "week" | "month" | "year";

const emptyForm = {
  title: "", description: "", location: "", meeting_url: "",
  start_time: "", end_time: "", all_day: false,
  bot_enabled: false, bot_name: "Card ScanPro AI", reminder_minutes: 30,
  reminder_type: "in_app" as string, reminder_email: "",
};

const Calendar = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { contacts: appContacts } = useApp();
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [form, setForm] = useState({ ...emptyForm });
  const [linkedContactIds, setLinkedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [selectedGcals, setSelectedGcals] = useState<string[]>([]);

  const gcal = useGoogleCalendar();

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      // Remove code from URL
      setSearchParams({}, { replace: true });
      gcal.exchangeCode(code).then((calendars) => {
        if (calendars && calendars.length > 0) {
          gcal.setAvailableCalendars(calendars);
          // Pre-select primary calendar
          const primary = calendars.find((c: any) => c.primary);
          setSelectedGcals(primary ? [primary.id] : [calendars[0].id]);
          setShowCalendarPicker(true);
        }
      });
    }
  }, [searchParams]);

  // Auto-pull on mount when connected
  useEffect(() => {
    if (gcal.connected && !gcal.loading) {
      gcal.pullEvents();
    }
  }, [gcal.connected, gcal.loading]);

  // Fetch calendar events
  const { data: events = [] } = useQuery({
    queryKey: ["calendar_events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch event-contact links
  const { data: eventContacts = [] } = useQuery({
    queryKey: ["event_contacts_calendar", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("event_contacts")
        .select("event_id, contact_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const enrichedEvents = useMemo(() => {
    return events.map((ev: any) => {
      const linkedIds = eventContacts
        .filter((ec: any) => ec.event_id === ev.event_id)
        .map((ec: any) => ec.contact_id);
      const calLinkedIds = eventContacts
        .filter((ec: any) => ec.event_id === ev.id)
        .map((ec: any) => ec.contact_id);
      const allLinkedIds = [...new Set([...linkedIds, ...calLinkedIds])];
      const linked_contacts = allLinkedIds
        .map((cid) => appContacts.find((c) => c.id === cid))
        .filter(Boolean)
        .map((c) => ({ id: c!.id, name: c!.name }));
      return { ...ev, linked_contacts };
    });
  }, [events, eventContacts, appContacts]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return appContacts.slice(0, 5);
    const q = contactSearch.toLowerCase();
    return appContacts.filter((c) =>
      c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [appContacts, contactSearch]);

  // Create event
  const createEvent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data: inserted, error } = await supabase.from("calendar_events").insert({
        user_id: user.id, title: form.title, description: form.description,
        location: form.location, meeting_url: form.meeting_url,
        start_time: form.start_time || new Date().toISOString(),
        end_time: form.end_time || null, all_day: form.all_day,
        bot_enabled: form.bot_enabled, bot_name: form.bot_name,
        reminder_minutes: form.reminder_minutes,
        reminder_type: form.reminder_type,
        reminder_email: form.reminder_email || null,
      } as any).select().single();
      if (error) throw error;
      if (linkedContactIds.length > 0 && inserted) {
        await supabase.from("event_contacts").insert(
          linkedContactIds.map((cid) => ({
            event_id: inserted.id, contact_id: cid, user_id: user.id,
          }))
        );
      }
      // Push to Google Calendar if connected
      if (gcal.connected && inserted) {
        await gcal.pushEvent(inserted.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      queryClient.invalidateQueries({ queryKey: ["event_contacts_calendar"] });
      closeForm();
      toast.success(t("calendar.eventCreated"));
    },
    onError: () => toast.error(t("calendar.failedCreate")),
  });

  // Update event
  const updateEvent = useMutation({
    mutationFn: async () => {
      if (!user || !editingEventId) throw new Error("Missing data");
      const { error } = await supabase.from("calendar_events").update({
        title: form.title, description: form.description,
        location: form.location, meeting_url: form.meeting_url,
        start_time: form.start_time || new Date().toISOString(),
        end_time: form.end_time || null, all_day: form.all_day,
        bot_enabled: form.bot_enabled, bot_name: form.bot_name,
        reminder_minutes: form.reminder_minutes,
        reminder_type: form.reminder_type,
        reminder_email: form.reminder_email || null,
      } as any).eq("id", editingEventId);
      if (error) throw error;
      await supabase.from("event_contacts").delete()
        .eq("event_id", editingEventId).eq("user_id", user.id);
      if (linkedContactIds.length > 0) {
        await supabase.from("event_contacts").insert(
          linkedContactIds.map((cid) => ({
            event_id: editingEventId, contact_id: cid, user_id: user.id,
          }))
        );
      }
      // Push edit to Google
      if (gcal.connected) {
        await gcal.pushEvent(editingEventId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      queryClient.invalidateQueries({ queryKey: ["event_contacts_calendar"] });
      closeForm();
      toast.success(t("calendar.eventUpdated"));
    },
    onError: () => toast.error(t("calendar.failedUpdate")),
  });

  // Delete event
  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("Not authenticated");
      // Delete from Google first if synced
      if (gcal.connected) {
        await gcal.deleteGoogleEvent(eventId);
      }
      await supabase.from("event_contacts").delete().eq("event_id", eventId).eq("user_id", user.id);
      const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      queryClient.invalidateQueries({ queryKey: ["event_contacts_calendar"] });
      toast.success(t("calendar.eventDeleted"));
    },
    onError: () => toast.error(t("calendar.failedDelete")),
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingEventId(null);
    setForm({ ...emptyForm });
    setLinkedContactIds([]);
    setContactSearch("");
  };

  const openCreate = (prefillDate?: Date) => {
    setEditingEventId(null);
    setForm({
      ...emptyForm,
      start_time: prefillDate ? format(prefillDate, "yyyy-MM-dd'T'09:00") : "",
    });
    setLinkedContactIds([]);
    setContactSearch("");
    setShowForm(true);
  };

  const openEdit = (event: any) => {
    setEditingEventId(event.id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      location: event.location || "",
      meeting_url: event.meeting_url || "",
      start_time: event.start_time ? format(new Date(event.start_time), "yyyy-MM-dd'T'HH:mm") : "",
      end_time: event.end_time ? format(new Date(event.end_time), "yyyy-MM-dd'T'HH:mm") : "",
      all_day: event.all_day || false,
      bot_enabled: event.bot_enabled || false,
      bot_name: event.bot_name || "Card ScanPro AI",
      reminder_minutes: event.reminder_minutes ?? 30,
      reminder_type: event.reminder_type || "in_app",
      reminder_email: event.reminder_email || "",
    });
    const linked = (event.linked_contacts || []).map((c: any) => c.id);
    setLinkedContactIds(linked);
    setContactSearch("");
    setShowForm(true);
  };

  const toggleContact = (contactId: string) => {
    setLinkedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const navigateBack = () => {
    if (timeRange === "day") setCurrentDate(subDays(currentDate, 1));
    else if (timeRange === "week") setCurrentDate(subWeeks(currentDate, 1));
    else if (timeRange === "month") setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subYears(currentDate, 1));
  };
  const navigateForward = () => {
    if (timeRange === "day") setCurrentDate(addDays(currentDate, 1));
    else if (timeRange === "week") setCurrentDate(addWeeks(currentDate, 1));
    else if (timeRange === "month") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addYears(currentDate, 1));
  };

  const headerLabel = useMemo(() => {
    if (timeRange === "day") return format(currentDate, "EEEE, MMM d, yyyy");
    if (timeRange === "week") {
      const ws = startOfWeek(currentDate);
      const we = endOfWeek(currentDate);
      return `${format(ws, "MMM d")} - ${format(we, "MMM d, yyyy")}`;
    }
    if (timeRange === "month") return format(currentDate, "MMMM yyyy");
    return format(currentDate, "yyyy");
  }, [currentDate, timeRange]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (timeRange === "day") return { rangeStart: startOfDay(currentDate), rangeEnd: endOfDay(currentDate) };
    if (timeRange === "week") return { rangeStart: startOfWeek(currentDate), rangeEnd: endOfWeek(currentDate) };
    if (timeRange === "month") return { rangeStart: startOfMonth(currentDate), rangeEnd: endOfMonth(currentDate) };
    return { rangeStart: startOfYear(currentDate), rangeEnd: endOfYear(currentDate) };
  }, [currentDate, timeRange]);

  const days = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return eachDayOfInterval({ start: startOfWeek(ms), end: endOfWeek(me) });
  }, [currentDate]);

  const rangeEvents = useMemo(() => {
    return enrichedEvents.filter((e: any) => {
      const d = new Date(e.start_time);
      return d >= rangeStart && d <= rangeEnd;
    });
  }, [enrichedEvents, rangeStart, rangeEnd]);

  const eventsForDate = (date: Date) =>
    enrichedEvents.filter((e: any) => isSameDay(new Date(e.start_time), date));

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];
  const showGrid = viewMode === "grid" && timeRange === "month";

  const isEditing = !!editingEventId;
  const isSaving = createEvent.isPending || updateEvent.isPending;

  const handleSave = () => {
    if (isEditing) {
      updateEvent.mutate();
    } else {
      createEvent.mutate();
    }
  };

  const handleSaveCalendarSelection = async () => {
    const selected = gcal.availableCalendars.filter((c) => selectedGcals.includes(c.id));
    await gcal.saveCalendars(selected);
    setShowCalendarPicker(false);
    // Trigger initial sync
    gcal.pullEvents();
  };

  // --- Event Form Sheet ---
  const eventFormSheet = (
    <Sheet open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">
            {isEditing ? t("calendar.editEvent") : t("calendar.newEvent")}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          <Input placeholder={t("calendar.eventTitle")} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Textarea placeholder={t("calendar.description")} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="min-h-[60px]" />
          <Input placeholder={t("calendar.location")} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <Input placeholder={t("calendar.meetingUrl")} value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("calendar.start")}</label>
              <Input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("calendar.end")}</label>
              <Input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-foreground">{t("calendar.allDay")}</span>
            <Switch checked={form.all_day} onCheckedChange={v => setForm(f => ({ ...f, all_day: v }))} />
          </div>

          {/* Contact Linking */}
          <div className="rounded-xl bg-secondary/50 border border-border/60 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">{t("calendar.linkContacts")}</span>
            </div>
            {linkedContactIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {linkedContactIds.map((cid) => {
                  const c = appContacts.find((x) => x.id === cid);
                  return c ? (
                    <span key={cid} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {c.name}
                      <button onClick={() => toggleContact(cid)} className="hover:text-destructive">
                        <X size={10} />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("calendar.searchContacts")}
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="h-8 text-xs pl-7"
              />
            </div>
            {filteredContacts.length > 0 && (
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {filteredContacts.map((c) => {
                  const selected = linkedContactIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleContact(c.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors text-xs ${
                        selected ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                        {c.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{c.name}</span>
                        {c.company && <span className="text-muted-foreground ml-1">· {c.company}</span>}
                      </div>
                      {selected && <span className="text-[9px] text-primary font-semibold">{t("calendar.linked")}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {appContacts.length === 0 && (
              <p className="text-[10px] text-muted-foreground">{t("calendar.noContactsYet")}</p>
            )}
          </div>

          {/* AI Bot */}
          <div className="rounded-xl bg-secondary/50 border border-border/60 p-3 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Bot size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">{t("calendar.aiAgent")}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">{t("calendar.botJoins")}</p>
                <p className="text-[10px] text-muted-foreground">{t("calendar.botDesc")}</p>
              </div>
              <Switch checked={form.bot_enabled} onCheckedChange={v => setForm(f => ({ ...f, bot_enabled: v }))} />
            </div>
            {form.bot_enabled && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("calendar.botName")}</label>
                <Input value={form.bot_name} onChange={e => setForm(f => ({ ...f, bot_name: e.target.value }))} placeholder="Card ScanPro AI" />
              </div>
            )}
          </div>

          <ReminderAlertSection
            reminderMinutes={form.reminder_minutes}
            reminderType={form.reminder_type}
            reminderEmail={form.reminder_email}
            onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
          />

          <Button className="w-full" onClick={handleSave} disabled={!form.title || isSaving}>
            {isSaving ? t("calendar.saving") : isEditing ? t("calendar.saveChanges") : t("calendar.createEvent")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  // --- Calendar Picker Sheet ---
  const calendarPickerSheet = (
    <Sheet open={showCalendarPicker} onOpenChange={setShowCalendarPicker}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">Choose Calendars to Sync</SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Select which Google Calendars to sync with Cardr. Events from selected calendars will appear here.
        </p>
        <div className="space-y-2">
          {gcal.availableCalendars.map((cal) => {
            const isSelected = selectedGcals.includes(cal.id);
            return (
              <button
                key={cal.id}
                onClick={() => setSelectedGcals((prev) =>
                  isSelected ? prev.filter((id) => id !== cal.id) : [...prev, cal.id]
                )}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : "border-border/60 bg-secondary/50"
                }`}
              >
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cal.color }} />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">{cal.name}</p>
                  {cal.primary && <span className="text-[9px] text-primary font-semibold">{t("calendar.primary")}</span>}
                </div>
                {isSelected && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </div>
        <Button
          className="w-full mt-4"
          onClick={handleSaveCalendarSelection}
          disabled={selectedGcals.length === 0}
        >
          {t("calendar.syncCount")} {selectedGcals.length}
        </Button>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader />

      <div className="px-4 pt-2">
        {/* View toggle + Time range selector */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center bg-secondary rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <CalendarDays size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <List size={14} />
            </button>
          </div>

          <div className="flex items-center bg-secondary rounded-lg p-0.5 gap-0.5">
            {(["day", "week", "month", "year"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  timeRange === range
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`calendar.${range}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={navigateBack} className="p-2 rounded-xl bg-secondary">
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>
          <h2 className="text-sm font-semibold text-foreground">{headerLabel}</h2>
          <button onClick={navigateForward} className="p-2 rounded-xl bg-secondary">
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Today button */}
        {!isToday(currentDate) && (
          <button
            onClick={() => setCurrentDate(new Date())}
            className="mb-3 text-[10px] font-semibold text-primary hover:underline"
          >
            ← {t("calendar.today")}
          </button>
        )}

        {/* Calendar content */}
        {showGrid ? (
          <>
            <CalendarGridView
              days={days}
              currentMonth={currentDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              eventsForDate={eventsForDate}
            />

            {selectedDate && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{format(selectedDate, "EEEE, MMM d")}</h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openCreate(selectedDate)}>
                   <Plus size={12} /> {t("calendar.add")}
                  </Button>
                </div>
                {selectedEvents.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">{t("calendar.noEvents")}</div>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map((event: any) => (
                      <CalendarEventCard
                        key={event.id}
                        event={event}
                        onEdit={openEdit}
                        onDelete={(id) => deleteEvent.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="mb-4">
            <div className="flex items-center justify-end mb-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openCreate(currentDate)}>
                <Plus size={12} /> {t("calendar.addEvent")}
              </Button>
            </div>
            <CalendarListView events={rangeEvents} timeRange={timeRange} currentDate={currentDate} />
          </div>
        )}

        {/* Google Calendar Sync Section */}
        <div className="rounded-xl bg-card border border-border/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{t("calendar.calendarSync")}</h3>
            {gcal.connected && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => gcal.pullEvents()}
                disabled={gcal.syncing}
              >
                <RefreshCw size={12} className={gcal.syncing ? "animate-spin" : ""} />
                {gcal.syncing ? t("calendar.syncing") : t("calendar.sync")}
              </Button>
            )}
          </div>

          {/* Google Calendar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-secondary/50">
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
                <div>
                  <span className="text-sm text-foreground">Google Calendar</span>
                  {gcal.connected && (
                    <p className="text-[9px] text-primary font-semibold">
                      {gcal.syncedCalendars.length} {t("calendar.calendarsSynced")}
                    </p>
                  )}
                </div>
              </div>
              {gcal.connected ? (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => gcal.disconnect()}>
                    <Unlink size={11} className="mr-1" /> {t("calendar.disconnect")}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    if (!isPro) {
                      toast(t("calendar.proRequired"), isIosNative()
                        ? { description: "Manage your plan at cardr.ai" }
                        : { action: { label: t("settings.upgrade"), onClick: () => navigate("/pricing") } }
                      );
                      return;
                    }
                    gcal.startOAuth();
                  }}
                >
                  {!isPro && <Crown size={10} className="text-primary" />}
                  {t("calendar.connect")}
                </Button>
              )}
            </div>

            {/* Synced calendars list */}
            {gcal.connected && gcal.syncedCalendars.length > 0 && (
              <div className="ml-8 space-y-1">
                {gcal.syncedCalendars.map((sc) => (
                  <div key={sc.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />
                    <span className="truncate">{sc.calendar_name}</span>
                    {sc.last_synced_at && (
                      <span className="text-[9px] text-muted-foreground/60 ml-auto">
                        {format(new Date(sc.last_synced_at), "MMM d, h:mm a")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Other providers — coming soon */}
            {[
              { name: "Apple Calendar", emoji: "🍎" },
              { name: "Outlook Calendar", emoji: "📧" },
            ].map((cal) => (
              <div key={cal.name} className="flex items-center justify-between py-2 px-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-2">
                  <span className="text-base">{cal.emoji}</span>
                  <span className="text-sm text-foreground">{cal.name}</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                  {t("calendar.comingSoon")}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            {t("calendar.syncDesc")}
          </p>
        </div>
      </div>

      {eventFormSheet}
      {calendarPickerSheet}
    </div>
  );
};

export default Calendar;
