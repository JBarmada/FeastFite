interface DishPlaceholderProps {
  label?: string;
  radius?: number;
  style?: React.CSSProperties;
}

export function DishPlaceholder({ label = 'dish photo', radius = 14, style }: DishPlaceholderProps) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        background:
          'repeating-linear-gradient(135deg, var(--color-primary-light) 0 12px, var(--color-surface-raised) 12px 24px)',
        border: '2px dashed var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {label}
    </div>
  );
}
