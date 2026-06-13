import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ScanLine,
  FileText,
  Mic,
  PenLine,
  Calendar,
  Sparkles,
  Settings as SettingsIcon,
  KanbanSquare,
  Bot,
  BarChart3,
  Phone,
  LogOut,
  Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface CommandAction {
  id: string;
  label: string;
  group: string;
  icon: typeof Search;
  shortcut?: string;
  run: () => void | Promise<void>;
  keywords?: string;
}

/**
 * Global ⌘K command palette. Mounted once in App.tsx (auth-gated routes).
 * Open with ⌘K or Ctrl+K.
 */
const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const navActions: CommandAction[] = [
    { id: "dash", label: "Dashboard", group: "Navigate", icon: LayoutDashboard, run: () => go("/app"), keywords: "home overview" },
    { id: "contacts", label: "Contacts", group: "Navigate", icon: Users, run: () => go("/app/contacts"), keywords: "people leads crm" },
    { id: "pipeline", label: "Pipeline", group: "Navigate", icon: KanbanSquare, run: () => go("/app/pipeline"), keywords: "deals stages kanban" },
    { id: "card", label: "My Card", group: "Navigate", icon: CreditCard, run: () => go("/app/card"), keywords: "digital business card profile" },
    { id: "calendar", label: "Calendar", group: "Navigate", icon: Calendar, run: () => go("/app/calendar"), keywords: "events meetings schedule" },
    { id: "notes", label: "Notes", group: "Navigate", icon: FileText, run: () => go("/app/notes"), keywords: "meeting transcripts" },
    { id: "ai", label: "AI Chat", group: "Navigate", icon: Sparkles, run: () => go("/app/ai"), keywords: "assistant gpt" },
    { id: "agents", label: "AI Agents", group: "Navigate", icon: Bot, run: () => go("/app/agents") },
    { id: "analytics", label: "Analytics", group: "Navigate", icon: BarChart3, run: () => go("/app/analytics") },
    { id: "phone", label: "Phone Dialer", group: "Navigate", icon: Phone, run: () => go("/app/phone") },
    { id: "settings", label: "Settings", group: "Navigate", icon: SettingsIcon, run: () => go("/app/settings") },
  ];

  const quickActions: CommandAction[] = [
    { id: "scan", label: "Scan a business card", group: "Quick actions", icon: ScanLine, run: () => go("/app/scan") },
    { id: "rec", label: "Record a meeting", group: "Quick actions", icon: Mic, run: () => go("/app/notes/record"), shortcut: "R" },
    { id: "write", label: "Write a note", group: "Quick actions", icon: PenLine, run: () => go("/app/notes/new") },
  ];

  const accountActions: CommandAction[] = user
    ? [
        {
          id: "signout",
          label: "Sign out",
          group: "Account",
          icon: LogOut,
          run: async () => {
            setOpen(false);
            try {
              await signOut();
              toast.success("Signed out");
              navigate("/");
            } catch {
              toast.error("Could not sign out");
            }
          },
        },
      ]
    : [];

  const allActions = [...quickActions, ...navActions, ...accountActions];
  const groups = Array.from(new Set(allActions.map((a) => a.group)));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {groups.map((g, gi) => (
          <div key={g}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={g}>
              {allActions
                .filter((a) => a.group === g)
                .map((a) => (
                  <CommandItem key={a.id} value={`${a.label} ${a.keywords ?? ""}`} onSelect={() => a.run()}>
                    <a.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{a.label}</span>
                    {a.shortcut && (
                      <span className="ml-auto text-2xs text-muted-foreground tracking-wider">{a.shortcut}</span>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
