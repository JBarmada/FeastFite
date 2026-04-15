import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(email, username, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Registration failed. Please try again.');
      } else {
        setError('Registration failed. Please try again.');
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
            Pick your monster name and enter the battle 🎉
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
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
              placeholder="CandyCrusher99"
              required
              minLength={3}
              maxLength={20}
              style={inputStyle('username')}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              3–20 characters, this is your battle name
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              placeholder="••••••••"
              required
              minLength={8}
              style={inputStyle('password')}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              At least 8 characters
            </span>
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
            {isLoading ? 'Creating account…' : '🍭 Claim your spot'}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          marginTop: '24px', textAlign: 'center',
          fontSize: '0.875rem', color: 'var(--color-text-secondary)',
        }}>
          Already a food monster?{' '}
          <Link to="/login" style={{
            color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none',
          }}>
            Login →
          </Link>
        </p>
      </div>
    </div>
  );
}
