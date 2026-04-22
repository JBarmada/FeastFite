import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { profileApi, type UserStats, type LedgerEntry } from '../api/profileApi';
import { territoryApi, type MySubmission } from '../api/territoryApi';
import { voteApi } from '../api/voteApi';
import { Lightbox } from '../components/ui/Lightbox';
import type { Territory } from '@feastfite/shared';
import { AUTH_DISABLED, DEV_USER_ID, DEV_FAKE_TOKEN } from '../config/devAuth';

function reasonLabel(reason: string, territoryName?: string): string {
  const base = reason.split(':')[0] ?? reason;
  const loc = territoryName ? ` at ${territoryName}` : '';
  const map: Record<string, string> = {
    vote_winner:      `🏆 Won a food fight${loc}`,
    vote_participant: `⭐ Rated a dish${loc}`,
    dish_rated:       `🍽️ Your dish was rated${loc}`,
    territory_claim:  `🚩 Claimed a territory${loc}`,
    signup_bonus:     '🎁 Welcome bonus',
    streak_bonus:     '🔥 Streak bonus',
    dev_seed_bonus:   '🛠️ Dev seed points',
    shop_purchase:    '🛒 Shop purchase',
  };
  return map[base] ?? reason;
}

export function ProfilePage() {
  const { user, token } = useAuth();
  const authToken = AUTH_DISABLED ? DEV_FAKE_TOKEN : (token ?? '');
  const userId = AUTH_DISABLED ? DEV_USER_ID : (user?.id ?? '');

  const [stats, setStats] = useState<UserStats | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [territoryNames, setTerritoryNames] = useState<Record<string, string>>({});

  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const displayName = AUTH_DISABLED ? 'Monster Grubby' : (user?.username ?? 'Food Monster');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      profileApi.getUserStats(authToken).catch(() => null),
      profileApi.getLedger(authToken, 25).catch(() => []),
      territoryApi.getOwned(authToken).catch(() => []),
    ])
      .then(([s, l, t]) => {
        setStats(s);
        const ledgerEntries = Array.isArray(l) ? l : [];
        setLedger(ledgerEntries);
        setTerritories(Array.isArray(t) ? t : []);
        const tIds = [...new Set(ledgerEntries.map((e) => e.territoryId).filter(Boolean) as string[])];
        Promise.all(tIds.map((id) => territoryApi.getById(id).catch(() => null)))
          .then((terrs) => {
            const map: Record<string, string> = {};
            terrs.forEach((terr) => { if (terr) map[terr.id] = terr.name; });
            setTerritoryNames(map);
          })
          .catch(() => {});
      })
      .catch((e) => { console.error(e); setError('Could not load profile data.'); })
      .finally(() => setLoading(false));
  }, [userId, authToken]);

  useEffect(() => {
    if (!userId) return;
    setLoadingGallery(true);
    territoryApi
      .getMySubmissions(authToken)
      .then(async (subs) => {
        setSubmissions(subs);
        const keys = subs.map((s) => s.photoKey).filter(Boolean) as string[];
        const resolved = await Promise.all(keys.map(async (key) => ({ key, url: await voteApi.getPhotoUrl(key) })));
        const map: Record<string, string> = {};
        resolved.forEach(({ key, url }) => { if (url) map[key] = url; });
        setPhotoUrls(map);
      })
      .catch(() => {})
      .finally(() => setLoadingGallery(false));
  }, [userId, authToken]);

  return (
    <div style={{ minHeight: '100vh' }}>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <Navbar />
      <div style={{ paddingTop: '40px' }}>
        <div className="page-card">

          {/* Avatar + name */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.5)',
              border: '3px solid rgba(255,255,255,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '3rem', margin: '0 auto 10px',
              boxShadow: '0 4px 16px rgba(160,32,200,0.2)',
            }}>
              👾
            </div>
            <h1 style={{
              margin: '0 0 4px', fontFamily: 'var(--font-display)',
              fontSize: '1.8rem', color: '#2D1040',
            }}>
              User: {displayName}
            </h1>
            {!AUTH_DISABLED && user?.email && (
              <p style={{ color: '#7A5490', margin: 0, fontSize: '0.85rem' }}>{user.email}</p>
            )}
          </div>

          {error && (
            <div style={{ background: 'rgba(255,80,120,0.15)', border: '1.5px solid rgba(255,80,120,0.4)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', color: '#C73060', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {/* Two-column layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            alignItems: 'start',
          }}>
            {/* ── Left: Stats ── */}
            <div style={{ background: 'rgba(255,255,255,0.45)', borderRadius: '20px', padding: '20px', border: '1.5px solid rgba(255,255,255,0.7)' }}>
              <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 900, color: '#2D1040', textAlign: 'center', letterSpacing: '0.08em' }}>
                STATS
              </h2>

              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {[
                  { icon: '🏴', label: 'Total Territories\nClaimed', value: loading ? '…' : String(territories.length) },
                  { icon: '🪙', label: 'Current Points', value: loading ? '…' : `${(stats?.balance ?? 0).toLocaleString()} pts` },
                  { icon: '🔥', label: 'Daily Streak', value: loading ? '…' : `${stats?.streak ?? 0}d` },
                ].map((stat) => (
                  <div key={stat.label} style={{
                    background: 'rgba(255,255,255,0.6)',
                    border: '1.5px solid rgba(255,255,255,0.8)',
                    borderRadius: '14px',
                    padding: '12px 8px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.5rem' }}>{stat.icon}</div>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#2D1040', marginTop: '4px' }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#7A5490', marginTop: '2px', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Territories */}
              {territories.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2D1040', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🏴 Your Territories
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {territories.map((t) => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.6)', border: '1.5px solid rgba(255,255,255,0.8)',
                      }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #FFD700, #FF9E00)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', flexShrink: 0,
                        }}>🏆</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2D1040', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.name}
                          </div>
                          {t.capturedAt && (
                            <div style={{ fontSize: '0.68rem', color: '#7A5490' }}>
                              Claimed {new Date(t.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'rgba(160,32,200,0.12)', color: '#A020C8', flexShrink: 0 }}>
                          Conquered
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Points history */}
              <div>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2D1040', margin: '0 0 10px' }}>
                  📋 Points History
                </h3>
                {loading ? (
                  <p style={{ color: '#7A5490', textAlign: 'center', fontSize: '0.85rem' }}>Loading…</p>
                ) : ledger.length === 0 ? (
                  <p style={{ color: '#7A5490', textAlign: 'center', fontSize: '0.85rem' }}>No activity yet — go claim a territory!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {ledger.map((entry) => (
                      <div key={entry.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.6)', border: '1.5px solid rgba(255,255,255,0.8)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#2D1040' }}>
                            {reasonLabel(entry.reason, entry.territoryId ? territoryNames[entry.territoryId] : undefined)}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#7A5490' }}>
                            {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: entry.delta > 0 ? '#1A7A4A' : '#C73060', flexShrink: 0 }}>
                          {entry.delta > 0 ? '+' : ''}{entry.delta} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: Gallery ── */}
            <div style={{ background: 'rgba(255,255,255,0.45)', borderRadius: '20px', padding: '20px', border: '1.5px solid rgba(255,255,255,0.7)' }}>
              <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 900, color: '#2D1040', textAlign: 'center', letterSpacing: '0.08em' }}>
                GALLERY
              </h2>
              <h3 style={{ margin: '0 0 14px', fontSize: '0.88rem', fontWeight: 700, color: '#2D1040', textAlign: 'center' }}>
                {displayName}&apos;s Best Dishes
              </h3>

              {loadingGallery ? (
                <p style={{ textAlign: 'center', color: '#7A5490', padding: '20px 0', fontSize: '0.85rem' }}>Loading gallery…</p>
              ) : submissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: '#7A5490' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📭</div>
                  <p style={{ fontSize: '0.85rem' }}>No photos yet — go eat somewhere and claim a territory!</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                }}>
                  {submissions.map((entry) => {
                    const photoUrl = entry.photoKey ? (photoUrls[entry.photoKey] ?? null) : null;
                    return (
                      <div
                        key={entry.id}
                        style={{
                          borderRadius: '12px', overflow: 'hidden',
                          background: entry.isWinner ? 'rgba(255,244,230,0.8)' : 'rgba(255,255,255,0.6)',
                          border: `1.5px solid ${entry.isWinner ? '#FFD8A8' : 'rgba(255,255,255,0.8)'}`,
                          cursor: photoUrl ? 'zoom-in' : 'default',
                        }}
                        onClick={() => photoUrl && setLightboxSrc(photoUrl)}
                      >
                        <div style={{ aspectRatio: '1', background: '#F5E8FF', overflow: 'hidden', position: 'relative' }}>
                          {photoUrl ? (
                            <img src={photoUrl} alt="Submission" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🍽️</div>
                          )}
                        </div>
                        <div style={{ padding: '6px 8px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#2D1040', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.territoryName}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#FF9E5E', fontWeight: 700 }}>
                            {entry.avgRating != null ? `Top Dish: ${entry.avgRating.toFixed(2)} stars` : '—'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Edit Profile button */}
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button style={{
                  padding: '10px 32px', borderRadius: '999px', border: 'none',
                  background: 'linear-gradient(135deg, #FF6FA3, #FF9E8C)',
                  color: '#fff', fontWeight: 800, fontSize: '0.95rem',
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,111,145,0.3)',
                }}>
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
