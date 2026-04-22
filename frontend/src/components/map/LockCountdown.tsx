import { useEffect, useState } from 'react';

interface Props {
  lockedUntil: Date | string | null;
  ownerId?: string | null;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Conquered';
  const totalSecs = Math.ceil(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function LockCountdown({ lockedUntil, ownerId }: Props) {
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
  const isClaimed = Boolean(ownerId);

  let label: string;
  let bg: string;
  let color: string;
  let border: string;
  let icon: string;

  if (isLocked) {
    label = formatRemaining(remaining);
    bg = '#FFE0EC';
    color = '#C73060';
    border = '#FF6B9D';
    icon = '🔒';
  } else if (isClaimed) {
    label = 'Conquered';
    bg = '#EDE9FE';
    color = '#6D28D9';
    border = '#A78BFA';
    icon = '👑';
  } else {
    label = 'Unclaimed';
    bg = '#E0F7EC';
    color = '#1A7A4A';
    border = '#6BCB77';
    icon = '✨';
  }

  return (
    <span
      className="ff-lock-pill"
      style={{ background: bg, color, borderColor: border }}
    >
      {icon} {label}
    </span>
  );
}
