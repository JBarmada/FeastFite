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
    vote_winner:     `🏆 Won a food fight${loc}`,
    vote_participant:`⭐ Rated a dish${loc}`,
    dish_rated:      `🍽️ Your dish was rated${loc}`,
    territory_claim: `🚩 Claimed a territory${loc}`,
    signup_bonus:    '🎁 Welcome bonus',
    streak_bonus:    '🔥 Streak bonus',
    dev_seed_bonus:  '🛠️ Dev seed points',
    shop_purchase:   '🛒 Shop purchase',
  };
  return map[base] ?? reason;
}

type ActiveTab = 'stats' | 'gallery';

export function ProfilePage() {
  const { user, token } = useAuth();
  const authToken = AUTH_DISABLED ? DEV_FAKE_TOKEN : (token ?? '');
  const userId = AUTH_DISABLED ? DEV_USER_ID : (user?.id ?? '');

  const [activeTab, setActiveTab] = useState<ActiveTab>('stats');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [territoryNames, setTerritoryNames] = useState<Record<string, string>>({});

  // Gallery
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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

        // Resolve territory names for ledger entries
        const tIds = [...new Set(ledgerEntries.map((e) => e.territoryId).filter(Boolean) as string[])];
        Promise.all(tIds.map((id) => territoryApi.getById(id).catch(() => null)))
          .then((terrs) => {
            const map: Record<string, string> = {};
            terrs.forEach((terr) => { if (terr) map[terr.id] = terr.name; });
            setTerritoryNames(map);
          })
          .catch(() => {});
      })
      .catch((e) => {
        console.error(e);
        setError('Could not load profile data.');
      })
      .finally(() => setLoading(false));
  }, [userId, authToken]);

  useEffect(() => {
    if (activeTab !== 'gallery' || !userId) return;
    setLoadingGallery(true);
    territoryApi
      .getMySubmissions(authToken)
      .then(async (subs) => {
        setSubmissions(subs);
        // Resolve photo URLs
        const keys = subs.map((s) => s.photoKey).filter(Boolean) as string[];
        const resolved = await Promise.all(
          keys.map(async (key) => ({ key, url: await voteApi.getPhotoUrl(key) }))
        );
        const map: Record<string, string> = {};
        resolved.forEach(({ key, url }) => { if (url) map[key] = url; });
        setPhotoUrls(map);
      })
      .catch(() => {})
      .finally(() => setLoadingGallery(false));
  }, [activeTab, userId, authToken]);

  const displayName = AUTH_DISABLED ? 'Monster Grubby' : (user?.username ?? 'Food Monster');

  // Group submissions by territory
  const submissionsByTerritory = submissions.reduce<Record<string, { name: string; entries: MySubmission[] }>>((acc, sub) => {
    if (!acc[sub.territoryId]) acc[sub.territoryId] = { name: sub.territoryName, entries: [] };
    acc[sub.territoryId]!.entries.push(sub);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <Navbar />
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 16px' }}>

        {/* Avatar + name */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '8px' }}>👾</div>
          <h1 style={{ margin: 0, color: 'var(--color-primary)', fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
            {displayName}
          </h1>
          {!AUTH_DISABLED && user?.email && (
            <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0', fontSize: '0.85rem' }}>
              {user.email}
            </p>
          )}
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px' }}>
          {(['stats', 'gallery'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '10px 28px',
                borderRadius: '999px',
                border: '2px solid',
                borderColor: activeTab === t ? 'var(--color-primary)' : 'var(--color-border)',
                background: activeTab === t ? 'var(--color-primary)' : 'var(--color-surface)',
                color: activeTab === t ? '#fff' : 'var(--color-text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.9rem',
                textTransform: 'capitalize',
              }}
            >
              {t === 'gallery' ? '📸 Gallery' : '📊 Stats'}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #FFA0A0', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#C73060', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {/* ── Stats tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <>
            {/* Stat cards */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '32px' }}>
              {[
                { emoji: '🍬', label: 'Points', value: loading ? '…' : (stats?.balance?.toLocaleString() ?? '0') },
                { emoji: '🏴', label: 'Territories', value: loading ? '…' : String(territories.length) },
                { emoji: '🔥', label: 'Streak', value: loading ? '…' : `${stats?.streak ?? 0}d` },
              ].map((stat) => (
                <div key={stat.label} style={{
                  background: 'var(--color-surface)',
                  border: '2px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '20px 32px',
                  textAlign: 'center',
                  minWidth: '120px',
                }}>
                  <div style={{ fontSize: '2rem' }}>{stat.emoji}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-text-primary)', marginTop: '4px' }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Territories held */}
            {territories.length > 0 && (
              <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#2D1B4E', marginBottom: '12px' }}>
                  🏴 Your Territories
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {territories.map((t) => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '10px',
                      background: 'var(--color-surface)', border: '1.5px solid var(--color-border)',
                    }}>
                      <span style={{ fontSize: '1.4rem' }}>🍽️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D1B4E' }}>{t.name}</div>
                        {t.capturedAt && (
                          <div style={{ fontSize: '0.72rem', color: '#aaa' }}>
                            Claimed {new Date(t.capturedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: '#EDE9FE', color: '#6D28D9', border: '1.5px solid #A78BFA' }}>
                        👑 Conquered
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Points log */}
            <section>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#2D1B4E', marginBottom: '12px' }}>
                📋 Points History
              </h2>
              {loading ? (
                <p style={{ color: '#bbb', textAlign: 'center' }}>Loading…</p>
              ) : ledger.length === 0 ? (
                <p style={{ color: '#bbb', textAlign: 'center' }}>No activity yet — go claim a territory!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ledger.map((entry) => (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', borderRadius: '10px',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#2D1B4E' }}>
                          {reasonLabel(entry.reason, entry.territoryId ? territoryNames[entry.territoryId] : undefined)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#aaa' }}>
                          {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: entry.delta > 0 ? '#1A7A4A' : '#C73060' }}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ── Gallery tab ───────────────────────────────────────────────────── */}
        {activeTab === 'gallery' && (
          <>
            {loadingGallery ? (
              <p style={{ textAlign: 'center', color: '#bbb', padding: '40px 0' }}>Loading your gallery…</p>
            ) : submissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
                <p>No photos yet — go eat somewhere and claim a territory!</p>
              </div>
            ) : (
              Object.entries(submissionsByTerritory).map(([territoryId, { name, entries }]) => {
                const avgRatings = entries.map((e) => e.avgRating).filter((r) => r != null) as number[];
                const overallAvg = avgRatings.length > 0
                  ? (avgRatings.reduce((a, b) => a + b, 0) / avgRatings.length).toFixed(1)
                  : null;

                return (
                  <section key={territoryId} style={{ marginBottom: '36px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#2D1B4E', margin: 0 }}>
                        🏴 {name}
                      </h2>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', color: '#888' }}>
                        {overallAvg && <span>⭐ avg {overallAvg}</span>}
                        <span>{entries.length} {entries.length === 1 ? 'photo' : 'photos'}</span>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: '10px',
                    }}>
                      {entries.map((entry) => {
                        const photoUrl = entry.photoKey ? (photoUrls[entry.photoKey] ?? null) : null;
                        return (
                          <div key={entry.id} style={{
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: entry.isWinner ? '#FFF4E6' : 'var(--color-surface)',
                            border: `2px solid ${entry.isWinner ? '#FFD8A8' : 'var(--color-border)'}`,
                          }}>
                            <div
                              onClick={() => photoUrl && setLightboxSrc(photoUrl)}
                              style={{ width: '100%', aspectRatio: '1', background: '#F5E8FF', position: 'relative', overflow: 'hidden', cursor: photoUrl ? 'zoom-in' : 'default' }}
                            >
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt="My submission"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>🍽️</div>
                              )}
                              {entry.isWinner && (
                                <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#FFD8A8', borderRadius: '999px', padding: '1px 7px', fontSize: '0.65rem', fontWeight: 800, color: '#7A4100' }}>
                                  👑
                                </div>
                              )}
                            </div>
                            <div style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#FF9E5E' }}>
                                {entry.avgRating != null ? `⭐ ${entry.avgRating.toFixed(1)}` : '—'}
                              </div>
                              {entry.voteCount > 0 && (
                                <div style={{ fontSize: '0.68rem', color: '#aaa' }}>{entry.voteCount} votes</div>
                              )}
                              <div style={{ fontSize: '0.68rem', color: '#ccc', marginTop: '2px' }}>
                                {new Date(entry.claimedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </>
        )}

      </div>
    </div>
  );
}
