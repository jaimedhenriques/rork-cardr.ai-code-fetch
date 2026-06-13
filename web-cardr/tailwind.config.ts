import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Apple-style font stacks. The native SF Pro is used on Apple devices,
      // Segoe on Windows, Roboto on Android — Inter is the cross-platform fallback.
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro"',
          '"Helvetica Neue"',
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        display: [
          '"SF Pro Display"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro"',
          '"Helvetica Neue"',
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "ui-monospace",
          '"Menlo"',
          '"Monaco"',
          '"Roboto Mono"',
          "monospace",
        ],
      },
      // Apple-style refined type scale (iOS HIG inspired)
      fontSize: {
        // [size, { lineHeight, letterSpacing }]
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.01em" }],
        xs: ["11px", { lineHeight: "15px", letterSpacing: "0.005em" }],
        sm: ["13px", { lineHeight: "18px", letterSpacing: "-0.003em" }],
        base: ["15px", { lineHeight: "22px", letterSpacing: "-0.011em" }],
        lg: ["17px", { lineHeight: "24px", letterSpacing: "-0.014em" }],
        xl: ["20px", { lineHeight: "26px", letterSpacing: "-0.017em" }],
        "2xl": ["24px", { lineHeight: "30px", letterSpacing: "-0.019em" }],
        "3xl": ["28px", { lineHeight: "34px", letterSpacing: "-0.021em" }],
        "4xl": ["34px", { lineHeight: "40px", letterSpacing: "-0.022em" }],
        "5xl": ["44px", { lineHeight: "50px", letterSpacing: "-0.024em" }],
        "6xl": ["56px", { lineHeight: "60px", letterSpacing: "-0.026em" }],
        "7xl": ["72px", { lineHeight: "76px", letterSpacing: "-0.028em" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          light: "hsl(var(--destructive-light))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          light: "hsl(var(--success-light))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          light: "hsl(var(--warning-light))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background, var(--background)))",
          foreground: "hsl(var(--sidebar-foreground, var(--foreground)))",
          primary: "hsl(var(--sidebar-primary, var(--primary)))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground, var(--primary-foreground)))",
          accent: "hsl(var(--sidebar-accent, var(--accent)))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground, var(--accent-foreground)))",
          border: "hsl(var(--sidebar-border, var(--border)))",
          ring: "hsl(var(--sidebar-ring, var(--ring)))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // iOS-style elevation
        "ios-sm": "0 1px 2px 0 hsl(0 0% 0% / 0.04), 0 1px 3px 0 hsl(0 0% 0% / 0.06)",
        "ios": "0 2px 4px -1px hsl(0 0% 0% / 0.05), 0 4px 12px -2px hsl(0 0% 0% / 0.08)",
        "ios-lg": "0 8px 24px -4px hsl(0 0% 0% / 0.1), 0 16px 40px -8px hsl(0 0% 0% / 0.12)",
        "ios-xl": "0 16px 48px -8px hsl(0 0% 0% / 0.14), 0 32px 80px -16px hsl(0 0% 0% / 0.16)",
        "glow": "0 0 0 1px hsl(var(--primary) / 0.1), 0 8px 32px -4px hsl(var(--primary) / 0.25)",
      },
      backdropBlur: {
        xs: "2px",
        "ios": "20px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(8px)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%, 100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "breathe": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.05)", opacity: "0.85" },
        },
        "wave": {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "accordion-up": "accordion-up 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in": "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-out": "fade-out 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "shimmer": "shimmer 2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "breathe": "breathe 3s ease-in-out infinite",
        "wave-1": "wave 1.2s ease-in-out infinite",
        "wave-2": "wave 1.2s ease-in-out 0.15s infinite",
        "wave-3": "wave 1.2s ease-in-out 0.3s infinite",
        "wave-4": "wave 1.2s ease-in-out 0.45s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
