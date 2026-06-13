// "Get it on Google Play" badge — black pill style matching AppStoreBadge.
// Reference: https://play.google.com/intl/en_us/badges/
import { forwardRef } from "react";

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  size?: number;
  as?: "a" | "span";
}

const GooglePlayBadge = forwardRef<HTMLAnchorElement, Props>(
  ({ href = "#", size = 44, as = "a", className = "", ...rest }, ref) => {
    const w = size * 3.2;
    const Tag: any = as;
    return (
      <Tag
        ref={ref}
        href={href}
        aria-label="Get it on Google Play"
        className={`inline-flex items-center justify-center rounded-xl transition-transform hover:-translate-y-0.5 ${className}`}
        style={{ height: size, width: w }}
        {...rest}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 40" height={size} width={w} role="img" aria-hidden="true">
          <rect width="128" height="40" rx="6" fill="#000" />
          <rect width="127" height="39" x="0.5" y="0.5" rx="5.5" fill="none" stroke="#A6A6A6" strokeWidth="0.5" />
          {/* Play triangle / color shards */}
          <g transform="translate(8 8)">
            <path d="M0 0v24l12-12L0 0z" fill="#EA4335" />
            <path d="M0 0l12 12L18 6 4 -.5 0 0z" fill="#FBBC04" opacity="0" />
            <path d="M0 0l12 12 6-6L4 0H0z" fill="#FBBC04" />
            <path d="M0 24l12-12 6 6-14 6H0z" fill="#34A853" />
            <path d="M12 12l6-6 6 6-6 6-6-6z" fill="#4285F4" />
          </g>
          <text x="38" y="16" fill="#FFFFFF" fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="7" fontWeight="400">
            GET IT ON
          </text>
          <text x="38" y="30" fill="#FFFFFF" fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="15" fontWeight="600" letterSpacing="-0.3">
            Google Play
          </text>
        </svg>
      </Tag>
    );
  },
);
GooglePlayBadge.displayName = "GooglePlayBadge";

export default GooglePlayBadge;
