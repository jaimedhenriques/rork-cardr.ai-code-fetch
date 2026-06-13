// Official-style "Download on the App Store" badge.
// Uses Apple's correct logo silhouette (NOT the lucide apple-fruit icon).
// Black pill, white text/logo, scales by `size` (height in px).
//
// Apple's brand guidelines REQUIRE using their official badge artwork.
// Reference: https://developer.apple.com/app-store/marketing/guidelines/
import { forwardRef } from "react";

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  /** Height in px (width scales proportionally). Default 44. */
  size?: number;
  /** Render as <span> instead of <a> (when wrapped in a Link). */
  as?: "a" | "span";
}

const AppStoreBadge = forwardRef<HTMLAnchorElement, Props>(
  ({ href = "#", size = 44, as = "a", className = "", ...rest }, ref) => {
    const w = size * 3; // badge aspect ~3:1
    const Tag: any = as;
    return (
      <Tag
        ref={ref}
        href={href}
        aria-label="Download on the App Store"
        className={`inline-flex items-center justify-center rounded-xl transition-transform hover:-translate-y-0.5 ${className}`}
        style={{ height: size, width: w }}
        {...rest}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 120 40"
          height={size}
          width={w}
          role="img"
          aria-hidden="true"
        >
          <rect width="120" height="40" rx="6" fill="#000" />
          <rect
            width="119"
            height="39"
            x="0.5"
            y="0.5"
            rx="5.5"
            fill="none"
            stroke="#A6A6A6"
            strokeWidth="0.5"
          />
          {/* Official Apple logo */}
          <path
            fill="#FFFFFF"
            d="M22.07 20.28c-.03-2.97 2.43-4.4 2.54-4.47-1.39-2.03-3.55-2.31-4.31-2.34-1.83-.19-3.59 1.08-4.52 1.08-.94 0-2.38-1.05-3.92-1.02-2.01.03-3.88 1.18-4.92 2.98-2.1 3.64-.54 9.02 1.51 11.97 1 1.45 2.18 3.06 3.72 3 1.51-.06 2.08-.97 3.9-.97 1.82 0 2.34.97 3.93.94 1.63-.03 2.66-1.45 3.65-2.91 1.15-1.67 1.62-3.28 1.65-3.36-.04-.02-3.17-1.22-3.21-4.84zM19.1 11.69c.83-1 1.39-2.4 1.23-3.78-1.19.05-2.63.79-3.49 1.79-.77.89-1.44 2.31-1.26 3.66 1.33.1 2.69-.67 3.52-1.67z"
          />
          {/* Top small text */}
          <text
            x="34"
            y="16"
            fill="#FFFFFF"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
            fontSize="7"
            fontWeight="400"
          >
            Download on the
          </text>
          {/* Big "App Store" wordmark */}
          <text
            x="34"
            y="30"
            fill="#FFFFFF"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
            fontSize="15"
            fontWeight="600"
            letterSpacing="-0.5"
          >
            App Store
          </text>
        </svg>
      </Tag>
    );
  },
);
AppStoreBadge.displayName = "AppStoreBadge";

export default AppStoreBadge;
