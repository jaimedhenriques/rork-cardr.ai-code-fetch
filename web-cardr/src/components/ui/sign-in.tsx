import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// --- TYPES ---
export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  loading?: boolean;
  googleLoading?: boolean;
  appleLoading?: boolean;
  showPasswordField?: boolean;
  submitLabel?: string;
  footer?: React.ReactNode;
  topLeft?: React.ReactNode;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onAppleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
}

// --- ICONS ---
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.46 7.83 1.3 10.39.86 1.25 1.88 2.66 3.22 2.61 1.29-.05 1.78-.83 3.34-.83 1.55 0 2 .83 3.37.81 1.39-.03 2.27-1.28 3.12-2.54.98-1.46 1.39-2.87 1.41-2.94-.03-.01-2.71-1.04-2.74-4.13zM14.6 4.42c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-3 1.54-.66.76-1.24 1.98-1.08 3.14 1.14.09 2.31-.58 3.02-1.43z" />
  </svg>
);

// --- SUB-COMPONENTS ---
const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-secondary/40 backdrop-blur-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 transition-all">
    {children}
  </div>
);

const TestimonialCard = ({
  testimonial,
  delay,
}: {
  testimonial: Testimonial;
  delay: string;
}) => (
  <div
    className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-4 shadow-lg opacity-0 translate-y-4 scale-95 blur-sm"
    style={{
      animation: `testimonialIn 0.8s ease-out ${delay} forwards`,
    }}
  >
    <div className="flex items-center gap-3">
      <img
        src={testimonial.avatarSrc}
        alt={testimonial.name}
        className="h-10 w-10 rounded-full object-cover"
      />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
        <p className="text-xs text-muted-foreground">{testimonial.handle}</p>
      </div>
    </div>
    <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
      {testimonial.text}
    </p>
  </div>
);

// --- MAIN COMPONENT ---
export const SignInPage: React.FC<SignInPageProps> = ({
  title = <>Welcome back</>,
  description = "Access your account and continue your journey with us",
  heroImageSrc,
  testimonials = [],
  loading = false,
  googleLoading = false,
  appleLoading = false,
  showPasswordField = true,
  submitLabel = "Sign In",
  footer,
  topLeft,
  onSignIn,
  onGoogleSignIn,
  onAppleSignIn,
  onResetPassword,
  onCreateAccount,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-background text-foreground">
      {/* Left column: form */}
      <div className="relative flex items-center justify-center px-6 py-12 sm:px-10">
        {topLeft && <div className="absolute top-6 left-6">{topLeft}</div>}
        <div
          className="w-full max-w-md opacity-0 translate-y-4 blur-sm"
          style={{ animation: "fadeSlideIn 0.7s ease-out 0.1s forwards" }}
        >
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>

          <form onSubmit={onSignIn} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email Address
              </label>
              <GlassInputWrapper>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </GlassInputWrapper>
            </div>

            {showPasswordField && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full bg-transparent px-4 py-3 pr-11 text-sm outline-none placeholder:text-muted-foreground/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>
            )}

            {showPasswordField && (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    name="remember"
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  Keep me signed in
                </label>
                {onResetPassword && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onResetPassword();
                    }}
                    className="text-primary hover:underline transition-colors font-medium"
                  >
                    Reset password
                  </a>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {loading ? "Please wait…" : submitLabel}
            </button>

            {(onGoogleSignIn || onAppleSignIn) && (
              <>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                      Or continue with
                    </span>
                  </div>
                </div>
                {onGoogleSignIn && (
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={googleLoading}
                    className="w-full h-11 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-foreground text-sm font-medium transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
                  >
                    <GoogleIcon />
                    {googleLoading ? "Connecting…" : "Continue with Google"}
                  </button>
                )}
                {onAppleSignIn && (
                  <button
                    type="button"
                    onClick={onAppleSignIn}
                    disabled={appleLoading}
                    className="w-full h-11 mt-2 rounded-xl border border-border bg-foreground text-background text-sm font-medium transition-colors hover:bg-foreground/90 flex items-center justify-center gap-2.5 disabled:opacity-60"
                  >
                    <AppleIcon />
                    {appleLoading ? "Connecting…" : "Continue with Apple"}
                  </button>
                )}
              </>
            )}

            {onCreateAccount && (
              <p className="text-center text-xs text-muted-foreground pt-2">
                New to our platform?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onCreateAccount();
                  }}
                  className="text-primary hover:underline transition-colors font-semibold"
                >
                  Create Account
                </a>
              </p>
            )}
          </form>

          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </div>

      {/* Right column: hero + testimonials */}
      {heroImageSrc && (
        <div className="relative hidden lg:block overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-0 blur-md scale-105"
            style={{
              backgroundImage: `url(${heroImageSrc})`,
              animation: "slideRightIn 1s ease-out 0.2s forwards",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-background/90 via-background/40 to-transparent" />
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-8 right-8 flex flex-col gap-3 max-w-md ml-auto">
              {testimonials[0] && (
                <TestimonialCard testimonial={testimonials[0]} delay="0.5s" />
              )}
              {testimonials[1] && (
                <TestimonialCard testimonial={testimonials[1]} delay="0.7s" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
