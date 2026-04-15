import { Navbar } from '../components/layout/Navbar';

// Stub — Dev D (Economist) will implement the full shop.
export function ShopPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 'calc(100vh - 56px)',
        gap: '16px', padding: '40px 20px',
      }}>
        <span style={{ fontSize: '4rem' }}>🛒</span>
        <h1 style={{ margin: 0, color: 'var(--color-primary)', fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
          Candy Shop
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center', maxWidth: '360px' }}>
          Spend your points on shields, battering rams, and double-point boosts.
          Coming soon — check back after Dev D ships it!
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
          {[
            { emoji: '🛡️', name: 'Territory Shield', pts: '200 pts', color: 'var(--color-item-shield)' },
            { emoji: '🐏', name: 'Battering Ram',    pts: '500 pts', color: 'var(--color-item-ram)'    },
            { emoji: '⚡', name: 'Double Points',    pts: '100 pts', color: 'var(--color-item-boost)'  },
          ].map((item) => (
            <div key={item.name} style={{
              background: 'var(--color-surface)', border: '2px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)', padding: '20px 24px', textAlign: 'center',
              minWidth: '140px', opacity: 0.6,
            }}>
              <div style={{ fontSize: '2.2rem' }}>{item.emoji}</div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9rem', marginTop: '6px' }}>{item.name}</div>
              <div style={{ color: item.color, fontWeight: 800, fontSize: '0.85rem', marginTop: '4px' }}>{item.pts}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Coming soon</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
