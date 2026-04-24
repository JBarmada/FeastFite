import { useState } from 'react';
import { shade } from './shade';

type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface CandyButtonProps {
  children: React.ReactNode;
  color?: string;
  size?: ButtonSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

const sizeMap: Record<ButtonSize, { px: number; py: number; fs: number; radius: number; shadow: number }> = {
  sm: { px: 14, py: 8,  fs: 13, radius: 12, shadow: 3 },
  md: { px: 22, py: 12, fs: 15, radius: 16, shadow: 4 },
  lg: { px: 32, py: 16, fs: 19, radius: 20, shadow: 6 },
  xl: { px: 44, py: 20, fs: 24, radius: 24, shadow: 8 },
};

export function CandyButton({
  children,
  color = '#A020C8',
  size = 'md',
  icon,
  disabled = false,
  style,
  onClick,
  type = 'button',
}: CandyButtonProps) {
  const [pressed, setPressed] = useState(false);
  const sz = sizeMap[size];
  const darker = shade(color, -18);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative',
        border: 'none',
        padding: `${sz.py}px ${sz.px}px`,
        borderRadius: sz.radius,
        background: `linear-gradient(180deg, ${color} 0%, ${darker} 100%)`,
        color: 'white',
        fontFamily: "var(--font-display)",
        fontSize: sz.fs,
        letterSpacing: '0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: pressed
          ? 'none'
          : `0 ${sz.shadow}px 0 ${shade(color, -28)}, 0 ${sz.shadow + 4}px 14px rgba(45,16,64,0.2)`,
        textShadow: '0 1px 0 rgba(0,0,0,0.18)',
        WebkitTextStroke: '0.2px rgba(255,255,255,0.3)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transform: pressed ? `translateY(${sz.shadow - 1}px)` : 'translateY(0)',
        transition: 'transform 80ms ease, box-shadow 80ms ease',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
