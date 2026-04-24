export type ItemKind = 'shield' | 'ram' | 'boost' | 'coin' | 'magnet' | 'clock';

interface ItemIconProps {
  kind: ItemKind;
  size?: number;
  count?: number;
}

export function ItemIcon({ kind, size = 48, count }: ItemIconProps) {
  const s = size;

  const icons: Record<ItemKind, React.ReactNode> = {
    shield: (
      <g>
        <path
          d={`M ${s / 2} ${s * 0.1} L ${s * 0.85} ${s * 0.25} L ${s * 0.82} ${s * 0.6} Q ${s / 2} ${s * 0.95} ${s * 0.18} ${s * 0.6} L ${s * 0.15} ${s * 0.25} Z`}
          fill="#00C8E0"
          stroke="#00AABF"
          strokeWidth="3"
        />
        <path
          d={`M ${s * 0.35} ${s * 0.48} L ${s * 0.46} ${s * 0.6} L ${s * 0.65} ${s * 0.38}`}
          stroke="white"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    ),
    ram: (
      <g>
        <rect
          x={s * 0.12}
          y={s * 0.35}
          width={s * 0.55}
          height={s * 0.3}
          fill="#8B5A3C"
          stroke="#4A2814"
          strokeWidth="2.5"
          rx="4"
        />
        <ellipse cx={s * 0.75} cy={s / 2} rx={s * 0.18} ry={s * 0.22} fill="#FF3D5A" stroke="#2D1040" strokeWidth="2.5" />
        <circle cx={s * 0.82} cy={s * 0.42} r="3" fill="#FFD600" />
        <path
          d={`M ${s * 0.72} ${s * 0.35} Q ${s * 0.6} ${s * 0.22} ${s * 0.5} ${s * 0.28}`}
          stroke="#4A2814"
          strokeWidth="3"
          fill="none"
        />
      </g>
    ),
    boost: (
      <g>
        <polygon
          points={`${s / 2},${s * 0.1} ${s * 0.62},${s * 0.42} ${s * 0.95},${s * 0.42} ${s * 0.68},${s * 0.62} ${s * 0.78},${s * 0.92} ${s / 2},${s * 0.74} ${s * 0.22},${s * 0.92} ${s * 0.32},${s * 0.62} ${s * 0.05},${s * 0.42} ${s * 0.38},${s * 0.42}`}
          fill="#3DC45A"
          stroke="#2A8A3A"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text
          x={s / 2}
          y={s * 0.62}
          textAnchor="middle"
          fontFamily="'Fredoka One', 'Nunito', sans-serif"
          fontSize={s * 0.32}
          fill="white"
        >
          2×
        </text>
      </g>
    ),
    coin: (
      <g>
        <circle cx={s / 2} cy={s / 2} r={s * 0.4} fill="#FFA800" stroke="#D68A00" strokeWidth="3" />
        <circle cx={s / 2} cy={s / 2} r={s * 0.3} fill="none" stroke="#D68A00" strokeWidth="1.5" />
        <text
          x={s / 2}
          y={s * 0.62}
          textAnchor="middle"
          fontFamily="'Fredoka One', 'Nunito', sans-serif"
          fontSize={s * 0.38}
          fill="#6B3A1F"
        >
          ¢
        </text>
      </g>
    ),
    magnet: (
      <g>
        <path
          d={`M ${s * 0.2} ${s * 0.25} L ${s * 0.2} ${s * 0.65} Q ${s * 0.2} ${s * 0.9} ${s / 2} ${s * 0.9} Q ${s * 0.8} ${s * 0.9} ${s * 0.8} ${s * 0.65} L ${s * 0.8} ${s * 0.25}`}
          stroke="#FF3D5A"
          strokeWidth={s * 0.15}
          fill="none"
          strokeLinecap="round"
        />
        <rect x={s * 0.13} y={s * 0.18} width={s * 0.14} height={s * 0.14} fill="#EFEFEF" stroke="#2D1040" strokeWidth="2" />
        <rect x={s * 0.73} y={s * 0.18} width={s * 0.14} height={s * 0.14} fill="#EFEFEF" stroke="#2D1040" strokeWidth="2" />
      </g>
    ),
    clock: (
      <g>
        <circle cx={s / 2} cy={s * 0.55} r={s * 0.38} fill="white" stroke="#A020C8" strokeWidth="3" />
        <line x1={s / 2} y1={s * 0.55} x2={s / 2} y2={s * 0.3} stroke="#A020C8" strokeWidth="3" strokeLinecap="round" />
        <line x1={s / 2} y1={s * 0.55} x2={s * 0.7} y2={s * 0.6} stroke="#A020C8" strokeWidth="3" strokeLinecap="round" />
        <rect x={s * 0.42} y={s * 0.1} width={s * 0.16} height={s * 0.08} fill="#A020C8" rx="2" />
      </g>
    ),
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        {icons[kind]}
      </svg>
      {typeof count === 'number' && count > 0 && (
        <span
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            minWidth: 15,
            height: 15,
            borderRadius: 999,
            background: '#FF4FA3',
            color: 'white',
            border: '1.5px solid white',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 800,
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
  );
}
