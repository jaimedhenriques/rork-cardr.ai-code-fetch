import { useBranding } from "@/context/BrandingContext";
import { CardrText } from "@/components/brand/CardrLogo";

interface CardScanProLogoProps {
  className?: string;
  /** Kept for backwards-compat; logo is always the compact wordmark now. */
  compact?: boolean;
}

const CardScanProLogo = ({ className = "" }: CardScanProLogoProps) => {
  const { appName, logoUrl } = useBranding();

  if (logoUrl) {
    return (
      <div className={`flex items-center ${className}`.trim()} aria-label={`${appName} logo`}>
        <img src={logoUrl} alt={appName} className="h-8 max-w-[140px] object-contain" />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`.trim()} aria-label={`${appName} logo`}>
      <span className="text-2xl font-display font-bold leading-none tracking-tight text-foreground">
        {appName === "Cardr" ? <CardrText /> : appName}
      </span>
    </div>
  );
};

export default CardScanProLogo;
