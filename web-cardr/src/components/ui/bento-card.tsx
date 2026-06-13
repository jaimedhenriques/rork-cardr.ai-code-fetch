import { ReactNode } from "react";
import { motion, MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface BentoCardProps extends MotionProps {
  children: ReactNode;
  className?: string;
  /** Adds gradient glow + hover lift. */
  glow?: boolean;
  /** Adds tilt on hover (3D feel). */
  tilt?: boolean;
  /** Stagger index for entrance animation. */
  index?: number;
  onClick?: () => void;
  /** Background gradient variant. */
  variant?: "default" | "primary" | "accent" | "ghost";
}

const VARIANT_BG = {
  default: "bg-card",
  primary: "bg-gradient-to-br from-primary/12 via-card to-card",
  accent: "bg-gradient-to-br from-accent/12 via-card to-card",
  ghost: "bg-secondary/40",
} as const;

/**
 * Apple iOS Widget-style card.
 * Stagger entrance, optional hover tilt, optional gradient glow, soft shadow.
 */
const BentoCard = ({
  children,
  className,
  glow = false,
  tilt = false,
  index = 0,
  onClick,
  variant = "default",
  ...rest
}: BentoCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
        delay: index * 0.06,
      }}
      whileHover={
        tilt
          ? { y: -3, rotateX: 2, rotateY: -2, scale: 1.005 }
          : { y: -2 }
      }
      whileTap={onClick ? { scale: 0.985 } : undefined}
      onClick={onClick}
      className={cn(
        "relative rounded-3xl border border-border/60 p-5 overflow-hidden transition-shadow duration-300",
        "shadow-ios hover:shadow-ios-lg",
        VARIANT_BG[variant],
        onClick && "cursor-pointer",
        className
      )}
      style={tilt ? { transformStyle: "preserve-3d", perspective: 1000 } : undefined}
      {...rest}
    >
      {glow && (
        <div
          className="absolute -inset-1 opacity-0 blur-2xl transition-opacity duration-500 hover:opacity-100 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
          }}
          aria-hidden
        />
      )}
      <div className="relative">{children}</div>
    </motion.div>
  );
};

export default BentoCard;
