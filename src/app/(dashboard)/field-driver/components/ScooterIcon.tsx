export default function ScooterIcon({
  className = 'w-20 h-20',
  color = '#062B6F',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Delivery box */}
      <rect x="8" y="22" width="22" height="18" rx="3" fill={color} opacity="0.9" />
      <rect x="10" y="24" width="18" height="3" rx="1" fill="white" opacity="0.35" />
      {/* Rider body */}
      <circle cx="52" cy="18" r="7" fill={color} />
      {/* Rider helmet highlight */}
      <path
        d="M48 16c1.5-3 6-3.5 8-1.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Torso + arm */}
      <path
        d="M48 25c-2 2-4 8-4 14h6c0-5 2-9 4-12l-6-2z"
        fill={color}
      />
      <path d="M54 28l8 4" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Scooter deck + stem */}
      <path
        d="M28 44h34c2 0 4 2 4 4v2H24v-2c0-2 2-4 4-4z"
        fill={color}
      />
      <path d="M58 30v14" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Handlebars */}
      <path d="M52 30h14" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M66 28v4" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Front wheel */}
      <circle cx="62" cy="56" r="9" fill={color} />
      <circle cx="62" cy="56" r="4.5" fill="white" opacity="0.25" />
      <circle cx="62" cy="56" r="2" fill="white" opacity="0.5" />
      {/* Rear wheel */}
      <circle cx="28" cy="56" r="9" fill={color} />
      <circle cx="28" cy="56" r="4.5" fill="white" opacity="0.25" />
      <circle cx="28" cy="56" r="2" fill="white" opacity="0.5" />
      {/* Mudguard */}
      <path d="M20 50h16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M54 50h16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
