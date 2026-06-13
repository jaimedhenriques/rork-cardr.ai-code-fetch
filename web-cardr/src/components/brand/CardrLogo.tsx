interface CardrMarkProps {
  className?: string;
  size?: number;
  /** Color for "Card" — defaults to currentColor */
  textColor?: string;
  /** Color for trailing "r" accent — defaults to hsl(var(--primary)) */
  accentColor?: string;
}

/**
 * Cardr wordmark lockup: "Card" + accented "r".
 * Uses currentColor for "Card" and hsl(var(--primary)) for the trailing "r" by default,
 * so it adapts to dark/light mode automatically.
 */
export const CardrWordmark = ({
  className = "",
  size = 32,
  textColor,
  accentColor,
}: CardrMarkProps) => {
  // Aspect ratio ~ 5.2:1 for "Cardr"
  const width = size * 2.6;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 260 100"
      width={width}
      height={size}
      className={className}
      role="img"
      aria-label="Cardr"
    >
      <text
        x="0"
        y="78"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="96"
        fontWeight="800"
        letterSpacing="-4"
        fill={textColor ?? "currentColor"}
      >
        Card
      </text>
      <text
        x="200"
        y="78"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="96"
        fontWeight="800"
        letterSpacing="-4"
        fill={accentColor ?? "hsl(var(--primary))"}
      >
        r
      </text>
    </svg>
  );
};

/**
 * Cardr icon mark: rounded-square with accented "r".
 * Self-contained (uses gradient), works as app icon / favicon.
 */
export const CardrIcon = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    width={size}
    height={size}
    className={className}
    role="img"
    aria-label="Cardr icon"
  >
    <defs>
      <linearGradient id="cardr-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="hsl(var(--primary))" />
        <stop offset="100%" stopColor="hsl(var(--accent))" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="64" height="64" rx="14" fill="url(#cardr-grad)" />
    <text
      x="32"
      y="48"
      textAnchor="middle"
      fontFamily="Inter, system-ui, -apple-system, sans-serif"
      fontSize="44"
      fontWeight="800"
      letterSpacing="-2"
      fill="hsl(var(--primary-foreground))"
    >
      r
    </text>
  </svg>
);

/**
 * Inline text wordmark: "Card" in current text color + "r" in primary accent.
 * Use inside headings/links so it inherits font-size, weight, and tracking.
 * Pass `accentClassName` to tweak the "r" (e.g. "text-primary font-semibold").
 */
export const CardrText = ({
  className = "",
  accentClassName = "text-primary",
}: {
  className?: string;
  accentClassName?: string;
}) => (
  <span className={className}>
    Card<span className={accentClassName}>r</span>
  </span>
);

export default CardrWordmark;
