import { format, isSameDay, isToday, isFuture, isPast, startOfDay } from "date-fns";
import CalendarEventCard, { type CalendarEvent } from "./CalendarEventCard";

interface CalendarListViewProps {
  events: CalendarEvent[];
  timeRange: "day" | "week" | "month" | "year";
  currentDate: Date;
}

const CalendarListView = ({ events, timeRange, currentDate }: CalendarListViewProps) => {
  // Group events by date
  const grouped = events.reduce((acc: Record<string, CalendarEvent[]>, event: CalendarEvent) => {
    const dateKey = format(new Date(event.start_time), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  if (sortedDates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-xs">
        No events for this {timeRange}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedDates.map((dateKey) => {
        const date = new Date(dateKey + "T00:00:00");
        const today = isToday(date);
        return (
          <div key={dateKey}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums ${
                today ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}>
                {today ? "Today" : format(date, "EEE, MMM d")}
              </div>
              {today && (
                <span className="text-[11px] text-muted-foreground">{format(date, "EEEE")}</span>
              )}
            </div>
            <div className="space-y-2">
              {grouped[dateKey].map((event) => (
                <CalendarEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CalendarListView;
