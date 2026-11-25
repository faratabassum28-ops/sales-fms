import React, { useId } from "react";

// Sales FMS mark — three rising bars with a call-signal dot, on a teal tile. Pure SVG.
export default function LeadsLogo({ size = 34, className = "" }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg className={"logo " + className} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Sales FMS">
      <defs>
        <linearGradient id={`sf-bg-${uid}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id={`sf-shine-${uid}`} x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#sf-bg-${uid})`} />
      <rect width="48" height="48" rx="14" fill={`url(#sf-shine-${uid})`} />
      <rect x=".75" y=".75" width="46.5" height="46.5" rx="13.25" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1.5" />
      <rect x="11" y="27" width="6.5" height="10" rx="2" fill="#fff" fillOpacity=".75" />
      <rect x="20.75" y="20" width="6.5" height="17" rx="2" fill="#fff" fillOpacity=".88" />
      <rect x="30.5" y="12" width="6.5" height="25" rx="2" fill="#fff" />
      <circle cx="14.2" cy="18" r="2.6" fill="#fcd34d" />
    </svg>
  );
}
