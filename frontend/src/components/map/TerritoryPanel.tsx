import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import { LockCountdown } from './LockCountdown';
import { getPlayerColorByIndex, playerColors } from '../../styles/colors';
import { profileApi, type TerritoryLeaderboardEntry } from '../../api/profileApi';
import { economyApi } from '../../api/economyApi';
import { useAuth } from '../../contexts/AuthContext';
import { AUTH_DISABLED, DEV_USER_ID } from '../../config/devAuth';
import { Panel } from '../ui/Panel';
import { CandyButton } from '../ui/CandyButton';
import { FoodIcon } from '../ui/FoodIcon';
import { Monster } from '../ui/Monster';
import { ItemIcon } from '../ui/ItemIcon';
import type { FoodKind } from '../ui/FoodIcon';
import type { MonsterHat } from '../ui/Monster';

// Deterministic index from user ID
function hashToIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % playerColors.length;
}

const HAT_CYCLE: MonsterHat[] = ['burger', 'donut', 'taco', 'cone', 'sushi', 'ramen'];

function hatForOwner(id: string): MonsterHat {
  return HAT_CYCLE[hashToIndex(id) % HAT_CYCLE.length];
}

const VALID_FOOD_KINDS = new Set<FoodKind>([
  'burger','pizza','ramen','donut','taco','sushi','salad','cookie','chicken','corn','coffee','chickpea',
]);

function asFoodKind(v: string | null | undefined): FoodKind | null {
  if (v && VALID_FOOD_KINDS.has(v as FoodKind)) return v as FoodKind;
  return null;
}

function formatHeldSince(capturedAt: Date | string | null): string {
  if (!capturedAt) return 'held recently';
  const captured = new Date(capturedAt);
  if (Number.isNaN(captured.getTime())) return 'held recently';
  const elapsedMs = Date.now() - captured.getTime();
  if (elapsedMs < 0) return 'held recently';
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(elapsedMs / (1000 * 60)));
    return `held ${mins}m`;
  }
  return `held ${hours}h`;
}

interface Props {
  territory: Territory | null;
  onClose: () => void;
  onClaim: (territory: Territory, intent: 'claim' | 'vote' | 'battering-ram' | 'shield') => void;
  ownerName?: string;
  ownerAvatarUrl?: string;
  isVoting?: boolean;
}

