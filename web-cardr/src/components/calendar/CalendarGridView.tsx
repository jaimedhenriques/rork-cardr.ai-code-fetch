import { format, isSameMonth, isSameDay, isToday } from "date-fns";

interface CalendarGridViewProps {
  days: Date[];
  currentMonth: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  eventsForDate: (date: Date) => any[];
}

const CalendarGridView = ({ days, currentMonth, selectedDate, onSelectDate, eventsForDate }: CalendarGridViewProps) => {
  return (
    <>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[11px] font-bold text-muted-foreground uppercase">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const selected = selectedDate && isSameDay(day, selectedDate);
          const hasEvents = eventsForDate(day).length > 0;
          const hasBotEvent = eventsForDate(day).some((e: any) => e.bot_enabled);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`relative aspect-square rounded-xl text-xs font-medium tabular-nums flex flex-col items-center justify-center transition-all ${
                !inMonth ? "text-muted-foreground/30" :
                selected ? "bg-primary text-primary-foreground shadow-md" :
                today ? "bg-primary/10 text-primary ring-1 ring-primary/30" :
                "text-foreground hover:bg-secondary"
              }`}
            >
              {format(day, "d")}
              {hasEvents && (
                <div className="flex gap-0.5 mt-0.5">
                  <div className={`w-1 h-1 rounded-full ${selected ? "bg-primary-foreground" : "bg-primary"}`} />
                  {hasBotEvent && <div className={`w-1 h-1 rounded-full ${selected ? "bg-primary-foreground/60" : "bg-green-500"}`} />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};

export default CalendarGridView;
