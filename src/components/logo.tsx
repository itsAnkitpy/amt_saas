export function AssetLaneMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="AssetLane logo" className={className}>
      <defs>
        <linearGradient id="al-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#al-mark-bg)" />
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M9 16 V12.5 Q9 9 12.5 9 H16" />
        <path d="M32 9 H35.5 Q39 9 39 12.5 V16" />
        <path d="M39 32 V35.5 Q39 39 35.5 39 H32" />
        <path d="M16 39 H12.5 Q9 39 9 35.5 V32" />
      </g>
      <g fill="#fff">
        <path d="M24 16 L31 20 L24 24 L17 20 Z" />
        <path d="M17 20 L24 24 L24 32 L17 28 Z" fillOpacity="0.78" />
        <path d="M24 24 L31 20 L31 28 L24 32 Z" fillOpacity="0.5" />
      </g>
    </svg>
  );
}
