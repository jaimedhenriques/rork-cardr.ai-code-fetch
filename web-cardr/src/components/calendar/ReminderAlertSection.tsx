import { useState } from "react";
import { Bell, Mail, Smartphone, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ReminderAlertSectionProps {
  reminderMinutes: number;
  reminderType: string;
  reminderEmail: string;
  onChange: (field: string, value: any) => void;
}

const REMINDER_PRESETS = [
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1 day", value: 1440 },
  { label: "1 week", value: 10080 },
  { label: "1 month", value: 43200 },
];

const ALERT_TYPES = [
  { id: "in_app", label: "In-App", icon: Smartphone, description: "Push notification" },
  { id: "email", label: "Email", icon: Mail, description: "Email reminder" },
  { id: "both", label: "Both", icon: Bell, description: "In-app + email" },
];

const ReminderAlertSection = ({ reminderMinutes, reminderType, reminderEmail, onChange }: ReminderAlertSectionProps) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const isCustom = !REMINDER_PRESETS.some((p) => p.value === reminderMinutes) && reminderMinutes > 0;

  return (
    <div className="rounded-xl bg-secondary/50 border border-border/60 p-3 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Bell size={14} className="text-primary" />
        <span className="text-xs font-semibold text-foreground">Alerts & Reminders</span>
      </div>

      {/* When to remind */}
      <div>
        <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-semibold">Remind me</label>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => { onChange("reminder_minutes", preset.value); setShowCustom(false); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                reminderMinutes === preset.value && !showCustom
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset.label} before
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCustom(!showCustom)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
              showCustom || isCustom
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarClock size={11} /> Custom
          </button>
        </div>
        {(showCustom || isCustom) && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="number"
              placeholder="Minutes"
              value={isCustom && !showCustom ? reminderMinutes : customMinutes}
              onChange={(e) => {
                const val = e.target.value;
                setCustomMinutes(val);
                const num = parseInt(val);
                if (num > 0) onChange("reminder_minutes", num);
              }}
              className="h-8 text-xs w-24"
              min={1}
            />
            <span className="text-[11px] text-muted-foreground">minutes before</span>
          </div>
        )}
      </div>

      {/* How to alert */}
      <div>
        <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-semibold">Alert type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {ALERT_TYPES.map((type) => {
            const Icon = type.icon;
            const selected = reminderType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onChange("reminder_type", type.id)}
                className={`flex flex-col items-center gap-1 py-2 px-2 rounded-lg transition-all ${
                  selected
                    ? "bg-primary/15 border border-primary/30 text-foreground"
                    : "bg-background/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} className={selected ? "text-primary" : ""} />
                <span className="text-[11px] font-semibold">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Email field if email or both selected */}
      {(reminderType === "email" || reminderType === "both") && (
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Reminder email address</label>
          <Input
            type="email"
            placeholder="your@email.com"
            value={reminderEmail}
            onChange={(e) => onChange("reminder_email", e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
};

export default ReminderAlertSection;
