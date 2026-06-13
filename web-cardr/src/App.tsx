import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { BrandingProvider } from "@/context/BrandingContext";
import { RecordingProvider } from "@/context/RecordingContext";
import { LanguageProvider } from "@/context/LanguageContext";
import BottomNav from "@/components/BottomNav";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import MyCard from "@/pages/MyCard";
import Contacts from "@/pages/Contacts";
import ContactDetail from "@/pages/ContactDetail";
import Pipeline from "@/pages/Pipeline";
import ScanBadge from "@/pages/ScanBadge";
import Export from "@/pages/Export";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Settings from "@/pages/Settings";
import DeleteAccount from "@/pages/DeleteAccount";
import Pricing from "@/pages/Pricing";
import Notes from "@/pages/Notes";
import NoteDetail from "@/pages/NoteDetail";
import NoteRecord from "@/pages/NoteRecord";
import NoteNew from "@/pages/NoteNew";
import SharedNote from "@/pages/SharedNote";
import PublicCard from "@/pages/PublicCard";
import Widget from "@/pages/Widget";
import NotFound from "@/pages/NotFound";
import AIChat from "@/pages/AIChat";
import Agents from "@/pages/Agents";
import AgentDetail from "@/pages/AgentDetail";
import CalendarPage from "@/pages/Calendar";
import Events from "@/pages/Events";
import EventsDashboard from "@/pages/EventsDashboard";
import EventDetail from "@/pages/EventDetail";
import AdminPanel from "@/pages/AdminPanel";
import CiErrors from "@/pages/CiErrors";
import ResendDomainSettings from "@/pages/ResendDomainSettings";
import JoinOrg from "@/pages/JoinOrg";
import Unsubscribe from "@/pages/Unsubscribe";
import Analytics from "@/pages/Analytics";
import PhoneDialer from "@/pages/PhoneDialer";
import ReferralLanding from "@/pages/ReferralLanding";
import ReferralDashboard from "@/pages/ReferralDashboard";
import LandingPreview from "@/pages/LandingPreview";
import Integrations from "@/pages/Integrations";
import Automations from "@/pages/Automations";
import Install from "@/pages/Install";
import Privacy from "@/pages/Privacy";
import Support from "@/pages/Support";
import IosReceiptSyncMount from "@/components/IosReceiptSyncMount";

import CommandPalette from "@/components/CommandPalette";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import InstallAppPill from "@/components/InstallAppPill";
import NativePaywallGuard from "@/components/NativePaywallGuard";
import NativeRouteGate from "@/components/NativeRouteGate";


const queryClient = new QueryClient();

// Routes that remain flat & public (no auth required, no /app prefix).
// Anything else flat is redirected to /app/<same-path>.
const PUBLIC_FLAT_ROUTES = new Set<string>([
  "/",
  "/auth",
  "/reset-password",
  "/pricing",
  "/widget",
  "/unsubscribe",
  "/install",
  "/privacy",
  "/support",
]);

// Public dynamic prefixes (params) — kept flat for sharing/SEO.
const PUBLIC_DYNAMIC_PREFIXES = ["/card/", "/shared/", "/join/", "/ref/"];

const isPublicFlatPath = (path: string) => {
  if (PUBLIC_FLAT_ROUTES.has(path)) return true;
  return PUBLIC_DYNAMIC_PREFIXES.some((p) => path.startsWith(p));
};

