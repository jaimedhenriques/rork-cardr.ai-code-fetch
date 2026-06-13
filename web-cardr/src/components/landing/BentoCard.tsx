import { motion } from "framer-motion";
import { ReactNode } from "react";

interface BentoCardProps {
  className?: string;
  eyebrow?: string;
  vsLabel?: string;
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
  delay?: number;
}

export const BentoCard = ({
  className = "",
  eyebrow,
  vsLabel,
  title,
  description,
  children,
  delay = 0,
}: BentoCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`group relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl p-6 transition-all hover:border-primary/30 hover:shadow-[0_18px_50px_-18px_hsl(var(--primary)/0.18)] ${className}`}
  >
    {/* Visual layer */}
    {children && (
      <div className="relative mb-5 h-44 overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/60 via-background to-secondary/40 border border-border/50">
        {children}
      </div>
    )}
    {/* Copy */}
    <div className="flex items-center gap-2">
      {eyebrow && (
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </span>
      )}
      {vsLabel && (
        <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          vs {vsLabel}
        </span>
      )}
    </div>
    <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground">{title}</h3>
    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
  </motion.div>
);

export default BentoCard;
