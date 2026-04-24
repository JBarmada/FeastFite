import { shade } from './shade';

interface PanelProps {
  children: React.ReactNode;
  color?: string;
  pad?: number;
  raised?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function Panel({ children, color, pad = 20, raised = true, style, className }: PanelProps) {
  const borderColor = color ?? '#E2C8F0';
  const shadowColor = color ? shade(color, -18) : '#D0B4E0';

  return (
    <div
      className={className}
      style={{
        background: 'var(--color-surface)',
        borderRadius: 24,
        border: `3px solid ${borderColor}`,
        padding: pad,
        boxShadow: raised
          ? `0 6px 0 ${shadowColor}, 0 10px 20px rgba(160,32,200,0.12)`
          : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