// Catches any legacy flat path (/contacts, /notes/123, etc.) and forwards to /app/<same>.
const LegacyFlatRedirect = () => {
  const location = useLocation();
  if (isPublicFlatPath(location.pathname)) {
    return <NotFound />;
  }
  return (
    <Navigate
      to={`/app${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
};

const wrap = (node: JSX.Element) => <ProtectedRoute>{node}</ProtectedRoute>;

const AppRoutes = () => {
  const location = useLocation();
  const isFullWidth = location.pathname === "/";

  return (
    <AppProvider>
      <RecordingProvider>
        <div className={isFullWidth ? "min-h-screen" : "max-w-lg mx-auto relative min-h-screen"}>
          <IosReceiptSyncMount />
          <NativePaywallGuard>
          <Routes>
            {/* Public marketing + redirects */}
            <Route path="/" element={<LandingPreview />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />
            <Route path="/landing-preview" element={<Navigate to="/" replace />} />
            <Route path="/index" element={<Navigate to="/app" replace />} />

            {/* Public utility routes (no auth) */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/card/:slug" element={<PublicCard />} />
            <Route path="/shared/:token" element={<SharedNote />} />
            <Route path="/widget" element={<Widget />} />
            <Route path="/join/:token" element={<JoinOrg />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/ref/:code" element={<ReferralLanding />} />
            <Route path="/install" element={<Install />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/support" element={<Support />} />

            {/* Authenticated app — nested under /app */}
            <Route path="/app" element={wrap(<Dashboard />)} />
            <Route path="/app/card" element={wrap(<MyCard />)} />
            <Route path="/app/contacts" element={wrap(<Contacts />)} />
            <Route path="/app/contact/:id" element={wrap(<ContactDetail />)} />
            <Route path="/app/pipeline" element={wrap(<NativeRouteGate feature="pipeline" title="Pipeline"><Pipeline /></NativeRouteGate>)} />
            <Route path="/app/scan" element={wrap(<ScanBadge />)} />
            <Route path="/app/export" element={wrap(<Export />)} />
            <Route path="/app/settings" element={wrap(<Settings />)} />
            <Route path="/app/settings/delete-account" element={wrap(<DeleteAccount />)} />
            <Route path="/app/notes" element={wrap(<Notes />)} />
            <Route path="/app/notes/record" element={wrap(<NoteRecord />)} />
            <Route path="/app/notes/new" element={wrap(<NoteNew />)} />
            <Route path="/app/notes/:id" element={wrap(<NoteDetail />)} />
            <Route path="/app/calendar" element={wrap(<CalendarPage />)} />
            <Route path="/app/events" element={wrap(<EventsDashboard />)} />
            <Route path="/app/events/manage" element={wrap(<Events />)} />
            <Route path="/app/events/:eventId" element={wrap(<EventDetail />)} />
            <Route path="/app/ai" element={wrap(<AIChat />)} />
            <Route path="/app/agents" element={wrap(<NativeRouteGate feature="agents" title="AI Agents"><Agents /></NativeRouteGate>)} />
            <Route path="/app/agents/:agentId" element={wrap(<NativeRouteGate feature="agents" title="AI Agents"><AgentDetail /></NativeRouteGate>)} />
            <Route path="/app/admin" element={wrap(<AdminPanel />)} />
            <Route path="/app/admin/email-sender" element={wrap(<ResendDomainSettings />)} />
            <Route path="/app/admin/ci-errors" element={wrap(<CiErrors />)} />
            <Route path="/app/analytics" element={wrap(<NativeRouteGate feature="analytics" title="Analytics"><Analytics /></NativeRouteGate>)} />
            <Route path="/app/phone" element={wrap(<NativeRouteGate feature="twilioDialer" title="Phone Dialer"><PhoneDialer /></NativeRouteGate>)} />
            <Route path="/app/referrals" element={wrap(<ReferralDashboard />)} />
            <Route path="/app/integrations" element={wrap(<NativeRouteGate feature="integrations" title="Integrations"><Integrations /></NativeRouteGate>)} />
            <Route path="/app/automations" element={wrap(<NativeRouteGate feature="automations" title="Automations"><Automations /></NativeRouteGate>)} />

            {/* Legacy flat paths → redirect to /app/<same>. Must be last. */}
            <Route path="*" element={<LegacyFlatRedirect />} />
          </Routes>
          </NativePaywallGuard>
          <BottomNav />
          
          <CommandPalette />
          <OnboardingWalkthrough />
          <InstallAppPill />
        </div>
      </RecordingProvider>
    </AppProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <LanguageProvider>
          <BrandingProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </BrandingProvider>
        </LanguageProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
