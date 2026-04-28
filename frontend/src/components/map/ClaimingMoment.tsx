import { useEffect, useState } from 'react';
import { Monster } from '../ui/Monster';
import type { MonsterHat } from '../ui/Monster';

export interface ClaimData {
  territoryName: string;
  ownerName: string;
  claimedAt: number;
  lockedUntil: number;
  pointsDelta: number;
  newBalance: number;
  streak: number;
  blocksHeld: number;
}

interface ClaimingMomentProps {
  data: ClaimData;
  onDismiss: () => void;
}

const MONSTER_COLORS = ['#A020C8', '#FF4FA3', '#FF9E5E', '#5BAE4F', '#00C8E0', '#F97316'];
const MONSTER_HATS: MonsterHat[] = ['burger', 'donut', 'taco', 'cone', 'sushi', 'ramen'];

function hashUsername(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimeAgo(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')} AGO`;
  return `0:${String(s).padStart(2, '0')} AGO`;
}

export function ClaimingMoment({ data, onDismiss }: ClaimingMomentProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeAgo = now - data.claimedAt;
  const timeUntilLock = data.lockedUntil - now;
  const h = hashUsername(data.ownerName);
  const monsterColor = MONSTER_COLORS[h % MONSTER_COLORS.length];
  const monsterHat = MONSTER_HATS[(h >> 3) % MONSTER_HATS.length];

  const notifications: { icon: string; bg: string; border: string; title: string; sub: string }[] = [
    {
      icon: '✓',
      bg: '#22C55E',
      border: '#16A34A',
      title: 'Territory claimed!',
      sub: `Block captured · +${data.pointsDelta} pts`,
    },
  ];

  if (data.streak > 1) {
    notifications.push({
      icon: '🔥',
      bg: '#F97316',
      border: '#EA580C',
      title: 'Streak extended',
      sub: `${data.streak} days · keep it warm`,
    });
  }

  const MAX_DISPLAY_BLOCKS = 13;
  const blockCount = Math.min(data.blocksHeld, MAX_DISPLAY_BLOCKS);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 900, pointerEvents: 'none' }}>

      {/* Top banner */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'auto',
        background: '#fff',
        border: '2.5px solid #FF4FA3',
        borderRadius: '999px',
        padding: '10px 24px',
        boxShadow: '0 4px 20px rgba(255,79,163,0.2)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF4FA3', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2D1B4E', fontFamily: 'var(--font-display)' }}>
            {data.ownerName} claimed {data.territoryName}!
          </div>
          <div style={{ fontSize: '0.68rem', color: '#FF4FA3', fontWeight: 700, letterSpacing: '0.05em', marginTop: '2px' }}>
            CHANGED HANDS&nbsp;·&nbsp;{formatTimeAgo(timeAgo)}&nbsp;·&nbsp;LOCKS IN {formatCountdown(timeUntilLock)}
          </div>
        </div>
      </div>

      {/* Left notification stack */}
      <div style={{
        position: 'absolute',
        top: '90px',
        left: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'auto',
        maxWidth: '270px',
      }}>
        {notifications.map((n, i) => (
          <div key={i} style={{
            background: '#fff',
            border: `2px solid ${n.border}`,
            borderRadius: '14px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          }}>
            <div style={{
              width: '38px', height: '38px',
              borderRadius: '10px',
              background: n.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
              color: '#fff',
              fontWeight: 800,
              flexShrink: 0,
            }}>
              {n.icon}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#2D1B4E' }}>{n.title}</div>
              <div style={{ fontSize: '0.73rem', color: '#888', marginTop: '2px' }}>{n.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Right player card */}
      <div style={{
        position: 'absolute',
        top: '76px',
        right: '16px',
        background: '#fff',
        border: '2.5px solid #FF4FA3',
        borderRadius: '18px',
        padding: '16px',
        boxShadow: '0 4px 20px rgba(255,79,163,0.15)',
        minWidth: '200px',
        pointerEvents: 'auto',
      }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Monster size={50} color={monsterColor} hat={monsterHat} mood="happy" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2D1B4E' }}>{data.ownerName}</div>
          </div>
        </div>

        {/* Points stat */}
        <div style={{
          background: '#EDE9FF',
          borderRadius: '10px',
          padding: '10px 14px',
          textAlign: 'center',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.06em', marginBottom: '4px' }}>POINTS</div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#7C3AED' }}>+{data.pointsDelta}</div>
          <div style={{ fontSize: '0.72rem', color: '#9061F9', marginTop: '2px' }}>{data.newBalance.toLocaleString()}</div>
        </div>

        <div style={{ borderTop: '1.5px solid #F0E8FF', marginBottom: '12px' }} />

        {/* Blocks held */}
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2D1B4E', marginBottom: '8px' }}>
          Blocks held · {data.blocksHeld}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {Array.from({ length: blockCount }).map((_, i) => (
            <div key={i} style={{
              width: '18px', height: '18px',
              borderRadius: '4px',
              background: i === blockCount - 1 ? monsterColor : '#FFBDBD',
              border: i === blockCount - 1 ? `2px solid ${monsterColor}` : '2px solid transparent',
              boxShadow: i === blockCount - 1 ? `0 0 6px ${monsterColor}60` : undefined,
            }} />
          ))}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          bottom: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #FF4FA3 0%, #A020C8 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '999px',
          padding: '11px 32px',
          fontWeight: 800,
          fontSize: '0.9rem',
          cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(255,79,163,0.35)',
          pointerEvents: 'auto',
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.02em',
        }}
      >
        Back to the candy map
      </button>
    </div>
  );
}
