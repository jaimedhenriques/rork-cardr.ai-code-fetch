import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { CardrIcon, CardrText } from "@/components/brand/CardrLogo";
import { SignInPage, type Testimonial } from "@/components/ui/sign-in";
import authHero from "@/assets/auth-hero.jpg";

type View = "login" | "signup" | "forgot";

const heroImage = authHero;

const testimonials: Testimonial[] = [
  {
    avatarSrc: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Briana Patton",
    handle: "Head of Sales, Northwind",
    text: "Cardr replaced three apps. Scan a badge, contact is enriched, in my pipeline, synced to HubSpot — before I leave the booth.",
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Bilal Ahmed",
    handle: "Account Executive, Linear",
    text: "The AI notetaker writes my recap, extracts action items, drafts the follow-up. Two hours of admin gone every day.",
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Saman Malik",
    handle: "Partnerships Lead, Notion",
    text: "Best digital business card I've used. Calendar, LinkedIn, booking link — all in one tap. People remember me now.",
  },
];

const Auth = () => {
  const { signIn, signUp, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [reviewerLoading, setReviewerLoading] = useState(false);

  const handleReviewerDemo = async () => {
    setReviewerLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reviewer-demo-bootstrap");
      if (error) throw error;
      const email = (data as { email?: string })?.email ?? "reviewer@cardr.ai";
      const password = (data as { password?: string })?.password ?? "CardrReview!2026";
      const { error: signInErr } = await signIn(email, password);
      if (signInErr) throw signInErr;
      toast.success("Signed in as App Reviewer");
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start demo session";
      toast.error(message);
    } finally {
      setReviewerLoading(false);
    }
  };

  // Resolve where to send the user after successful auth.
  // Honor a "from" path passed via location state (set by ProtectedRoute);
  // never bounce back to /auth itself.
  const fromState = (location.state as { from?: string } | null)?.from;
  const redirectTarget = fromState && !fromState.startsWith("/auth") ? fromState : "/app";

  useEffect(() => {
    if (user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [user, redirectTarget, navigate]);

  if (user) return null;

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || t("auth.googleSignInFailed"));
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate(redirectTarget, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || t("auth.googleSignInFailed"));
    }
    setGoogleLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    setLoading(true);

    if (view === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else {
        toast.success(t("auth.checkResetEmail"));
        setView("login");
      }
      return;
    }

    if (!email || !password) {
      setLoading(false);
      return;
    }
    const { error } =
      view === "signup"
        ? await signUp(email, password)
        : await signIn(email, password);
    setLoading(false);
    if (error) toast.error(error.message);
    else if (view === "signup") toast.success(t("auth.checkConfirmEmail"));
    else navigate(redirectTarget, { replace: true });
  };

  const titles = {
    login: { h: t("auth.welcomeBack"), p: t("auth.signInDesc") },
    signup: { h: t("auth.createAccount"), p: t("auth.signUpDesc") },
    forgot: { h: t("auth.resetPassword"), p: t("auth.resetDesc") },
  };

  const submitLabel =
    view === "forgot"
      ? t("auth.sendResetLink")
      : view === "signup"
      ? t("auth.createAccountBtn")
      : t("auth.signIn");

  return (
    <SignInPage
      key={view}
      title={titles[view].h}
      description={titles[view].p}
      heroImageSrc={heroImage}
      testimonials={testimonials}
      loading={loading}
      googleLoading={googleLoading}
      showPasswordField={view !== "forgot"}
      submitLabel={submitLabel}
      onSignIn={handleSubmit}
      onGoogleSignIn={view === "forgot" ? undefined : handleGoogleSignIn}
      onResetPassword={view === "login" ? () => setView("forgot") : undefined}
      onCreateAccount={
        view === "login" ? () => setView("signup") : view === "signup" ? () => setView("login") : undefined
      }
      topLeft={
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
        >
          <CardrIcon size={32} className="rounded-lg shadow-sm" />
          <span className="font-display font-bold text-base">
            <CardrText />
          </span>
        </button>
      }
      footer={
        <div className="space-y-3">
          {view === "forgot" && (
            <button
              onClick={() => setView("login")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
            >
              <ArrowLeft size={13} /> {t("auth.backToSignIn")}
            </button>
          )}
          {view === "signup" && (
            <p className="text-center text-xs text-muted-foreground">
              {t("auth.hasAccount")}{" "}
              <button
                onClick={() => setView("login")}
                className="text-primary font-semibold hover:underline"
              >
                {t("auth.signIn")}
              </button>
            </p>
          )}
          <button
            onClick={() => navigate("/")}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground font-medium py-2 transition-colors"
          >
            ← {t("auth.continueWithout")}
          </button>
          {view === "login" && (
            <button
              type="button"
              onClick={handleReviewerDemo}
              disabled={reviewerLoading}
              className="w-full text-center text-[11px] text-muted-foreground/80 hover:text-primary font-medium py-1.5 transition-colors disabled:opacity-60"
            >
              {reviewerLoading ? "Preparing demo…" : "App reviewer? Sign in to demo account"}
            </button>
          )}
        </div>
      }
    />
  );
};

export default Auth;
