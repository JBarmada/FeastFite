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

export function LeaderboardPage() {
  const [tab, setTab] = useState<'global' | 'weekly' | 'territories'>('global');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeaderboardUser[]>([]);

  // Territories tab
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loadingTerritories, setLoadingTerritories] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [territoryHistory, setTerritoryHistory] = useState<Record<string, ClaimHistoryEntry[]>>({});

  useEffect(() => {
    if (tab !== 'territories') return;
    setLoadingTerritories(true);
    // Fetch territories for the USC Village area
    territoryApi
      .getByBbox([-118.292, 34.019, -118.278, 34.027])
      .then((ts) => setTerritories(ts.filter((t) => t.ownerId)))
      .catch(() => {})
      .finally(() => setLoadingTerritories(false));
  }, [tab]);

  async function expandTerritory(territoryId: string) {
    if (expandedId === territoryId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(territoryId);
    if (!territoryHistory[territoryId]) {
      const hist = await territoryApi.getHistory(territoryId).catch(() => []);
      setTerritoryHistory((prev) => ({ ...prev, [territoryId]: hist }));
    }
  }

  useEffect(() => {
    if (tab === 'territories') return;
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

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
      <Navbar />

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{
          background: '#fff', borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #FF9E5E, #FF5E8E)',
            padding: '30px 20px', textAlign: 'center', color: '#fff',
          }}>
            <h1 style={{ margin: 0, fontSize: '2.5rem' }}>🏆 Wall of Fame</h1>
            <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>Who rules the Village?</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E9ECEF' }}>
            {(['global', 'weekly', 'territories'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '16px 0', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
                  color: tab === t ? '#FF5E8E' : '#ADB5BD',
                  borderBottom: tab === t ? '3px solid #FF5E8E' : '3px solid transparent',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'territories' ? '🗺️ Territories' : t}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ padding: '20px' }}>
            {tab === 'territories' ? (
              loadingTerritories ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#CED4DA' }}>
                  <span style={{ fontSize: '2rem' }}>🗺️</span>
                  <p>Loading territories...</p>
                </div>
              ) : territories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#CED4DA' }}>
                  <span style={{ fontSize: '2rem' }}>👻</span>
                  <p>No conquered territories yet!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {territories.map((territory) => (
                    <TerritoryLeaderboardCard
                      key={territory.id}
                      territory={territory}
                      expanded={expandedId === territory.id}
                      history={territoryHistory[territory.id] ?? null}
                      onExpand={() => void expandTerritory(territory.id)}
                    />
                  ))}
                </div>
              )
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#CED4DA' }}>
                <span style={{ fontSize: '2rem' }}>🍩</span>
                <p>Loading legends...</p>
              </div>
            ) : data.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#CED4DA' }}>
                <span style={{ fontSize: '2rem' }}>👻</span>
                <p>No one found here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.map((user, i) => (
                  <RankRow key={user.userId} rank={i + 1} user={user} tab={tab} />
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

function TerritoryLeaderboardCard({
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
    <div style={{
      border: '1px solid #E9ECEF',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <button
        onClick={onExpand}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px', width: '100%', background: expanded ? '#FFF4E6' : '#fff',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: expanded ? '1px solid #FFD8A8' : 'none',
        }}
      >
        <div style={{ fontSize: '1.5rem' }}>🏴</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#343A40', fontSize: '1rem' }}>{territory.name}</div>
          <div style={{ fontSize: '0.8rem', color: '#868E96' }}>
            👑 {territory.ownerName ?? 'Unknown'}
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: '#ADB5BD' }}>{expanded ? '▲' : '▼'}</div>
      </button>

      {/* Expanded leaderboard */}
      {expanded && (
        <div style={{ padding: '12px 16px', background: '#FAFAFA' }}>
          {history === null ? (
            <p style={{ textAlign: 'center', color: '#CED4DA', margin: 0 }}>Loading…</p>
          ) : history.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#CED4DA', margin: 0 }}>No submissions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map((entry, i) => (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px',
                  background: entry.isWinner ? '#FFF4E6' : '#fff',
                  border: `1px solid ${entry.isWinner ? '#FFD8A8' : '#E9ECEF'}`,
                }}>
                  <div style={{ width: '28px', textAlign: 'center', fontWeight: 800, color: '#FF9E5E', fontSize: '1rem' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#343A40' }}>
                      {entry.claimantName}
                      {entry.isWinner && (
                        <span style={{ marginLeft: '6px', fontSize: '0.68rem', background: '#FFD8A8', color: '#7A4100', padding: '1px 6px', borderRadius: '999px', fontWeight: 800 }}>
                          👑 Owner
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#ADB5BD' }}>
                      {new Date(entry.claimedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#FF9E5E', fontSize: '0.9rem' }}>
                      {entry.avgRating != null ? `⭐ ${entry.avgRating.toFixed(1)}` : '—'}
                    </div>
                    {entry.voteCount > 0 && (
                      <div style={{ fontSize: '0.7rem', color: '#ADB5BD' }}>{entry.voteCount} votes</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RankRow({ rank, user, tab }: { rank: number; user: LeaderboardUser; tab: string }) {
  let rankIcon = `#${rank}`;
  if (rank === 1) rankIcon = '🥇';
  else if (rank === 2) rankIcon = '🥈';
  else if (rank === 3) rankIcon = '🥉';

  const isKing = rank === 1;
  const isTop3 = rank <= 3;

  const scoreLabel = tab === 'territories'
    ? `${user.territoriesCount ?? 0} Territories`
    : `${(user.totalPoints ?? 0).toLocaleString()} pts`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '16px',
      background: isTop3 ? '#FFF4E6' : '#fff',
      border: isTop3 ? '1px solid #FFD8A8' : '1px solid #E9ECEF',
      borderRadius: '12px',
    }}>
      <div style={{ width: '40px', fontSize: isTop3 ? '1.5rem' : '1.2rem', fontWeight: 800, color: '#FF9E5E', textAlign: 'center' }}>
        {rankIcon}
      </div>
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FFE8CC', margin: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
        👾
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#343A40', fontSize: '1.1rem' }}>{user.username}</span>
          {isKing && (
            <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', background: 'linear-gradient(90deg,#FFD700,#FFA500)', color: '#3B1F00', border: '1px solid #FFA500' }}>
              👑 King of the Village
            </span>
          )}
        </div>
        {user.currentStreak ? (
          <div style={{ fontSize: '0.8rem', color: '#FF5E8E', fontWeight: 600 }}>🔥 {user.currentStreak} day streak</div>
        ) : null}
      </div>
      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: tab === 'territories' ? '#A020C8' : '#FF9E5E' }}>
        {scoreLabel}
      </div>
    </div>
  );
}
