interface CandyPatternProps {
  opacity?: number;
  style?: React.CSSProperties;
}

export function CandyPattern({ opacity = 0.35, style }: CandyPatternProps) {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none', ...style }}
    >
      <defs>
        <pattern id="ff-sprinkles" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="12" r="3" fill="#FF4FA3" />
          <rect x="30" y="8" width="3" height="10" fill="#00C8E0" transform="rotate(25 31 13)" />
          <circle cx="48" cy="30" r="2.5" fill="#FFD600" />
          <rect x="12" y="38" width="3" height="10" fill="#3DC45A" transform="rotate(-30 13 43)" />
          <circle cx="42" cy="52" r="2.5" fill="#A020C8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ff-sprinkles)" />
    </svg>
  );
}
