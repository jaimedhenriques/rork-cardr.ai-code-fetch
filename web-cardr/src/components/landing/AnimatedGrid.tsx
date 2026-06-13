export const AnimatedGrid = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* Grid */}
    <div
      className="absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "linear-gradient(hsl(var(--foreground) / 0.08) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.08) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(ellipse at 50% 30%, black 0%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 0%, transparent 75%)",
      }}
    />
    {/* Aurora glows */}
    <div
      className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full blur-3xl opacity-50"
      style={{
        background:
          "radial-gradient(circle, hsl(var(--primary) / 0.35) 0%, hsl(var(--accent) / 0.12) 45%, transparent 75%)",
      }}
    />
    <div
      className="absolute bottom-[-20%] left-[-15%] h-[600px] w-[600px] rounded-full blur-3xl opacity-40"
      style={{
        background:
          "radial-gradient(circle, hsl(var(--accent) / 0.3) 0%, hsl(var(--primary) / 0.1) 50%, transparent 80%)",
      }}
    />
  </div>
);

export default AnimatedGrid;
