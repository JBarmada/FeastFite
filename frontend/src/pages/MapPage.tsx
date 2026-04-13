import type { Territory } from '@feastfite/shared';
import { MapView } from '../components/map/MapView';

export function MapPage() {
  /**
   * Dev C replaces this stub with the actual photo-upload / claim flow.
   * Dev B fires `onClaim`; Dev C provides the implementation.
   */
  function handleClaim(territory: Territory) {
    console.info('[MapPage] claim initiated for territory:', territory.id, territory.name);
    // TODO (Dev C): open upload modal here
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#FFF5FC',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '10px 20px',
          background: 'linear-gradient(90deg, #FF6B9D 0%, #C77DFF 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 2px 8px rgba(199,125,255,0.35)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '1.5rem' }}>🍭</span>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#fff', letterSpacing: '0.04em' }}>
            FeastFite
          </h1>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)' }}>
            Claim your territory. Rule the block.
          </p>
        </div>
      </header>

      {/* Map fills remaining height */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapView onClaim={handleClaim} />
      </div>
    </div>
  );
}
