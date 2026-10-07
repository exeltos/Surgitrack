/** A desktop-style recycle bin: an open mesh bin, with paper in it when something was deleted. */
export default function RecycleBinIcon({full, size = 42}: {full: boolean; size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="recycle-bin-icon">
      <defs>
        <linearGradient id="rb-body" x1="0" x2="1">
          <stop offset="0" stopColor="#dfeef2" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#b9d3db" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      {full && (
        <g>
          <path d="M15 12 l7 -6 l6 5 l-4 6 z" fill="#f4f1e6" stroke="#9fb4bb" strokeWidth="0.8" />
          <path d="M24 11 l9 -4 l3 8 l-9 3 z" fill="#fffdf6" stroke="#9fb4bb" strokeWidth="0.8" />
          <path d="M18 13 l12 1 l-1 6 l-12 -1 z" fill="#e8f3f6" stroke="#9fb4bb" strokeWidth="0.8" />
        </g>
      )}
      <ellipse cx="24" cy="13.5" rx="14" ry="3.6" fill="#7fa3ae" opacity="0.9" />
      <path
        d="M10 13.5 L13.5 41 Q24 45 34.5 41 L38 13.5 Q24 18.5 10 13.5 Z"
        fill="url(#rb-body)"
        stroke="#8fb0ba"
        strokeWidth="1"
      />
      <g stroke="#8aa9b2" strokeWidth="0.9" opacity="0.75">
        <path d="M15.5 17 L17.5 41.5" />
        <path d="M20 17.8 L21 42.6" />
        <path d="M24 18 L24 43" />
        <path d="M28 17.8 L27 42.6" />
        <path d="M32.5 17 L30.5 41.5" />
      </g>
      <ellipse cx="24" cy="13.5" rx="14" ry="3.6" fill="none" stroke="#e9f3f6" strokeWidth="1.2" />
    </svg>
  );
}
