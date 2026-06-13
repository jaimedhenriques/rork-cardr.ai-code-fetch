import { useLocation, useNavigate } from "react-router-dom";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { useLanguage } from "@/context/LanguageContext";

const NAV_LABEL_KEYS: Record<string, string> = {
  home: "nav.home",
  notes: "nav.notes",
  scan: "nav.scan",
  ai: "nav.ai",
  contacts: "nav.contacts",
  calendar: "nav.calendar",
  events: "nav.events",
  pipeline: "nav.pipeline",
  settings: "nav.settings",
  card: "nav.myCard",
  admin: "nav.admin",
};

const HIDDEN_ROUTES = ["/auth", "/reset-password", "/pricing", "/widget", "/shared", "/card/", "/landing", "/ref/"];

const HIDDEN_EXACT = ["/"];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navItems } = useNavPreferences();
  const { t } = useLanguage();

  if (HIDDEN_EXACT.includes(location.pathname)) return null;
  if (HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r))) return null;
  if (location.pathname.startsWith("/notes/")) return null;
  if (location.pathname.startsWith("/contact/")) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
      <div className="glass-card mx-3 mb-[env(safe-area-inset-bottom,6px)] rounded-2xl px-2 py-1.5">
        <div className="flex items-center justify-around">
          {navItems.map((tab) => {
            const isActive =
              tab.path === "/app"
                ? location.pathname === "/app"
                : location.pathname === tab.path || location.pathname.startsWith(tab.path + "/");

            const label = NAV_LABEL_KEYS[tab.id] ? t(NAV_LABEL_KEYS[tab.id]) : tab.label;

            if (tab.center) {
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="relative -mt-5"
                >
                  <div className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isActive
                      ? "bg-primary scale-105"
                      : "bg-primary opacity-85"
                  }`}
                  style={{ width: 52, height: 52, boxShadow: 'var(--shadow-brand)' }}
                  >
                    <tab.icon size={22} strokeWidth={2.2} className="text-primary-foreground" />
                  </div>
                  <span className={`text-[9px] leading-tight block text-center mt-0.5 ${
                    isActive ? "text-primary font-bold" : "text-muted-foreground font-medium"
                  }`}>
                    {label}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[52px] ${
                  isActive ? "bg-primary/10" : "text-muted-foreground"
                }`}
              >
                <tab.icon
                  size={19}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={isActive ? "text-primary" : "text-muted-foreground"}
                />
                <span
                  className={`text-[10px] leading-tight ${
                    isActive ? "text-primary font-bold" : "text-muted-foreground font-medium"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
