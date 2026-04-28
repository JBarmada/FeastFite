import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAudio } from '../../contexts/AudioContext';
import { economyApi } from '../../api/economyApi';
import { AUTH_DISABLED } from '../../config/devAuth';
import { CoinPill } from '../ui/CoinPill';
import { ItemIcon } from '../ui/ItemIcon';
import { Monster } from '../ui/Monster';
import { CandyButton } from '../ui/CandyButton';

const NAV_ITEMS = [
  { to: '/',            label: 'Map' },
  { to: '/voting',      label: 'Live votes' },
  { to: '/shop',        label: 'Shop' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/profile',     label: 'My grub', authOnly: true },
] as const;

export function Navbar() {
  const { isAuthenticated, user, logout, token } = useAuth();
  const { isMuted, toggleMute } = useAudio();
  const [points, setPoints] = useState<number | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const refreshPoints = useCallback(async () => {
    if (!token) { setPoints(null); return; }
    try { setPoints(await economyApi.getBalance(token)); }
    catch { setPoints(null); }
  }, [token]);

  useEffect(() => { void refreshPoints(); }, [refreshPoints]);

  const refreshInventory = useCallback(async () => {
    if (!token) { setInventory({}); return; }
    try {
      const data = await economyApi.getInventory(token);
      setInventory(
        Object.fromEntries(data.items.map((item) => [item.itemId, item.quantity])),
      );
    } catch {
      setInventory({});
    }
  }, [token]);

  useEffect(() => { void refreshInventory(); }, [refreshInventory]);

  useEffect(() => {
    const onBalance = () => {
      void refreshPoints();
      void refreshInventory();
    };
    window.addEventListener('feastfite:balance', onBalance);
    return () => window.removeEventListener('feastfite:balance', onBalance);
  }, [refreshPoints, refreshInventory]);

  async function handleLogout() {
    await logout();
    if (!AUTH_DISABLED) navigate('/login');
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'white',
        padding: '10px 18px',
        borderBottom: '3px solid var(--color-primary)',
        boxShadow: '0 4px 0 #7A1A99, 0 8px 16px rgba(160,32,200,0.12)',
        position: 'relative',
        zIndex: 1100,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--color-primary)',
            display: 'grid',
            placeItems: 'center',
            color: 'white',
            fontFamily: 'var(--font-display)',
            fontSize: 22,
          }}
        >
          F
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text-primary)' }}>
          FeastFite
        </span>
      </Link>

      {/* Nav pills */}
      <nav style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'center' }}>
        {NAV_ITEMS.map((item) => {
          if ('authOnly' in item && item.authOnly && !isAuthenticated) return null;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                background: active ? 'var(--color-primary-light)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                textDecoration: 'none',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Mute toggle */}
        <button
          data-no-sfx
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '2px solid var(--color-border)',
            background: isMuted ? '#F3E8FF' : 'white',
            cursor: 'pointer',
            fontSize: 18,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        {isAuthenticated ? (
          <>
            {/* Inventory pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#F3E8FF',
                border: '2px solid #D8B4FE',
                borderRadius: 999,
                padding: '5px 14px',
              }}
            >
              {[
                { kind: 'shield' as const, qty: inventory['territory_shield'] ?? 0 },
                { kind: 'ram' as const,    qty: inventory['battering_ram'] ?? 0 },
                { kind: 'boost' as const,  qty: inventory['double_points'] ?? 0 },
              ].map(({ kind, qty }, i) => (
                <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && (
                    <span style={{ width: 1, height: 18, background: '#D8B4FE', borderRadius: 1, marginRight: 4 }} />
                  )}
                  <ItemIcon kind={kind} size={22} />
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#7C3AED',
                      minWidth: 10,
                    }}
                  >
                    {qty}
                  </span>
                </div>
              ))}
            </div>

            {/* Coins */}
            <CoinPill amount={points ?? 0} size="sm" />

            {/* Monster avatar */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'var(--color-secondary-light)',
                border: '2px solid var(--color-secondary)',
                display: 'grid',
                placeItems: 'center',
              }}
              title={user?.username}
            >
              <Monster size={32} color="var(--color-secondary)" hat="donut" />
            </div>

            {!AUTH_DISABLED && (
              <CandyButton size="sm" color="var(--color-error)" onClick={handleLogout}>
                Logout
              </CandyButton>
            )}
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                border: '2px solid var(--color-border)',
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                color: 'var(--color-text-primary)',
                textDecoration: 'none',
              }}
            >
              Login
            </Link>
            <CandyButton size="sm" color="var(--color-primary)">
              <Link to="/register" style={{ color: 'white', textDecoration: 'none' }}>Sign up</Link>
            </CandyButton>
          </>
        )}
      </div>
    </header>
  );
}
