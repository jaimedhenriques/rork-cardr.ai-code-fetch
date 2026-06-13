import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Home, Users, FileText, ScanLine, CreditCard, Settings, Sparkles, GitBranch, Download, BarChart3, CalendarDays, Flag, LogIn, LogOut, Building2, MessageCircle, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CardScanProLogo from "@/components/CardScanProLogo";
import FeedbackButton from "@/components/FeedbackButton";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

const menuSections = [
  {
    label: "Main",
    items: [
      { path: "/app", icon: Home, label: "Home" },
      { path: "/app/scan", icon: ScanLine, label: "Scan Badge" },
      { path: "/app/notes", icon: FileText, label: "Notes" },
      { path: "/app/ai", icon: Sparkles, label: "AI Chat" },
      { path: "/app/agents", icon: Bot, label: "Agents" },
    ],
  },
  {
    label: "CRM",
    items: [
      { path: "/app/contacts", icon: Users, label: "Contacts" },
      { path: "/app/contacts?tab=pipeline", icon: GitBranch, label: "Leads" },
      { path: "/app/contacts?tab=activity", icon: BarChart3, label: "Activity" },
      { path: "/app/calendar", icon: CalendarDays, label: "Calendar" },
      { path: "/app/events", icon: Flag, label: "Events" },
      { path: "/app/export", icon: Download, label: "Export" },
    ],
  },
  {
    label: "Profile",
    items: [
      { path: "/app/card", icon: CreditCard, label: "My Card" },
      { path: "/app/admin", icon: Building2, label: "Admin Panel" },
      { path: "/app/settings", icon: Settings, label: "Settings" },
    ],
  },
];

const AppDrawer = () => {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { profile } = useApp();

  const handleNav = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const isActive = (path: string) => {
    if (path.includes("?")) {
      const [base, query] = path.split("?");
      return location.pathname === base && location.search.includes(query);
    }
    return location.pathname === path;
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={16} className="text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-[70] bg-card border-r border-border/60 flex flex-col"
            >
              <div className="flex items-center justify-between p-5 pb-3 border-b border-border/60">
                <CardScanProLogo compact={false} />
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>

              {/* User info */}
              {user && (
                <div className="px-5 py-3 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.name || "Profile"}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {(user.email?.[0] || "U").toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">{user.email}</p>
                      <p className="text-[10px] text-muted-foreground">Signed in</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto py-3 px-3">
                {menuSections.map((section) => (
                  <div key={section.label} className="mb-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">
                      {section.label}
                    </p>
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNav(item.path)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors mb-0.5 ${
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-secondary"
                          }`}
                        >
                          <item.icon size={16} strokeWidth={active ? 2.5 : 1.8} />
                          <span className={`text-sm ${active ? "font-semibold" : "font-medium"}`}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Bottom section */}
              <div className="px-3 pb-5 pt-2 border-t border-border/60 space-y-0.5">
                <button
                  onClick={() => {
                    setOpen(false);
                    setFeedbackOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-foreground hover:bg-secondary transition-colors"
                >
                  <MessageCircle size={16} strokeWidth={1.8} />
                  <span className="text-sm font-medium">Send Feedback</span>
                </button>

                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut size={16} strokeWidth={1.8} />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleNav("/auth")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-primary hover:bg-primary/10 transition-colors"
                  >
                    <LogIn size={16} strokeWidth={1.8} />
                    <span className="text-sm font-medium">Sign In</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <FeedbackButton externalOpen={feedbackOpen} onExternalClose={() => setFeedbackOpen(false)} />
    </>
  );
};

export default AppDrawer;
