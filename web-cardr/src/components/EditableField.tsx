import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil, type LucideIcon } from "lucide-react";

interface EditableFieldProps {
  icon: LucideIcon;
  iconClassName?: string;
  iconBgClassName?: string;
  label: string;
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
  href?: string;
  onAction?: () => void;
  suffix?: React.ReactNode;
}

const EditableField = ({
  icon: Icon,
  iconClassName = "text-primary",
  iconBgClassName = "bg-primary/10",
  label,
  value,
  placeholder,
  onSave,
  href,
  onAction,
  suffix,
}: EditableFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing, value]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${iconBgClassName} flex items-center justify-center shrink-0`}>
          <Icon size={14} className={iconClassName} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{label}</p>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
            className="w-full text-xs bg-secondary/80 text-foreground rounded-lg px-2 py-1.5 border border-border/60 focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleSave} className="w-6 h-6 rounded-md bg-success/10 flex items-center justify-center hover:bg-success/20 transition-colors">
            <Check size={12} className="text-success" />
          </button>
          <button onClick={handleCancel} className="w-6 h-6 rounded-md bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
            <X size={12} className="text-destructive" />
          </button>
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className={`w-8 h-8 rounded-lg ${iconBgClassName} flex items-center justify-center shrink-0`}>
        <Icon size={14} className={iconClassName} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-xs text-foreground truncate">{value || <span className="text-muted-foreground/50 italic">Not set</span>}</p>
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-3 group">
      {href && value ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
          onClick={onAction ? (e) => { e.preventDefault(); onAction(); } : undefined}
        >
          {content}
        </a>
      ) : (
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {content}
        </div>
      )}
      {suffix}
      <button
        onClick={() => setEditing(true)}
        className="w-6 h-6 rounded-md flex items-center justify-center opacity-40 sm:opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all shrink-0"
      >
        <Pencil size={10} className="text-muted-foreground" />
      </button>
    </div>
  );
};

export default EditableField;
