import { useEffect, useState } from 'react';

interface Props {
  lockedUntil: Date | string | null;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Open';
  const totalSecs = Math.ceil(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Pure frontend countdown timer driven by `lockedUntil`.
 * No server calls — ticks locally every second.
 */
export function LockCountdown({ lockedUntil }: Props) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!lockedUntil) {
      setRemaining(0);
      return;
    }
    const target = new Date(lockedUntil).getTime();

    function tick() {
      setRemaining(Math.max(0, target - Date.now()));
    }

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = remaining > 0;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: isLocked ? '#FFE0EC' : '#E0F7EC',
        color: isLocked ? '#C73060' : '#1A7A4A',
        border: `1.5px solid ${isLocked ? '#FF6B9D' : '#6BCB77'}`,
      }}
    >
      {isLocked ? '🔒' : '✨'} {formatRemaining(remaining)}
    </span>
  );
}
