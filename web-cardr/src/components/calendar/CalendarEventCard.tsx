import { format } from "date-fns";
import { Bot, Clock, MapPin, Video, Users, Pencil, Trash2 } from "lucide-react";

interface CalendarEventCardProps {
  event: any;
  contacts?: { id: string; name: string }[];
  onEdit?: (event: any) => void;
  onDelete?: (eventId: string) => void;
}

const CalendarEventCard = ({ event, contacts = [], onEdit, onDelete }: CalendarEventCardProps) => {
  // Find linked contacts from event_contacts junction (passed via event.linked_contacts)
  const linkedContacts: { id: string; name: string }[] = event.linked_contacts || [];

  return (
    <div
      className="rounded-xl bg-card border border-border/60 p-3 active:scale-[0.98] transition-transform cursor-pointer"
      onClick={() => onEdit?.(event)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">{event.title}</h4>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {event.bot_enabled && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Bot size={10} /> AI
            </span>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
              className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {event.all_day ? "All day" : format(new Date(event.start_time), "h:mm a")}
          {event.end_time && !event.all_day && ` - ${format(new Date(event.end_time), "h:mm a")}`}
        </span>
        {event.location && (
          <span className="flex items-center gap-1"><MapPin size={10} />{event.location}</span>
        )}
        {event.meeting_url && (
          <span className="flex items-center gap-1"><Video size={10} />Virtual</span>
        )}
      </div>
      {linkedContacts.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Users size={10} className="text-muted-foreground" />
          {linkedContacts.map((c) => (
            <span key={c.id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalendarEventCard;
