import { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/layout/Navbar';
import { Monster, type MonsterHat } from '../components/ui/Monster';
import { useAuth } from '../contexts/AuthContext';

const economyClient = axios.create({ baseURL: '/api/economy' });
const authClient    = axios.create({ baseURL: '/api/auth' });
const territoryClient = axios.create({ baseURL: '/api/territory' });

type Tab = 'week' | 'month' | 'alltime';

interface UserRow {
  userId: string;
  totalPoints: number;
  currentStreak?: number;
  username: string;
  blocksHeld: number;
  rankChange: number;
}

const MONSTER_HATS: MonsterHat[] = ['burger', 'donut', 'taco', 'cone', 'sushi', 'ramen'];
const MONSTER_COLORS = ['#FF4FA3', '#A020C8', '#FF9E5E', '#3DC45A', '#00C8E0', '#FFD600', '#FF3D5A', '#6B44DE'];

function monsterProps(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return {
    hat: MONSTER_HATS[h % MONSTER_HATS.length]!,
    color: MONSTER_COLORS[h % MONSTER_COLORS.length]!,
  };
}

const TAB_ENDPOINT: Record<Tab, string> = {
  week:    '/leaderboard/weekly',
  month:   '/leaderboard/monthly',
  alltime: '/leaderboard/global',
};

const TAB_LABELS: Record<Tab, string> = {
  week: 'Week',
  month: 'Month',
  alltime: 'All time',
};

export function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('week');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const [{ data: lb }, { data: ownerData }] = await Promise.all([
          economyClient.get<{ leaderboard: { userId: string; totalPoints: number; currentStreak?: number }[] }>(
            TAB_ENDPOINT[tab],
          ),
          territoryClient.get<{ owners: { userId: string; blocksHeld: number }[] }>('/stats/owners').catch(() => ({ data: { owners: [] } })),
        ]);

        const entries = lb.leaderboard ?? [];
        const ids = entries.map((r) => r.userId).filter(Boolean);

        const usersMap: Record<string, { username: string }> = {};
        if (ids.length > 0) {
          const { data: lookup } = await authClient.get<{
            users: { id: string; username: string; clanId: string | null; clanName: string | null }[];
          }>(`/users/lookup?ids=${ids.join(',')}`).catch(() => ({ data: { users: [] } }));
          for (const u of lookup.users) {
            usersMap[u.id] = { username: u.username };
          }
        }

        const blocksMap: Record<string, number> = {};
        for (const o of ownerData.owners) blocksMap[o.userId] = o.blocksHeld;

        if (!cancelled) {
          setRows(
            entries.map((r) => ({
              ...r,
              username: usersMap[r.userId]?.username ?? `Grub_${r.userId.slice(0, 5)}`,
              blocksHeld: blocksMap[r.userId] ?? 0,
              rankChange: 0,
            })),
          );
        }
      } catch {
        if (!cancelled) setRows([]);
      }
      if (!cancelled) setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [tab]);

  const top3 = rows.slice(0, 3);
  const rest  = rows.slice(3);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px 40px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.72)',
          borderRadius: '24px',
          padding: '28px 24px',
          border: '2px solid rgba(160,80,180,0.12)',
          boxShadow: '0 8px 32px rgba(130,68,89,0.10)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ margin: 0, fontFamily: "'Fredoka One', 'Nunito', sans-serif", fontSize: '1.8rem', color: '#2D1040' }}>
              Top Grubs
            </h1>
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(160,80,180,0.08)', borderRadius: '999px', padding: '4px' }}>
              {(['week', 'month', 'alltime'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '6px 18px',
                    borderRadius: '999px',
                    border: 'none',
                    background: tab === t ? '#A020C8' : 'transparent',
                    color: tab === t ? '#fff' : '#7A5490',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#7A5490' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🍩</div>
              <p style={{ fontWeight: 700, margin: 0 }}>Loading legends…</p>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#7A5490' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>👻</div>
              <p style={{ fontWeight: 700, margin: 0 }}>No grubs ranked yet. Go claim some blocks!</p>
            </div>
          ) : (
            <>
              <PodiumSection top3={top3} currentUserId={user?.id} />
              {rest.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {rest.map((row, i) => (
                    <RankRow key={row.userId} row={row} rank={i + 4} isMe={row.userId === user?.id} />
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

// ── Podium ────────────────────────────────────────────────────────────────────

const PODIUM_ORDER = [1, 0, 2] as const;

const PODIUM_STYLE: Record<number, { bg: string; rankColor: string; rankLabel: string }> = {
  0: {
    bg: 'linear-gradient(160deg, #C060F0 0%, #7B20B0 100%)',
    rankColor: '#FFD600',
    rankLabel: '#1',
  },
  1: {
    bg: 'linear-gradient(160deg, #FF6FA3 0%, #D03870 100%)',
    rankColor: '#fff',
    rankLabel: '#2',
  },
  2: {
    bg: 'linear-gradient(160deg, #FF9E5E 0%, #D06A30 100%)',
    rankColor: '#fff',
    rankLabel: '#3',
  },
};

function PodiumSection({ top3, currentUserId }: { top3: UserRow[]; currentUserId?: string }) {
  if (top3.length === 0) return null;

  const orderedIndices = top3.length >= 3 ? PODIUM_ORDER : ([0, 1, 2].slice(0, top3.length) as number[]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '12px', marginBottom: '28px', padding: '0 8px' }}>
      {orderedIndices.map((idx) => {
        const row = top3[idx];
        if (!row) return null;
        const style = PODIUM_STYLE[idx]!;
        const isFirst = idx === 0;
        const { hat, color } = monsterProps(row.userId);

        return (
          <div key={row.userId} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Monster avatar above card */}
            <div style={{ marginBottom: '-20px', zIndex: 1 }}>
              <Monster size={isFirst ? 72 : 60} hat={hat} color={color} />
            </div>
            <div style={{
              width: '100%',
              background: style.bg,
              borderRadius: '20px',
              padding: isFirst ? '30px 16px 16px' : '26px 12px 14px',
              textAlign: 'center',
              boxShadow: isFirst ? '0 8px 28px rgba(120,30,180,0.30)' : '0 6px 20px rgba(0,0,0,0.12)',
            }}>
              <div style={{ color: style.rankColor, fontFamily: "'Fredoka One', sans-serif", fontSize: isFirst ? '2rem' : '1.6rem', fontWeight: 900, lineHeight: 1 }}>
                {style.rankLabel}
              </div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.88rem', marginTop: '6px', lineHeight: 1.2 }}>
                {row.username}
                {row.userId === currentUserId && (
                  <span style={{ marginLeft: '4px', background: '#FFD600', color: '#2D1040', borderRadius: '4px', fontSize: '0.6rem', padding: '1px 5px', verticalAlign: 'middle', fontWeight: 900 }}>YOU</span>
                )}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', marginTop: '2px' }}>
                {row.totalPoints.toLocaleString()} pts
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Rank row ──────────────────────────────────────────────────────────────────

function RankRow({ row, rank, isMe }: { row: UserRow; rank: number; isMe: boolean }) {
  const { hat, color } = monsterProps(row.userId);
  const change = row.rankChange;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 14px',
      borderRadius: '14px',
      background: isMe ? 'rgba(160,32,200,0.08)' : 'transparent',
      border: isMe ? '1.5px solid rgba(160,32,200,0.18)' : '1.5px solid transparent',
    }}>
      <div style={{ width: '22px', textAlign: 'center', fontWeight: 800, fontSize: '0.88rem', color: '#7A5490', flexShrink: 0 }}>
        {rank}
      </div>
      <Monster size={36} hat={hat} color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#2D1040', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {row.username}
          {isMe && <span style={{ background: '#A020C8', color: '#fff', borderRadius: '4px', fontSize: '0.58rem', padding: '1px 5px', fontWeight: 900 }}>YOU</span>}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9A7AAA', marginTop: '1px' }}>
          {row.blocksHeld} block{row.blocksHeld !== 1 ? 's' : ''} held
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2D1040', flexShrink: 0 }}>
        {row.totalPoints.toLocaleString()}
      </div>
      <div style={{
        width: '28px',
        textAlign: 'right',
        fontWeight: 700,
        fontSize: '0.78rem',
        color: change > 0 ? '#3DC45A' : change < 0 ? '#FF3D5A' : '#9A7AAA',
        flexShrink: 0,
      }}>
        {change > 0 ? `+${change}` : change < 0 ? `${change}` : '0'}
      </div>
    </div>
  );
}

