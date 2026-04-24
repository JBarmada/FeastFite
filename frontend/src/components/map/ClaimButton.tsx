import type { Territory } from '@feastfite/shared';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  territory: Territory;
  onClaim: (territory: Territory) => void;
}

export function ClaimButton({ territory, onClaim }: Props) {
  const { user } = useAuth();

  const isOwner = user && territory.ownerId === user.id;
  const isShielded = territory.shieldedUntil && new Date(territory.shieldedUntil) > new Date();

  if (isOwner) {
    return (
      <div className="ff-claim-btn" style={{ opacity: 0.5, cursor: 'default', textAlign: 'center' }}>
        You own this territory
      </div>
    );
  }

  if (isShielded) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #FFF4CC, #FFE566)',
          border: '2px solid #FFD700',
          borderRadius: '12px',
          padding: '10px 16px',
          fontWeight: 800,
          fontSize: '0.85rem',
          color: '#7A5C00',
        }}>
          🛡️ Shielded — challenges blocked
        </div>
        <div style={{ fontSize: '0.72rem', color: '#999', marginTop: '6px' }}>
          Until {new Date(territory.shieldedUntil!).toLocaleString()}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onClaim(territory)}
      className="ff-claim-btn"
    >
      Contest! Upload a better dish!
    </button>
  );
}
