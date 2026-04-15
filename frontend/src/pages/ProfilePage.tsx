import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../contexts/AuthContext';

// Stub — Dev E (Profile) will implement the full profile page.
export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 'calc(100vh - 56px)',
        gap: '16px', padding: '40px 20px',
      }}>
        <span style={{ fontSize: '4rem' }}>👾</span>
        <h1 style={{ margin: 0, color: 'var(--color-primary)', fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
          {user?.username ?? 'Food Monster'}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center', maxWidth: '360px' }}>
          Your stats, achievements, and clan — all coming soon.
        </p>

        {/* Placeholder stat cards */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
          {[
            { emoji: '🏆', label: 'Territories', value: '—' },
            { emoji: '⭐', label: 'Points', value: '—' },
            { emoji: '🔥', label: 'Win streak', value: '—' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'var(--color-surface)', border: '2px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)', padding: '20px 28px', textAlign: 'center',
              minWidth: '120px', opacity: 0.6,
            }}>
              <div style={{ fontSize: '2rem' }}>{stat.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--color-text-primary)', marginTop: '4px' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
