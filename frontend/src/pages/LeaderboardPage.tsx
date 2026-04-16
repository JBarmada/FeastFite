import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';

interface LeaderboardUser {
  userId: string;
  totalPoints?: number;
  currentStreak?: number;
  // If we had territories from territory-service we'd map them here
  territoriesCount?: number; 
  username?: string; // mocked since profile-service might not be joined
}

export function LeaderboardPage() {
  const [tab, setTab] = useState<'global' | 'weekly' | 'territories' | 'restaurants'>('global');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeaderboardUser[]>([]);
  // In a real app we'd fetch actual restaurants:
  const DUMMY_RESTAURANTS = [
    { id: 'dulce', name: 'Dulce' },
    { id: 'cava', name: 'Cava' },
    { id: 'honeybird', name: 'Honeybird' }
  ];
  const [selectedRes, setSelectedRes] = useState('dulce');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        let url = 'http://localhost:3004/api/economy/leaderboard';
        if (tab === 'global') url += '/global';
        else if (tab === 'weekly') url += '/weekly';
        else if (tab === 'restaurants') url += `/restaurant/${selectedRes}`;
        else {
          // 'territories' - normally hits territory-service. 
          // For now, mock fallback since economy-service doesn't own it.
          setData([
            { userId: 'u1', territoriesCount: 4, username: 'Grubbly' },
            { userId: 'u2', territoriesCount: 2, username: 'SnackMonster' }
          ]);
          setLoading(false);
          return;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch err');
        const json = await res.json();
        
        // Mocking usernames since economy-service only returns user_ids in this simple approach
        const mapped = json.leaderboard.map((item: any, i: number) => ({
          ...item,
          username: `Player_${item.userId.substring(0, 4)}` 
        }));
        setData(mapped);
      } catch (err) {
        console.error(err);
        setData([]); // fallback to empty
      }
      setLoading(false);
    }
    fetchData();
  }, [tab, selectedRes]);

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
      <Navbar />
      
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ 
          background: '#fff', borderRadius: '16px', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden'
        }}>
          
          {/* Header */}
          <div style={{ 
            background: 'linear-gradient(135deg, #FF9E5E, #FF5E8E)',
            padding: '30px 20px', textAlign: 'center', color: '#fff'
          }}>
            <h1 style={{ margin: 0, fontSize: '2.5rem' }}>🏆 Wall of Fame</h1>
            <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
              Who rules the Village?
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E9ECEF' }}>
            {(['global', 'weekly', 'territories', 'restaurants'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '16px 0', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
                  color: tab === t ? '#FF5E8E' : '#ADB5BD',
                  borderBottom: tab === t ? '3px solid #FF5E8E' : '3px solid transparent',
                  textTransform: 'capitalize'
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content filters */}
          {tab === 'restaurants' && (
            <div style={{ padding: '20px', background: '#FDFDFD', borderBottom: '1px solid #E9ECEF' }}>
              <label style={{ fontWeight: 600, marginRight: '10px', color: '#495057' }}>Select Restaurant:</label>
              <select 
                value={selectedRes} 
                onChange={e => setSelectedRes(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: '1px solid #CED4DA',
                  outline: 'none', background: '#fff', fontSize: '1rem'
                }}
              >
                {DUMMY_RESTAURANTS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* List */}
          <div style={{ padding: '20px' }}>
            {loading ? (
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
                  <RankRow 
                    key={user.userId} 
                    rank={i + 1} 
                    user={user} 
                    tab={tab} 
                  />
                ))}
              </div>
            )}
          </div>
          
        </div>
      </main>
    </div>
  );
}

// Sub-component for individual rows
function RankRow({ rank, user, tab }: { rank: number; user: LeaderboardUser; tab: string }) {
  let rankIcon = `#${rank}`;
  if (rank === 1) rankIcon = '🥇';
  else if (rank === 2) rankIcon = '🥈';
  else if (rank === 3) rankIcon = '🥉';

  let scoreLabel = '';
  if (tab === 'territories') {
    scoreLabel = `${user.territoriesCount || 0} Territories`;
  } else {
    scoreLabel = `${(user.totalPoints || 0).toLocaleString()} pts`;
  }

  // Some fun visual cues
  const isTop3 = rank <= 3;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '16px',
      background: isTop3 ? '#FFF4E6' : '#fff',
      border: isTop3 ? '1px solid #FFD8A8' : '1px solid #E9ECEF',
      borderRadius: '12px',
      transition: 'transform 0.1s ease',
      cursor: 'default'
    }}>
      <div style={{ 
        width: '40px', fontSize: isTop3 ? '1.5rem' : '1.2rem', 
        fontWeight: 800, color: '#FF9E5E', textAlign: 'center' 
      }}>
        {rankIcon}
      </div>
      
      <div style={{ 
        width: '48px', height: '48px', borderRadius: '50%', 
        background: '#FFE8CC', margin: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.5rem'
      }}>
        👾
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#343A40', fontSize: '1.1rem' }}>
          {user.username}
        </div>
        {user.currentStreak ? (
          <div style={{ fontSize: '0.8rem', color: '#FF5E8E', fontWeight: 600 }}>
            🔥 {user.currentStreak} day streak
          </div>
        ) : null}
      </div>

      <div style={{ 
        fontWeight: 800, fontSize: '1.2rem', 
        color: tab === 'territories' ? '#A020C8' : '#FF9E5E' 
      }}>
        {scoreLabel}
      </div>
    </div>
  );
}
