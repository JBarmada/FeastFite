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

export function TerritoryPanel({ territory, onClose, onClaim, ownerName, ownerAvatarUrl }: Props) {
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
      .catch(() => {});
  }, [territory?.id]);

  if (!territory) return null;

  const accentColor = ownerColor(territory.ownerId);
  const dishPhotoUrl = territory.dishPhotoKey ? `/api/files/${territory.dishPhotoKey}` : null;
  const displayOwnerName = ownerName ?? (territory.ownerName ?? (territory.ownerId ? 'Unknown Foodie' : null));
  const topEntry = leaderboard[0];
  const topDishWins = topEntry?.winCount ?? null;

  return (
    <aside className="ff-territory-panel" style={{ borderColor: accentColor }}>
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close panel"
        className="ff-territory-panel-close"
      >
        ✕
      </button>

      {/* Owner avatar + info */}
      <div className="ff-territory-owner">
        <div className="ff-territory-owner-avatar" style={{ borderColor: accentColor }}>
          {ownerAvatarUrl ? (
            <img src={ownerAvatarUrl} alt={displayOwnerName ?? 'Owner'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : '🐾'}
        </div>
        <div>
          <div className="ff-territory-label">Owner</div>
          <div className="ff-territory-owner-name">
            {displayOwnerName ?? 'Unclaimed'}
          </div>
        </div>
      </div>

      {/* Dish photo */}
      {dishPhotoUrl ? (
        <img
          src={dishPhotoUrl}
          alt={`Dish at ${territory.name}`}
          className="ff-territory-photo"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="ff-territory-photo ff-territory-photo-placeholder" style={{ background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}66)` }}>
          🍽️
          <span>No dish photo yet</span>
        </div>
      )}

      {/* Dish info */}
      {topEntry && (
        <div className="ff-territory-dish">
          <div className="ff-territory-dish-title">Top dish spotlight</div>
          {topDishWins !== null && (
            <div className="ff-territory-dish-rating">
              Top Dish Wins: {topDishWins}
            </div>
          )}
        </div>
      )}

      {/* Territory name + points */}
      <div className="ff-territory-meta">
        <div className="ff-territory-name">{territory.name}</div>
        <div className="ff-territory-points">
          Points Generated: <span style={{ color: '#3DC45A', fontWeight: 800 }}>+25/hr</span>
        </div>
      </div>

      {/* Lock status */}
      <div className="ff-territory-lock">
        <LockCountdown lockedUntil={territory.lockedUntil} ownerId={territory.ownerId} />
      </div>

      {/* Claim CTA */}
      <div className="ff-territory-cta">
        <ClaimButton territory={territory} onClaim={onClaim} />
      </div>

      {/* Territory leaderboard */}
      <div className="ff-territory-leaderboard">
        <div className="ff-territory-label" style={{ marginBottom: '8px', letterSpacing: '0.08em' }}>
          🏆 Top conquerors
        </div>
        {leaderboard.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: '#bbb', margin: 0 }}>No conquests recorded yet</p>
        ) : (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {leaderboard.map((entry) => (
              <li key={entry.userId} className="ff-territory-leaderboard-item">
                <span style={{ width: '20px', fontWeight: 700, color: entry.rank === 1 ? '#FFB800' : '#999' }}>
                  {entry.rank === 1 ? '👑' : `#${entry.rank}`}
                </span>
                <span style={{ flex: 1, fontWeight: 600, color: '#2D1B4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {usernameMap[entry.userId] ?? entry.userId.slice(0, 10)}
                </span>
                <span style={{ fontWeight: 800, color: '#A020C8', fontSize: '0.78rem' }}>{entry.winCount}W</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
