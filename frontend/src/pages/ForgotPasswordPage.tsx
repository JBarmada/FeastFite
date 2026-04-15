import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi';

type Status = 'idle' | 'loading' | 'sent' | 'error';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [focused, setFocused] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      await authApi.forgotPassword(email);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  const cardStyle: React.CSSProperties = {
    width: '100%', maxWidth: '420px',
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    padding: '40px 36px',
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #FDF5FF 0%, #F7EAFF 50%, #FFD6EC 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  };

  const logoBlock = (
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
    </div>
  );

  if (status === 'sent') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          {logoBlock}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📬</div>
            <h2 style={{
              margin: '0 0 8px',
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              fontSize: '1.4rem',
            }}>
              Check your inbox!
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 24px', fontSize: '0.9rem' }}>
              If <strong>{email}</strong> is registered, a reset link is on its way.
            </p>
            <Link to="/login" style={{
              color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem',
            }}>
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {logoBlock}

        <h2 style={{
          margin: '0 0 6px',
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
          fontSize: '1.4rem', textAlign: 'center',
        }}>
          Forgot password?
        </h2>
        <p style={{
          textAlign: 'center', color: 'var(--color-text-secondary)',
          fontSize: '0.875rem', margin: '0 0 24px',
        }}>
          Enter your email and we'll send a reset link.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {status === 'error' && (
            <div style={{
              background: 'var(--color-error-light)',
              border: '1.5px solid var(--color-error)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              color: 'var(--color-error)',
              fontSize: '0.875rem', fontWeight: 600,
            }}>
              ⚠️ Something went wrong. Please try again.
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
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `2px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg)',
                outline: 'none',
                transition: 'border-color var(--transition-fast)',
                boxSizing: 'border-box',
                boxShadow: focused ? '0 0 0 3px var(--color-primary-dim)' : 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              marginTop: '4px',
              width: '100%', padding: '13px',
              background: status === 'loading'
                ? 'var(--color-text-muted)'
                : 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
              color: '#fff', border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem', fontWeight: 800,
              fontFamily: 'var(--font-display)',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              boxShadow: status === 'loading' ? 'none' : 'var(--shadow-glow-primary)',
            }}
          >
            {status === 'loading' ? 'Sending…' : '📨 Send reset link'}
          </button>
        </form>

        <p style={{
          marginTop: '24px', textAlign: 'center',
          fontSize: '0.875rem', color: 'var(--color-text-secondary)',
        }}>
          <Link to="/login" style={{
            color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none',
          }}>
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
