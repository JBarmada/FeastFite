import { useId } from 'react';

export type MonsterHat = 'burger' | 'donut' | 'taco' | 'cone' | 'sushi' | 'ramen';
export type MonsterMood = 'happy' | 'fierce' | 'neutral';

interface MonsterProps {
  size?: number;
  color?: string;
  hat?: MonsterHat;
  mood?: MonsterMood;
  style?: React.CSSProperties;
}

export function Monster({
  size = 64,
  color = '#A020C8',
  hat = 'burger',
  mood = 'happy',
  style,
}: MonsterProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `mon-${uid}`;

  const hats: Record<MonsterHat, React.ReactNode> = {
    burger: (
      <g transform={`translate(${size / 2},${size * 0.12})`}>
        <ellipse cx="0" cy="2" rx={size * 0.32} ry={size * 0.08} fill="#F4A84A" />
        <rect x={-size * 0.32} y="-2" width={size * 0.64} height="4" fill="#5BAE4F" />
        <rect x={-size * 0.32} y="-6" width={size * 0.64} height="5" fill="#C8412F" />
        <ellipse cx="0" cy="-10" rx={size * 0.32} ry={size * 0.1} fill="#EBB564" />
        <circle cx={-size * 0.08} cy="-12" r="1.4" fill="#FFE0A6" />
        <circle cx={size * 0.12} cy="-11" r="1.4" fill="#FFE0A6" />
      </g>
    ),
    donut: (
      <g transform={`translate(${size / 2},${size * 0.1})`}>
        <circle cx="0" cy="0" r={size * 0.28} fill="#F7C8D9" />
        <circle cx="0" cy="0" r={size * 0.09} fill="#FDF5FF" />
        <rect x={-size * 0.1} y={-size * 0.22} width="3" height="5" fill="#FFD600" transform="rotate(-20)" />
        <rect x={size * 0.1} y={-size * 0.19} width="3" height="5" fill="#3DC45A" transform="rotate(30)" />
        <rect x={-size * 0.18} y={-size * 0.05} width="3" height="5" fill="#00C8E0" transform="rotate(-70)" />
      </g>
    ),
    taco: (
      <g transform={`translate(${size / 2},${size * 0.1})`}>
        <path
          d={`M ${-size * 0.32} 4 Q 0 ${-size * 0.25} ${size * 0.32} 4 L ${size * 0.3} 6 Q 0 ${-size * 0.2} ${-size * 0.3} 6 Z`}
          fill="#F4C96B"
        />
        <circle cx={-size * 0.12} cy={-size * 0.05} r="2.4" fill="#C8412F" />
        <circle cx={size * 0.06} cy={-size * 0.12} r="2.2" fill="#5BAE4F" />
        <circle cx={size * 0.16} cy={-size * 0.02} r="2" fill="#FFE0A6" />
      </g>
    ),
    cone: (
      <g transform={`translate(${size / 2},${size * 0.08})`}>
        <circle cx="0" cy="-4" r={size * 0.22} fill="#F7A3C8" />
        <circle cx={-size * 0.07} cy={-size * 0.16} r={size * 0.16} fill="#FFD580" />
        <circle cx="0" cy={-size * 0.24} r="2" fill="#C8412F" />
      </g>
    ),
    sushi: (
      <g transform={`translate(${size / 2},${size * 0.1})`}>
        <ellipse cx="0" cy="0" rx={size * 0.3} ry={size * 0.11} fill="#F4F1E8" />
        <ellipse cx="0" cy={-size * 0.05} rx={size * 0.3} ry={size * 0.06} fill="#E85F5C" />
        <rect x={-size * 0.32} y={-size * 0.03} width={size * 0.64} height="4" fill="#2A5A3A" />
      </g>
    ),
    ramen: (
      <g transform={`translate(${size / 2},${size * 0.1})`}>
        <ellipse cx="0" cy="2" rx={size * 0.33} ry={size * 0.11} fill="#C8412F" />
        <ellipse cx="0" cy="-1" rx={size * 0.33} ry={size * 0.09} fill="#F4C96B" />
        <path
          d={`M ${-size * 0.1} -6 Q 0 -12 ${size * 0.1} -6`}
          stroke="#EBB564"
          strokeWidth="2"
          fill="none"
        />
      </g>
    ),
  };

  const mouth =
    mood === 'happy' ? (
      <path
        d={`M ${size * 0.42} ${size * 0.7} Q ${size / 2} ${size * 0.8} ${size * 0.58} ${size * 0.7}`}
        stroke="#2D1040"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    ) : mood === 'fierce' ? (
      <path
        d={`M ${size * 0.42} ${size * 0.74} L ${size * 0.5} ${size * 0.7} L ${size * 0.58} ${size * 0.74}`}
        stroke="#2D1040"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <path
        d={`M ${size * 0.44} ${size * 0.74} L ${size * 0.56} ${size * 0.74}`}
        stroke="#2D1040"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    );

  const bodyPath = `M ${size * 0.15} ${size * 0.55} Q ${size * 0.15} ${size * 0.3} ${size * 0.5} ${size * 0.28} Q ${size * 0.85} ${size * 0.3} ${size * 0.85} ${size * 0.55} Q ${size * 0.85} ${size * 0.9} ${size * 0.5} ${size * 0.92} Q ${size * 0.15} ${size * 0.9} ${size * 0.15} ${size * 0.55} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="60%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={bodyPath} fill={color} />
      <path d={bodyPath} fill={`url(#${gradId})`} />
      <g transform={`translate(${size * 0.38}, ${size * 0.52})`}>
        <circle cx="0" cy="0" r="6" fill="white" />
        <circle cx="1" cy="1" r="3.5" fill="#2D1040" />
        <circle cx="2" cy="-1" r="1.2" fill="white" />
      </g>
      <g transform={`translate(${size * 0.62}, ${size * 0.52})`}>
        <circle cx="0" cy="0" r="6" fill="white" />
        <circle cx="1" cy="1" r="3.5" fill="#2D1040" />
        <circle cx="2" cy="-1" r="1.2" fill="white" />
      </g>
      <ellipse cx={size * 0.3} cy={size * 0.68} rx="3" ry="2" fill="#FF4FA3" opacity="0.5" />
      <ellipse cx={size * 0.7} cy={size * 0.68} rx="3" ry="2" fill="#FF4FA3" opacity="0.5" />
      {mouth}
      <ellipse cx={size * 0.1} cy={size * 0.68} rx="4" ry="6" fill={color} />
      <ellipse cx={size * 0.9} cy={size * 0.68} rx="4" ry="6" fill={color} />
      <ellipse cx={size * 0.35} cy={size * 0.95} rx="5" ry="3" fill={color} />
      <ellipse cx={size * 0.65} cy={size * 0.95} rx="5" ry="3" fill={color} />
      {hats[hat]}
    </svg>
  );
}
