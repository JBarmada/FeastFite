import { useEffect, useMemo, useState } from 'react';
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
  clanId: string | null;
  clanName: string | null;
  blocksHeld: number;
  rankChange: number;
}

interface ClanRow {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  totalPoints: number;
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

        const usersMap: Record<string, { username: string; clanId: string | null; clanName: string | null }> = {};
        if (ids.length > 0) {
          const { data: lookup } = await authClient.get<{
            users: { id: string; username: string; clanId: string | null; clanName: string | null }[];
          }>(`/users/lookup?ids=${ids.join(',')}`).catch(() => ({ data: { users: [] } }));
          for (const u of lookup.users) {
            usersMap[u.id] = { username: u.username, clanId: u.clanId, clanName: u.clanName };
          }
        }

        const blocksMap: Record<string, number> = {};
        for (const o of ownerData.owners) blocksMap[o.userId] = o.blocksHeld;

        if (!cancelled) {
          setRows(
            entries.map((r, i) => ({
              ...r,
              username: usersMap[r.userId]?.username ?? `Grub_${r.userId.slice(0, 5)}`,
              clanId: usersMap[r.userId]?.clanId ?? null,
              clanName: usersMap[r.userId]?.clanName ?? null,
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

  const clans = useMemo<ClanRow[]>(() => {
    const map = new Map<string, ClanRow>();
    for (const r of rows) {
      if (!r.clanId || !r.clanName) continue;
      const existing = map.get(r.clanId);
      if (existing) {
        existing.totalPoints += r.totalPoints;
        existing.memberCount += 1;
      } else {
        map.set(r.clanId, {
          id: r.clanId,
          name: r.clanName,
          tag: r.clanName.slice(0, 1).toUpperCase(),
          memberCount: 1,
          totalPoints: r.totalPoints,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5);
  }, [rows]);

  const myClan = useMemo(() => {
    if (!user) return null;
    const me = rows.find((r) => r.userId === user.id);
    if (!me?.clanId) return null;
    return clans.find((c) => c.id === me.clanId) ?? null;
  }, [rows, user, clans]);

  const myClanMembers = useMemo(() => {
    if (!myClan) return [];
    return rows.filter((r) => r.clanId === myClan.id).slice(0, 10);
  }, [rows, myClan]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px 16px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>

          {/* ── Left: Top Grubs ── */}
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
                {/* Podium */}
                <PodiumSection top3={top3} currentUserId={user?.id} />

                {/* Ranked list */}
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

          {/* ── Right sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TopClansCard clans={clans} />
            {myClan && <MyClanCard clan={myClan} members={myClanMembers} />}
          </div>

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
          {row.clanName ? `${row.clanName} · ` : ''}{row.blocksHeld} block{row.blocksHeld !== 1 ? 's' : ''} held
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

// ── Top Clans card ────────────────────────────────────────────────────────────

const CLAN_COLORS = ['#FF4FA3', '#A020C8', '#FF9E5E', '#3DC45A', '#00C8E0'];

function TopClansCard({ clans }: { clans: ClanRow[] }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '20px',
      padding: '20px',
      border: '2px solid rgba(160,80,180,0.12)',
      boxShadow: '0 6px 24px rgba(130,68,89,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontFamily: "'Fredoka One', 'Nunito', sans-serif", fontSize: '1.2rem', color: '#2D1040' }}>
          Top Clans
        </h2>
        <span style={{ fontSize: '0.78rem', color: '#FF4FA3', fontWeight: 700, cursor: 'pointer' }}>
          View all →
        </span>
      </div>

      {clans.length === 0 ? (
        <p style={{ margin: 0, color: '#9A7AAA', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
          No clans yet — create one!
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {clans.map((clan, i) => (
            <div key={clan.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#9A7AAA', width: '16px', flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                background: CLAN_COLORS[i % CLAN_COLORS.length],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '1rem', color: '#fff',
              }}>
                {clan.tag.slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#2D1040', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clan.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9A7AAA' }}>
                  {clan.memberCount} member{clan.memberCount !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#2D1040', flexShrink: 0 }}>
                {clan.totalPoints.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── My Clan card ──────────────────────────────────────────────────────────────

function MyClanCard({ clan, members }: { clan: ClanRow; members: UserRow[] }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #7B20D0 0%, #C040F8 100%)',
      borderRadius: '20px',
      padding: '20px',
      boxShadow: '0 6px 24px rgba(100,20,160,0.22)',
    }}>
      <div style={{ color: '#fff', marginBottom: '4px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Your clan
        </div>
        <div style={{ fontFamily: "'Fredoka One', 'Nunito', sans-serif", fontSize: '1.3rem', fontWeight: 900 }}>
          {clan.name}
        </div>
        <div style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: '2px' }}>
          {clan.memberCount} member{clan.memberCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Member monster row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '14px 0', flexWrap: 'wrap' }}>
        {members.slice(0, 7).map((m) => {
          const { hat, color } = monsterProps(m.userId);
          return (
            <div key={m.userId} style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              padding: '3px',
            }}>
              <Monster size={32} hat={hat} color={color} />
            </div>
          );
        })}
        {members.length > 7 && (
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '0.75rem',
          }}>
            +{members.length - 7}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={{
          flex: 1, padding: '10px 0', borderRadius: '12px', border: 'none',
          background: '#2D1040', color: '#fff',
          fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
        }}>
          Clan chat
        </button>
        <button style={{
          flex: 1, padding: '10px 0', borderRadius: '12px', border: 'none',
          background: 'linear-gradient(135deg, #FF4FA3, #FF9E5E)',
          color: '#fff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
        }}>
          Clan fites
        </button>
      </div>
    </div>
  );
}