export function TerritoryPanel({ territory, onClose, onClaim, ownerName, isVoting = false }: Props) {
  const { user, token } = useAuth();
  const currentUserId = AUTH_DISABLED ? DEV_USER_ID : (user?.id ?? null);

  const [leaderboard, setLeaderboard] = useState<TerritoryLeaderboardEntry[]>([]);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});
  const [inventory, setInventory] = useState<Record<string, number>>({});

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

  useEffect(() => {
    const authToken = AUTH_DISABLED ? 'dev-bypass-token' : token;
    if (!authToken) { setInventory({}); return; }
    const fetchInventory = () => {
      economyApi.getInventory(authToken)
        .then(({ items }) => {
          const map: Record<string, number> = {};
          for (const row of items) map[row.itemId] = row.quantity;
          setInventory(map);
        })
        .catch(() => setInventory({}));
    };
    fetchInventory();
    window.addEventListener('feastfite:balance', fetchInventory);
    return () => window.removeEventListener('feastfite:balance', fetchInventory);
  }, [territory?.id, token]);

  if (!territory) return null;

  const palette = territory.ownerId
    ? getPlayerColorByIndex(hashToIndex(territory.ownerId))
    : null;
  const panelColor = palette?.solid ?? 'var(--color-primary)';
  const dishKind = asFoodKind(territory.dishPhotoKey ?? null);
  const dishPhotoUrl = territory.dishPhotoKey ? `/api/files/${territory.dishPhotoKey}` : null;
  const displayOwnerName = ownerName ?? territory.ownerName ?? (territory.ownerId ? 'Unknown Foodie' : null);
  const isLocked = !!territory.lockedUntil && new Date(territory.lockedUntil) > new Date();
  const isOwnTerritory = !!currentUserId && territory.ownerId === currentUserId;
  const battRamCount = inventory['battering_ram'] ?? 0;
  const shieldCount = inventory['territory_shield'] ?? 0;

  return (
    <aside
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        width: 280,
        maxHeight: 'calc(100% - 20px)',
        zIndex: 1010,
        overflowY: 'auto',
      }}
    >
      <Panel color={panelColor} pad={14}>
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close panel"
          style={{
            float: 'right',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            fontSize: '1.1rem',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {/* Dish icon + header */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: palette ? palette.fill : 'var(--color-primary-light)',
              display: 'grid',
              placeItems: 'center',
              border: `2px solid ${palette ? palette.solid : 'var(--color-primary)'}`,
              flexShrink: 0,
            }}
          >
            {dishKind ? (
              <FoodIcon kind={dishKind} size={36} />
            ) : dishPhotoUrl ? (
              <img
                src={dishPhotoUrl}
                alt=""
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 12 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--color-primary)' }}>?</span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                color: 'var(--color-text-primary)',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {territory.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--color-text-secondary)',
                marginTop: 3,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {isVoting
                ? '⚡ VOTE ACTIVE'
                : isLocked
                  ? '🔒 LOCKED'
                  : territory.ownerId
                    ? 'HELD BY'
                    : 'UP FOR GRABS'}
            </div>
          </div>
        </div>

        {/* Owner row */}
        {territory.ownerId && palette && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              background: 'var(--color-surface-raised)',
              borderRadius: 10,
              marginBottom: 10,
            }}
          >
            <Monster
              size={36}
              color={palette.solid}
              hat={hatForOwner(territory.ownerId)}
              mood="happy"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayOwnerName}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)' }}>
                ⭐ {formatHeldSince(territory.capturedAt)}
              </div>
            </div>
          </div>
        )}

        {/* Lock countdown */}
        <div style={{ marginBottom: 10 }}>
          <LockCountdown lockedUntil={territory.lockedUntil} ownerId={territory.ownerId} />
        </div>

        {/* CTA */}
        {/* Own territory, not locked: offer shield */}
        {isOwnTerritory && !isLocked && (
          shieldCount > 0 ? (
            <CandyButton
              color="#00C8E0"
              style={{ width: '100%', justifyContent: 'center' }}
              icon={<ItemIcon kind="shield" size={22} />}
              onClick={() => onClaim(territory, 'shield')}
            >
              Apply Shield (×{shieldCount})
            </CandyButton>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '6px 0' }}>
              🛡️ No shields — <Link to="/shop" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>Buy one in the shop</Link>
            </div>
          )
        )}

        {/* Not own territory, not voting, not locked: claim or challenge */}
        {!isOwnTerritory && !isVoting && !isLocked && (
          <CandyButton
            color="var(--color-secondary)"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onClaim(territory, territory.ownerId ? 'vote' : 'claim')}
          >
            {territory.ownerId ? 'Challenge this grub!' : 'Claim this grub!'}
          </CandyButton>
        )}

        {/* Voting in progress */}
        {isVoting && (
          <CandyButton
            color="var(--color-warning)"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onClaim(territory, 'vote')}
          >
            Jump in the vote
          </CandyButton>
        )}

        {/* Locked + not own territory: battering ram */}
        {isLocked && !isOwnTerritory && (
          battRamCount > 0 ? (
            <CandyButton
              color="var(--color-error)"
              style={{ width: '100%', justifyContent: 'center' }}
              icon={<ItemIcon kind="ram" size={22} count={battRamCount} />}
              onClick={() => onClaim(territory, 'battering-ram')}
            >
              Use battering ram (×{battRamCount})
            </CandyButton>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '6px 0' }}>
              🔒 Need a battering ram — <Link to="/shop" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>Buy one in the shop</Link>
            </div>
          )
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              marginTop: 12,
              paddingTop: 10,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}
            >
              🏆 Top conquerors
            </div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {leaderboard.map((entry) => (
                <li
                  key={entry.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 0',
                    fontSize: '0.8rem',
                    borderBottom: '1px dotted var(--color-border)',
                  }}
                >
                  <span style={{ width: 20, fontWeight: 700, color: entry.rank === 1 ? '#FFB800' : 'var(--color-text-muted)' }}>
                    {entry.rank === 1 ? '👑' : `#${entry.rank}`}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {usernameMap[entry.userId] ?? entry.userId.slice(0, 10)}
                  </span>
                  <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.78rem' }}>
                    {entry.winCount}W
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Panel>
    </aside>
  );
}
