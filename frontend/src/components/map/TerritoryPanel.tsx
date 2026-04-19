import { useEffect, useState } from 'react';
import type { Territory } from '@feastfite/shared';
import { LockCountdown } from './LockCountdown';
import { ClaimButton } from './ClaimButton';
import { ownerColor } from '../../config/mapConfig';
import { profileApi, type TerritoryLeaderboardEntry } from '../../api/profileApi';

interface Props {
  territory: Territory | null;
  onClose: () => void;
  onClaim: (territory: Territory) => void;
  ownerName?: string;
  ownerAvatarUrl?: string;
}

export function TerritoryPanel({
  territory,
  onClose,
  onClaim,
  ownerName,
  ownerAvatarUrl,
}: Props) {
  const [leaderboard, setLeaderboard] = useState<TerritoryLeaderboardEntry[]>([]);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!territory) return;
    setLeaderboard([]);
    setUsernameMap({});
    profileApi.getTerritoryLeaderboard(territory.id)
      .then(async (entries) => {
        setLeaderboard(entries);
        const ids = entries.map((e) => e.userId).filter(Boolean);
        if (ids.length > 0) {
          const map = await profileApi.lookupUsernames(ids).catch(() => ({}));
          setUsernameMap(map);
        }
      })
      .catch(() => { /* non-fatal */ });
  }, [territory?.id]);

  if (!territory) return null;

  const accentColor = ownerColor(territory.ownerId);
  const dishPhotoUrl = territory.dishPhotoKey
    ? `/api/files/${territory.dishPhotoKey}`
    : null;

  const displayOwnerName = ownerName ?? (territory.ownerName ?? (territory.ownerId ? 'Unknown Foodie' : null));

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

      {dishPhotoUrl ? (
        <img
          src={dishPhotoUrl}
          alt={`Dish at ${territory.name}`}
          style={{ width: '100%', height: '150px', objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
              alt={displayOwnerName ?? 'Owner'}
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
            {displayOwnerName ?? 'Unclaimed'}
          </span>
        </div>
      </div>

      {/* Status */}
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
        <LockCountdown lockedUntil={territory.lockedUntil} ownerId={territory.ownerId} />
      </div>

      {/* Claim CTA */}
      <div style={{ padding: '16px' }}>
        <ClaimButton territory={territory} onClaim={onClaim} />
      </div>

      {/* Territory leaderboard */}
      <div style={{ padding: '12px 16px 20px', borderTop: '1px solid #F0E8FF' }}>
        <div style={{ fontSize: '0.72rem', color: '#999', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
          🏆 Top conquerors
        </div>
        {leaderboard.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: '#bbb', margin: 0 }}>No conquests recorded yet</p>
        ) : (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {leaderboard.map((entry) => (
              <li
                key={entry.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 0',
                  fontSize: '0.8rem',
                  borderBottom: '1px dotted #F0E8FF',
                }}
              >
                <span style={{ width: '18px', fontWeight: 700, color: entry.rank === 1 ? '#FFB800' : '#999' }}>
                  {entry.rank === 1 ? '👑' : `#${entry.rank}`}
                </span>
                <span style={{ flex: 1, fontWeight: 600, color: '#2D1B4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {usernameMap[entry.userId] ?? entry.userId.slice(0, 10)}
                </span>
                <span style={{ fontWeight: 700, color: '#A020C8' }}>{entry.winCount}W</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
