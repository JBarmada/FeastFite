export type FoodKind =
  | 'burger'
  | 'pizza'
  | 'ramen'
  | 'donut'
  | 'taco'
  | 'sushi'
  | 'salad'
  | 'cookie'
  | 'chicken'
  | 'corn'
  | 'coffee'
  | 'chickpea';

interface FoodIconProps {
  kind: FoodKind;
  size?: number;
}

export function FoodIcon({ kind, size = 48 }: FoodIconProps) {
  const s = size;

  const icons: Record<FoodKind, React.ReactNode> = {
    burger: (
      <g>
        <ellipse cx={s / 2} cy={s * 0.32} rx={s * 0.36} ry={s * 0.14} fill="#EBB564" />
        <rect x={s * 0.14} y={s * 0.44} width={s * 0.72} height={s * 0.08} fill="#5BAE4F" rx="2" />
        <rect x={s * 0.14} y={s * 0.52} width={s * 0.72} height={s * 0.1} fill="#C8412F" rx="2" />
        <ellipse cx={s / 2} cy={s * 0.72} rx={s * 0.36} ry={s * 0.14} fill="#F4A84A" />
      </g>
    ),
    pizza: (
      <g>
        <path d={`M ${s * 0.1} ${s * 0.2} L ${s * 0.9} ${s * 0.2} L ${s / 2} ${s * 0.9} Z`} fill="#F4C96B" />
        <path d={`M ${s * 0.18} ${s * 0.28} L ${s * 0.82} ${s * 0.28} L ${s / 2} ${s * 0.82} Z`} fill="#E85F5C" />
        <circle cx={s * 0.35} cy={s * 0.5} r="4" fill="#F4F1E8" />
        <circle cx={s * 0.6} cy={s * 0.45} r="4" fill="#F4F1E8" />
        <circle cx={s * 0.5} cy={s * 0.65} r="4" fill="#F4F1E8" />
      </g>
    ),
    ramen: (
      <g>
        <ellipse cx={s / 2} cy={s * 0.6} rx={s * 0.42} ry={s * 0.28} fill="#C8412F" />
        <ellipse cx={s / 2} cy={s * 0.5} rx={s * 0.38} ry={s * 0.14} fill="#F4C96B" />
        <path
          d={`M ${s * 0.35} ${s * 0.4} Q ${s / 2} ${s * 0.2} ${s * 0.65} ${s * 0.4}`}
          stroke="#EBB564"
          strokeWidth="2.5"
          fill="none"
        />
        <circle cx={s * 0.42} cy={s * 0.46} r="3" fill="#F4F1E8" />
      </g>
    ),
    donut: (
      <g>
        <circle cx={s / 2} cy={s / 2} r={s * 0.38} fill="#F7C8D9" />
        <circle cx={s / 2} cy={s / 2} r={s * 0.12} fill="#FDF5FF" />
        <rect
          x={s * 0.3}
          y={s * 0.2}
          width="3"
          height="6"
          fill="#FFD600"
          transform={`rotate(-20 ${s * 0.3} ${s * 0.23})`}
        />
        <rect x={s * 0.6} y={s * 0.25} width="3" height="6" fill="#3DC45A" />
        <rect
          x={s * 0.25}
          y={s * 0.55}
          width="3"
          height="6"
          fill="#00C8E0"
          transform={`rotate(40 ${s * 0.25} ${s * 0.58})`}
        />
      </g>
    ),
    taco: (
      <g>
        <path
          d={`M ${s * 0.1} ${s * 0.6} Q ${s / 2} ${s * 0.15} ${s * 0.9} ${s * 0.6} L ${s * 0.86} ${s * 0.7} Q ${s / 2} ${s * 0.25} ${s * 0.14} ${s * 0.7} Z`}
          fill="#F4C96B"
        />
        <circle cx={s * 0.38} cy={s * 0.45} r="3.5" fill="#C8412F" />
        <circle cx={s * 0.58} cy={s * 0.38} r="3" fill="#5BAE4F" />
        <circle cx={s * 0.66} cy={s * 0.5} r="2.5" fill="#F4F1E8" />
      </g>
    ),
    sushi: (
      <g>
        <ellipse cx={s / 2} cy={s * 0.55} rx={s * 0.4} ry={s * 0.22} fill="#F4F1E8" />
        <ellipse cx={s / 2} cy={s * 0.4} rx={s * 0.38} ry={s * 0.12} fill="#E85F5C" />
        <rect x={s * 0.1} y={s * 0.48} width={s * 0.8} height={s * 0.08} fill="#2A5A3A" />
      </g>
    ),
    salad: (
      <g>
        <circle cx={s / 2} cy={s * 0.6} r={s * 0.36} fill="#F4F1E8" />
        <ellipse cx={s * 0.35} cy={s * 0.5} rx="8" ry="5" fill="#5BAE4F" />
        <ellipse cx={s * 0.6} cy={s * 0.55} rx="9" ry="4" fill="#7BC86C" />
        <circle cx={s * 0.5} cy={s * 0.66} r="4" fill="#C8412F" />
        <circle cx={s * 0.62} cy={s * 0.7} r="3" fill="#FF7A00" />
      </g>
    ),
    cookie: (
      <g>
        <circle cx={s / 2} cy={s / 2} r={s * 0.38} fill="#C99770" />
        <circle cx={s * 0.4} cy={s * 0.4} r="3" fill="#4A2814" />
        <circle cx={s * 0.6} cy={s * 0.5} r="3" fill="#4A2814" />
        <circle cx={s * 0.45} cy={s * 0.62} r="2.5" fill="#4A2814" />
        <circle cx={s * 0.62} cy={s * 0.35} r="2.5" fill="#4A2814" />
      </g>
    ),
    chicken: (
      <g>
        <ellipse cx={s / 2} cy={s * 0.55} rx={s * 0.36} ry={s * 0.28} fill="#D4833E" />
        <path
          d={`M ${s * 0.4} ${s * 0.3} L ${s / 2} ${s * 0.15} L ${s * 0.6} ${s * 0.3}`}
          stroke="#D4833E"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    ),
    corn: (
      <g>
        <ellipse cx={s / 2} cy={s * 0.55} rx={s * 0.18} ry={s * 0.32} fill="#FFD600" />
        <path d={`M ${s * 0.32} ${s * 0.3} Q ${s * 0.2} ${s * 0.5} ${s * 0.32} ${s * 0.7}`} fill="#5BAE4F" />
        <path d={`M ${s * 0.68} ${s * 0.3} Q ${s * 0.8} ${s * 0.5} ${s * 0.68} ${s * 0.7}`} fill="#5BAE4F" />
      </g>
    ),
    coffee: (
      <g>
        <rect x={s * 0.22} y={s * 0.3} width={s * 0.48} height={s * 0.48} rx="6" fill="#F4F1E8" />
        <rect x={s * 0.26} y={s * 0.38} width={s * 0.4} height={s * 0.32} fill="#6B3A1F" />
        <path
          d={`M ${s * 0.35} ${s * 0.22} Q ${s * 0.4} ${s * 0.1} ${s * 0.45} ${s * 0.22}`}
          stroke="#B89CC8"
          strokeWidth="2"
          fill="none"
        />
        <path
          d={`M ${s * 0.5} ${s * 0.22} Q ${s * 0.55} ${s * 0.1} ${s * 0.6} ${s * 0.22}`}
          stroke="#B89CC8"
          strokeWidth="2"
          fill="none"
        />
      </g>
    ),
    chickpea: (
      <g>
        <circle cx={s * 0.4} cy={s * 0.5} r={s * 0.2} fill="#D9B77A" />
        <circle cx={s * 0.6} cy={s * 0.55} r={s * 0.18} fill="#D9B77A" />
        <circle cx={s * 0.5} cy={s * 0.35} r={s * 0.16} fill="#D9B77A" />
      </g>
    ),
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {icons[kind] ?? icons.burger}
    </svg>
  );
}
