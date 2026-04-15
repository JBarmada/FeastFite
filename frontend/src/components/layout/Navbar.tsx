import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { economyApi } from '../../api/economyApi';
import { AUTH_DISABLED } from '../../config/devAuth';

export function Navbar() {
  const { isAuthenticated, user, logout, token } = useAuth();
  const [points, setPoints] = useState<number | null>(null);

  const refreshPoints = useCallback(async () => {
    if (!token) {
      setPoints(null);
      return;
    }
    try {
      const bal = await economyApi.getBalance(token);
      setPoints(bal);
    } catch {
      setPoints(null);
    }
  }, [token]);

  useEffect(() => {
    void refreshPoints();
  }, [refreshPoints]);

  useEffect(() => {
    const onBalance = () => void refreshPoints();
    window.addEventListener('feastfite:balance', onBalance);
    return () => window.removeEventListener('feastfite:balance', onBalance);
  }, [refreshPoints]);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function handleLogout() {
    await logout();
    if (!AUTH_DISABLED) {
      navigate('/login');
    }
  }

  const navLink = (to: string, label: string, emoji: string) => {
    const active = pathname === to;
    return (
      <Link to={to} style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '6px 14px', borderRadius: '999px', textDecoration: 'none',
        fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em',
        background: active ? 'rgba(255,255,255,0.30)' : 'transparent',
        color: '#fff',
        transition: 'background 150ms ease',
      }}>
        <span>{emoji}</span>{label}
      </Link>
    );
  };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 'var(--z-panel)' as never,
      background: 'linear-gradient(90deg, #A020C8 0%, #FF4FA3 100%)',
      boxShadow: '0 2px 12px rgba(160,32,200,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: '56px', flexShrink: 0,
    }}>

      {/* ── Logo ── */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
        <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>🍭</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.05rem', lineHeight: 1, letterSpacing: '0.04em' }}>
            FeastFite
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.65rem', lineHeight: 1.2 }}>
            Claim your territory. Rule the block.
          </div>
        </div>
      </Link>

      {/* ── Nav links ── */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {navLink('/', 'Map', '🗺️')}
        {navLink('/voting', 'Voting', '⚔️')}
        {navLink('/shop', 'Shop', '🛒')}
        {isAuthenticated && navLink('/profile', 'Profile', '👾')}
      </nav>

      {/* ── Auth ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {isAuthenticated ? (
          <>
            {points !== null && (
              <span
                title="Candy points"
                style={{
                  color: '#4a3200',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #FFE08A 0%, #FFA800 100%)',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  border: '2px solid rgba(255,255,255,0.5)',
                }}
              >
                🍬 {points.toLocaleString()} pts
              </span>
            )}
            <span style={{
              color: '#fff', fontSize: '0.82rem', fontWeight: 600,
              background: 'rgba(255,255,255,0.2)', padding: '4px 12px',
              borderRadius: '999px',
            }}>
              👋 {user?.username}
            </span>
            {AUTH_DISABLED ? (
              <span
                title="Set AUTH_DISABLED to false in frontend/src/config/devAuth.ts"
                style={{
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: 'rgba(0,0,0,0.2)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                }}
              >
                Auth off
              </span>
            ) : (
              <button type="button" onClick={handleLogout} style={ghostBtn}>
                Logout
              </button>
            )}
          </>
        ) : (
          <>
            <Link to="/login" style={ghostBtn as React.CSSProperties}>Login</Link>
            <Link to="/register" style={solidBtn as React.CSSProperties}>Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: '6px 16px', borderRadius: '999px', fontSize: '0.85rem',
  fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
  border: '2px solid rgba(255,255,255,0.6)', background: 'transparent',
  color: '#fff', transition: 'background 150ms ease',
};

const solidBtn: React.CSSProperties = {
  padding: '6px 16px', borderRadius: '999px', fontSize: '0.85rem',
  fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
  border: '2px solid #fff', background: '#fff',
  color: '#A020C8', transition: 'opacity 150ms ease',
};
