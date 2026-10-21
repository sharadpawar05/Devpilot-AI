import { useId } from 'react';

/**
 * Canonical DevPilot brand mark — a 1:1 match for `public/favicon.svg`
 * (indigo→violet circle, code brackets, pilot arrow). Every brand surface
 * (navbar, sidebar header, loading page) renders this component so the logo
 * can never drift between locations; edit both this file and favicon.svg
 * together when the mark changes.
 */
export function BrandLogo({ className }: { className?: string }) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="DevPilot"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${gradientId})`} />
      {/* Code brackets < /> */}
      <path
        d="M30 35 L20 50 L30 65"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M70 35 L80 50 L70 65"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Center dot / compass point */}
      <circle cx="50" cy="50" r="4" fill="white" />
      {/* Subtle navigation arrow */}
      <path d="M50 38 L54 46 L50 44 L46 46 Z" fill="white" opacity="0.9" />
    </svg>
  );
}
