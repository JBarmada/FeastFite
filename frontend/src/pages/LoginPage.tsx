import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Invalid email or password');
      } else {
        setError('Invalid email or password');
      }
    }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '12px 16px',
    border: `2px solid ${focusedField === field ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-bg)',
    outline: 'none',
    transition: 'border-color var(--transition-fast)',
    boxSizing: 'border-box',
    boxShadow: focusedField === field ? '0 0 0 3px var(--color-primary-dim)' : 'none',
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FDF5FF 0%, #F7EAFF 50%, #FFD6EC 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '3rem', lineHeight: 1 }}>🍭</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem', fontWeight: 900,
            color: 'var(--color-primary)',
            marginTop: '8px', letterSpacing: '0.03em',
          }}>
            FeastFite
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Welcome back, food monster 👋
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Error banner */}
          {error && (
            <div style={{
              background: 'var(--color-error-light)',
              border: '1.5px solid var(--color-error)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              color: 'var(--color-error)',
              fontSize: '0.875rem', fontWeight: 600,
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
              required
              style={inputStyle('email')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Password
              </label>
              <Link to="/forgot-password" style={{
                fontSize: '0.78rem', color: 'var(--color-accent)',
                textDecoration: 'none', fontWeight: 600,
              }}>
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              placeholder="••••••••"
              required
              style={inputStyle('password')}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '4px',
              width: '100%', padding: '13px',
              background: isLoading
                ? 'var(--color-text-muted)'
                : 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
              color: '#fff', border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem', fontWeight: 800,
              fontFamily: 'var(--font-display)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              transition: 'opacity var(--transition-fast)',
              boxShadow: isLoading ? 'none' : 'var(--shadow-glow-primary)',
            }}
          >
            {isLoading ? 'Logging in…' : '⚔️ Enter the Arena'}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          marginTop: '24px', textAlign: 'center',
          fontSize: '0.875rem', color: 'var(--color-text-secondary)',
        }}>
          No account yet?{' '}
          <Link to="/register" style={{
            color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none',
          }}>
            Create one free →
          </Link>
        </p>
      </div>
    </div>
  );
}
