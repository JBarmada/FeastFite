import type { Territory } from '@feastfite/shared';
import { LockCountdown } from './LockCountdown';
import { ClaimButton } from './ClaimButton';
import { ownerColor } from '../../config/mapConfig';

interface Props {
  territory: Territory | null;
  onClose: () => void;
  /** Dev C hooks this to the upload/photo flow */
  onClaim: (territory: Territory) => void;
  /** Resolved display name for the owner — pass from parent after profile lookup */
  ownerName?: string;
  /** URL to the owner's food-monster avatar image */
  ownerAvatarUrl?: string;
}

export function TerritoryPanel({
  territory,
  onClose,
  onClaim,
  ownerName,
  ownerAvatarUrl,
}: Props) {
  if (!territory) return null;

  const accentColor = ownerColor(territory.ownerId);
  const dishPhotoUrl = territory.dishPhotoKey
    ? `/api/files/${territory.dishPhotoKey}` // proxied through Kong → MinIO
    : null;

  return (
    <aside
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '280px',
        height: '100%',
        background: '#FFFAF6',
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflowY: 'auto',
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close panel"
        style={{
          alignSelf: 'flex-end',
          margin: '10px 10px 0 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.2rem',
          color: '#888',
        }}
      >
        ✕
      </button>

      {/* Territory name */}
      <h2
        style={{
          margin: '4px 16px 12px',
          fontSize: '1.1rem',
          fontWeight: 800,
          color: '#2D1B4E',
          lineHeight: 1.2,
        }}
      >
        {territory.name}
      </h2>

      {/* Dish photo */}
      {dishPhotoUrl ? (
        <img
          src={dishPhotoUrl}
          alt={`Dish representing ${territory.name}`}
          style={{
            width: '100%',
            height: '150px',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '150px',
            background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}66)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
          }}
        >
          🍽️
          <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '4px' }}>
            No dish photo yet
          </span>
        </div>
      )}

      {/* Owner row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 16px',
          borderBottom: '1px solid #F0E8FF',
        }}
      >
        {/* Food-monster avatar */}
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: `3px solid ${accentColor}`,
            overflow: 'hidden',
            flexShrink: 0,
            background: '#F8F0FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
          }}
        >
          {ownerAvatarUrl ? (
            <img
              src={ownerAvatarUrl}
              alt={ownerName ?? 'Owner'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            '🐾'
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.7rem', color: '#999', fontWeight: 600, textTransform: 'uppercase' }}>
            Owner
          </span>
          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2D1B4E' }}>
            {ownerName ?? (territory.ownerId ? 'Unknown Foodie' : 'Unclaimed')}
          </span>
        </div>
      </div>

      {/* Lock status */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #F0E8FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.8rem', color: '#777', fontWeight: 600 }}>Status</span>
        <LockCountdown lockedUntil={territory.lockedUntil} />
      </div>

      {/* Claim CTA */}
      <div style={{ padding: '16px' }}>
        <ClaimButton territory={territory} onClaim={onClaim} />
      </div>
    </aside>
  );
}
