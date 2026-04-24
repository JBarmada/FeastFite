import { ItemIcon } from './ItemIcon';

type PillSize = 'sm' | 'md' | 'lg';

interface CoinPillProps {
  amount: number;
  size?: PillSize;
  style?: React.CSSProperties;
}

const sizeMap: Record<PillSize, { fs: number; pad: string; icon: number }> = {
  sm: { fs: 13, pad: '4px 10px 4px 4px',  icon: 18 },
  md: { fs: 16, pad: '6px 14px 6px 6px',  icon: 24 },
  lg: { fs: 22, pad: '8px 18px 8px 8px',  icon: 32 },
};

export function CoinPill({ amount, size = 'md', style }: CoinPillProps) {
  const sz = sizeMap[size];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'linear-gradient(180deg, #FFE6A8, #FFBE3D)',
        border: '2px solid #D68A00',
        borderRadius: 'var(--radius-full)',
        padding: sz.pad,
        fontFamily: 'var(--font-display)',
        fontSize: sz.fs,
        color: '#6B3A1F',
        boxShadow: 'var(--shadow-candy-coin)',
        ...style,
      }}
    >
      <ItemIcon kind="coin" size={sz.icon} />
      {amount.toLocaleString()}
    </div>
  );
}
