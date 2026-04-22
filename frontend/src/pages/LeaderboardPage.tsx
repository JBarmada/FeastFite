import { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/layout/Navbar';
import { profileApi } from '../api/profileApi';
import { territoryApi, type ClaimHistoryEntry } from '../api/territoryApi';
import type { Territory } from '@feastfite/shared';

interface LeaderboardUser {
  userId: string;
  totalPoints?: number;
  currentStreak?: number;
  territoriesCount?: number;
  username?: string;
}

const economyClient = axios.create({ baseURL: '/api/economy' });

const PODIUM_STYLES = [
  {
    bg: 'linear-gradient(135deg, #FFE566 0%, #FFB800 80%)',
    border: 'rgba(255,200,0,0.5)',
    trophy: '🥇',
    badge: 'WEEKLY CHAMPION',
    badgeBg: 'rgba(180,100,0,0.15)',
    badgeColor: '#7A4100',
  },
  {
    bg: 'linear-gradient(135deg, #E8E8E8 0%, #BFBFBF 100%)',
    border: 'rgba(160,160,160,0.5)',
    trophy: '🥈',
    badge: 'Silver Spoon',
    badgeBg: 'rgba(100,100,100,0.1)',
    badgeColor: '#555',
  },
  {
    bg: 'linear-gradient(135deg, #EEC88A 0%, #C89050 100%)',
    border: 'rgba(160,110,50,0.5)',
    trophy: '🥉',
    badge: 'Bronze Bite',
    badgeBg: 'rgba(120,70,20,0.12)',
    badgeColor: '#6B3A10',
  },
];

export function LeaderboardPage() {
  const [tab, setTab] = useState<'global' | 'weekly'>('global');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeaderboardUser[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const endpoint = tab === 'weekly' ? '/leaderboard/weekly' : '/leaderboard/global';
        const { data: json } = await economyClient.get<{ leaderboard: { userId: string; totalPoints: number; currentStreak?: number }[] }>(endpoint);
        const rows = json.leaderboard ?? [];
        const ids = rows.map((r) => r.userId).filter(Boolean);
        const usernameMap = ids.length > 0
          ? await profileApi.lookupUsernames(ids).catch(() => ({} as Record<string, string>))
          : {};
        setData(rows.map((r) => ({
          ...r,
          username: usernameMap[r.userId] ?? `Foodie_${r.userId.slice(0, 5)}`,
        })));
      } catch {
        setData([]);
      }
      setLoading(false);
    }
    void fetchData();
  }, [tab]);

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '40px' }}>
        <div className="page-card">

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>🧁🏆</div>
            <h1 style={{
              margin: '12px 0 4px',
              fontFamily: 'var(--font-display)',
              fontSize: '2.2rem',
              color: '#2D1040',
              textShadow: '0 2px 0 rgba(255,255,255,0.6)',
            }}>
              Hall of Fame: Leaders
            </h1>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
            {(['global', 'weekly'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '8px 28px',
                  borderRadius: '999px',
                  border: '2px solid',
                  borderColor: tab === t ? 'transparent' : 'rgba(160,32,200,0.3)',
                  background: tab === t
                    ? 'linear-gradient(135deg, #4DC87A, #2EA85A)'
                    : 'rgba(255,255,255,0.5)',
                  color: tab === t ? '#fff' : '#A020C8',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  boxShadow: tab === t ? '0 4px 14px rgba(61,196,90,0.35)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {t === 'global' ? '🌍 Global' : '📅 Weekly'}
              </button>
            ))}
          </div>

          <h2 style={{
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            color: '#2D1040',
            margin: '0 0 20px',
          }}>
            {tab === 'weekly' ? 'Weekly World Leaders' : 'All-Time Champions'}
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7A5490' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍩</div>
              <p style={{ fontWeight: 700 }}>Loading legends...</p>
            </div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7A5490' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>👻</div>
              <p style={{ fontWeight: 700 }}>No one here yet. Go claim some turf!</p>
            </div>
          ) : (
            <>
              {/* Podium top 3 */}
              {top3.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(top3.length, 3)}, 1fr)`,
                  gap: '14px',
                  marginBottom: '20px',
                }}>
                  {top3.map((user, i) => {
                    const p = PODIUM_STYLES[i]!;
                    const score = tab === 'weekly'
                      ? `${(user.totalPoints ?? 0).toLocaleString()}`
                      : `${(user.totalPoints ?? 0).toLocaleString()}`;
                    return (
                      <div key={user.userId} style={{
                        background: p.bg,
                        border: `2px solid ${p.border}`,
                        borderRadius: '20px',
                        padding: '20px 14px',
                        textAlign: 'center',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                      }}>
                        <div style={{ fontSize: '2.2rem' }}>{p.trophy}</div>
                        <div style={{
                          width: '52px', height: '52px', borderRadius: '50%',
                          background: 'rgba(255,255,255,0.5)',
                          border: '3px solid rgba(255,255,255,0.8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.8rem',
                        }}>
                          👾
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2D1040', lineHeight: 1.2 }}>
                          {user.username}
                        </div>
                        <div style={{
                          background: 'rgba(255,255,255,0.7)',
                          borderRadius: '999px',
                          padding: '4px 14px',
                          fontWeight: 900,
                          fontSize: '1rem',
                          color: '#2D1040',
                          border: '1.5px solid rgba(255,255,255,0.9)',
                        }}>
                          {score}
                        </div>
                        {user.currentStreak ? (
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FF5E00' }}>
                            🔥 {user.currentStreak}d streak
                          </div>
                        ) : null}
                        <div style={{
                          background: p.badgeBg,
                          color: p.badgeColor,
                          borderRadius: '999px',
                          padding: '3px 12px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          border: `1px solid ${p.border}`,
                        }}>
                          {p.badge}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ranks 4+ in 3-column grid */}
              {rest.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '10px',
                }}>
                  {rest.map((user, i) => (
                    <div key={user.userId} style={{
                      background: 'rgba(255,255,255,0.55)',
                      border: '1.5px solid rgba(255,255,255,0.7)',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}>
                      <div style={{
                        width: '28px', textAlign: 'center',
                        fontWeight: 800, fontSize: '0.88rem', color: '#7A5490', flexShrink: 0,
                      }}>
                        {i + 4}
                      </div>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'rgba(160,32,200,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem', flexShrink: 0,
                      }}>
                        👾
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 700, fontSize: '0.85rem', color: '#2D1040',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {user.username}
                        </div>
                        {user.currentStreak ? (
                          <div style={{ fontSize: '0.7rem', color: '#FF5E00', fontWeight: 600 }}>
                            🔥 {user.currentStreak}d
                          </div>
                        ) : null}
                      </div>
                      <div style={{
                        background: 'linear-gradient(135deg, #FFE08A, #FFA800)',
                        borderRadius: '999px',
                        padding: '3px 10px',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        color: '#4a3200',
                        flexShrink: 0,
                      }}>
                        {(user.totalPoints ?? 0).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Keep TerritoryLeaderboardCard for future territories tab re-addition
function _TerritoryLeaderboardCard({
  territory,
  expanded,
  history,
  onExpand,
}: {
  territory: Territory;
  expanded: boolean;
  history: ClaimHistoryEntry[] | null;
  onExpand: () => void;
}) {
  return (
    <div style={{ border: '1.5px solid rgba(255,255,255,0.6)', borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.4)' }}>
      <button
        onClick={onExpand}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 16px', width: '100%',
          background: expanded ? 'rgba(255,244,230,0.8)' : 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ fontSize: '1.4rem' }}>🏴</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#2D1040', fontSize: '0.95rem' }}>{territory.name}</div>
          <div style={{ fontSize: '0.78rem', color: '#7A5490' }}>👑 {territory.ownerName ?? 'Unknown'}</div>
        </div>
        <div style={{ color: '#7A5490' }}>{expanded ? '▲' : '▼'}</div>
      </button>
      {expanded && history && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.3)' }}>
          {history.map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px', borderRadius: '10px', marginBottom: '6px',
              background: entry.isWinner ? 'rgba(255,244,230,0.8)' : 'rgba(255,255,255,0.5)',
            }}>
              <span style={{ fontWeight: 700, width: '24px', textAlign: 'center' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem', color: '#2D1040' }}>
                {entry.claimantName}
              </span>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#FF9E5E' }}>
                {entry.avgRating != null ? `⭐ ${entry.avgRating.toFixed(1)}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
