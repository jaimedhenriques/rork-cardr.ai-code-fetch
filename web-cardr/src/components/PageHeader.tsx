import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import CardScanProLogo from "@/components/CardScanProLogo";
import AppDrawer from "@/components/AppDrawer";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";

interface PageHeaderProps {
  rightContent?: React.ReactNode;
  showFullLogo?: boolean;
  /** Show a back arrow that navigates to the given path (or browser history -1 if true) */
  back?: string | boolean;
  /** Optional page title shown next to the back arrow instead of the logo */
  title?: string;
}

const PageHeader = ({ rightContent, showFullLogo = false, back, title }: PageHeaderProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleBack = () => {
    if (typeof back === "string") {
      navigate(back);
    } else {
      navigate(-1);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out");
      // ProtectedRoute will bounce protected routes back to /auth automatically.
      navigate("/", { replace: true });
    } catch (e) {
      toast.error("Sign out failed");
    }
  };

  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        {back ? (
          <>
            <button
              onClick={handleBack}
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={16} className="text-foreground" />
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="active:scale-95 transition-transform"
              aria-label="Go to landing page"
            >
              <CardScanProLogo compact />
            </button>
            {title && (
              <span className="text-xs font-semibold text-muted-foreground truncate max-w-[140px]">/ {title}</span>
            )}
          </>
        ) : (
          <>
            <AppDrawer />
            <button
              onClick={() => { window.location.href = "/"; }}
              className="active:scale-95 transition-transform"
              aria-label="Go to landing page"
            >
              <CardScanProLogo compact={!showFullLogo} />
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {!back && <NotificationBell />}
        {rightContent}
        {user && (
          <button
            onClick={handleSignOut}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors active:scale-95"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
