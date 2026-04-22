import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { economyApi } from '../../api/economyApi';
import { AUTH_DISABLED } from '../../config/devAuth';

const NAV_ITEMS = [
  { to: '/',           label: 'Map',     icon: '🗺️' },
  { to: '/voting',     label: 'Voting',  icon: '🍴' },
  { to: '/shop',       label: 'Shop',    icon: '🛒' },
  { to: '/leaderboard',label: 'Leaders', icon: '🏆' },
  { to: '/profile',    label: 'Profile', icon: '👾', authOnly: true },
] as const;

export function Navbar() {
  const { isAuthenticated, user, logout, token } = useAuth();
  const [points, setPoints] = useState<number | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const refreshPoints = useCallback(async () => {
    if (!token) { setPoints(null); return; }
    try { setPoints(await economyApi.getBalance(token)); }
    catch { setPoints(null); }
  }, [token]);

  useEffect(() => { void refreshPoints(); }, [refreshPoints]);

  useEffect(() => {
    const onBalance = () => void refreshPoints();
    window.addEventListener('feastfite:balance', onBalance);
    return () => window.removeEventListener('feastfite:balance', onBalance);
  }, [refreshPoints]);

  async function handleLogout() {
    await logout();
    if (!AUTH_DISABLED) navigate('/login');
  }

  return (
    <header className="ff-navbar">

      {/* ── Logo ── */}
      <Link to="/" className="ff-navbar-logo">
        <div className="ff-navbar-logo-title">FeastFite</div>
      </Link>

      {/* ── Nav links ── */}
      <nav className="ff-navbar-links">
        {NAV_ITEMS.map((item) => {
          const { to, label, icon } = item;
          if ('authOnly' in item && item.authOnly && !isAuthenticated) return null;
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`ff-navbar-link ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <div className="ff-navbar-link-icon">
                {icon}
              </div>
              <span className="ff-navbar-link-label">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Auth / points ── */}
      <div className="ff-navbar-auth">
        {isAuthenticated ? (
          <>
            {points !== null && (
              <div className="ff-navbar-points">
                <span>🪙</span>
                <span>
                  {points.toLocaleString()} pts
                </span>
              </div>
            )}
            <div className="ff-navbar-user">
              <span>👋</span>
              <span>
                {user?.username}
              </span>
            </div>
            {AUTH_DISABLED ? (
              <span style={{
                color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem', fontWeight: 700,
                background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '8px',
              }}>
                Auth off
              </span>
            ) : (
              <button type="button" onClick={handleLogout} style={ghostBtn}>Logout</button>
            )}
          </>
        ) : (
          <>
            <Link to="/login" style={ghostBtn as React.CSSProperties}>Login</Link>
            <Link to="/register" style={solidBtn as React.CSSProperties}>Sign up</Link>
          </>
        )}
      </div>

      {/* ── Wave bottom ── */}
      <div className="ff-navbar-wave" aria-hidden="true" />
    </header>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: '999px',
  fontSize: '0.84rem',
  fontWeight: 800,
  cursor: 'pointer',
  textDecoration: 'none',
  border: '1px solid rgba(136, 98, 174, 0.45)',
  background: 'linear-gradient(180deg, #faf3ff 0%, #e5d4ff 100%)',
  color: '#41275f',
  boxShadow: '0 2px 6px rgba(108, 71, 147, 0.16)',
  transition: 'filter 150ms ease',
};

const solidBtn: React.CSSProperties = {
  padding: '6px 16px', borderRadius: '999px', fontSize: '0.82rem',
  fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
  border: '2px solid #fff', background: '#fff',
  color: '#A020C8', transition: 'opacity 150ms ease',
};
