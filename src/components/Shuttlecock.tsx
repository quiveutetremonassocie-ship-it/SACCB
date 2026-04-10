export default function Shuttlecock({
  className = "",
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Plumes extérieures */}
      <g fill={color} fillOpacity="0.55" stroke={color} strokeOpacity="0.8" strokeWidth="1.2">
        <path d="M60 95 L20 15 Q22 10 30 12 L62 92 Z" />
        <path d="M60 95 L40 8 Q44 4 52 8 L62 94 Z" />
        <path d="M60 95 L60 5 Q64 2 68 5 L62 95 Z" />
        <path d="M60 95 L80 8 Q84 10 86 16 L62 94 Z" />
        <path d="M60 95 L100 15 Q102 22 98 26 L62 94 Z" />
      </g>
      {/* Lignes de plume */}
      <g stroke={color} strokeOpacity="0.4" strokeWidth="0.8" fill="none">
        <line x1="28" y1="20" x2="55" y2="90" />
        <line x1="45" y1="12" x2="58" y2="90" />
        <line x1="64" y1="10" x2="62" y2="92" />
        <line x1="82" y1="14" x2="64" y2="90" />
        <line x1="97" y1="22" x2="65" y2="90" />
      </g>
      {/* Anneau de liaison */}
      <ellipse cx="60" cy="92" rx="14" ry="4" fill="none" stroke={color} strokeOpacity="0.8" strokeWidth="1.5" />
      <ellipse cx="60" cy="95" rx="14" ry="4" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="1" />
      {/* Bouchon liège */}
      <ellipse cx="60" cy="103" rx="12" ry="10" fill={color} fillOpacity="0.9" />
      <ellipse cx="60" cy="100" rx="12" ry="4" fill={color} />
    </svg>
  );
}
