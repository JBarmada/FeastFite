import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { profileApi, type UserStats, type LedgerEntry } from '../api/profileApi';
import { territoryApi, type MySubmission } from '../api/territoryApi';
import { voteApi } from '../api/voteApi';
import { Lightbox } from '../components/ui/Lightbox';
import type { Territory } from '@feastfite/shared';
import { AUTH_DISABLED, DEV_USER_ID, DEV_FAKE_TOKEN } from '../config/devAuth';
import { Panel } from '../components/ui/Panel';
import { Monster } from '../components/ui/Monster';
import { CandyPattern } from '../components/ui/CandyPattern';
import { colors, playerColors } from '../styles/colors';
import type { MonsterHat } from '../components/ui/Monster';

const HAT_CYCLE: MonsterHat[] = ['burger', 'donut', 'taco', 'cone', 'sushi', 'ramen'];

function hashToIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 8;
}

function formatJoinDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }).toUpperCase().replace(' ', ' \'');
}

function reasonLabel(reason: string, territoryName?: string): string {
  const base = reason.split(':')[0] ?? reason;
  const loc = territoryName ? ` at ${territoryName}` : '';
  const map: Record<string, string> = {
    vote_winner:      `Won a food fight${loc}`,
    vote_participant: `Rated a dish${loc}`,
    dish_rated:       `Your dish was rated${loc}`,
    territory_claim:  `Claimed a territory${loc}`,
    signup_bonus:     'Welcome bonus',
    streak_bonus:     'Streak bonus',
    dev_seed_bonus:   'Dev seed points',
    shop_purchase:    'Shop purchase',
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
  const [territoryNames, setTerritoryNames] = useState<Record<string, string>>({});

  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [selectedHat, setSelectedHat] = useState<MonsterHat>('donut');

  const displayName = AUTH_DISABLED ? 'Monster Grubby' : (user?.username ?? 'Food Monster');
  const monsterColor = playerColors[hashToIndex(userId || 'default')].solid;
  const joinDate = formatJoinDate(user?.createdAt);

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
      .catch(() => {})
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
    <div style={{ minHeight: '100vh', background: colors.bg, position: 'relative' }}>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <CandyPattern opacity={0.15} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar />
        <div style={{ padding: '20px 24px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start', maxWidth: 1200, margin: '0 auto' }}>

            {/* ── Left: Monster card ── */}
            <Panel color={colors.primary} pad={20} style={{ background: `linear-gradient(180deg, white, ${colors.primaryLight})` }}>
              {/* Monster showcase */}
              <div style={{
                position: 'relative', height: 200, borderRadius: 18,
                background: `radial-gradient(circle at 50% 30%, ${colors.secondaryLight}, ${colors.primaryLight})`,
                border: `3px solid ${colors.secondary}`, overflow: 'hidden',
                display: 'grid', placeItems: 'center',
              }}>
                <CandyPattern opacity={0.4} style={{ position: 'absolute', inset: 0 }} />
                <div style={{ position: 'relative', filter: 'drop-shadow(0 6px 12px rgba(45,16,64,0.3))' }}>
                  <Monster size={150} color={monsterColor} hat={selectedHat} mood="happy" />
                </div>
                <div style={{
                  position: 'absolute', bottom: 10, left: 10,
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: colors.textSecondary, background: 'white',
                  padding: '3px 7px', borderRadius: 6,
                }}>
                  LVL {territories.length + 1} GRUB
                </div>
              </div>

              {/* Name */}
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: colors.textPrimary }}>
                  {displayName}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: colors.textSecondary, letterSpacing: '0.08em', marginTop: 3 }}>
                  @{displayName.replace(/\s+/g, '').toUpperCase()} · JOINED {joinDate}
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                {[
                  ['BLOCKS', loading ? '…' : String(territories.length)],
                  ['WINS',   (loading || loadingGallery) ? '…' : String(submissions.filter((s) => s.isWinner).length)],
                  ['STREAK', loading ? '…' : `🔥 ${stats?.streak ?? 0}`],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    background: 'white', borderRadius: 12,
                    border: `2px solid ${colors.border}`,
                    padding: '10px 4px', textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: colors.primary, lineHeight: 1 }}>{v}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: colors.textSecondary, marginTop: 4, letterSpacing: '0.06em' }}>{k}</div>
                  </div>
                ))}
              </div>

              {/* Hat picker */}
              <div style={{ marginTop: 14, padding: 12, background: 'white', borderRadius: 14, border: `2px solid ${colors.border}` }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: colors.textPrimary, marginBottom: 8 }}>
                  Dress up your grub
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {HAT_CYCLE.map((h) => (
                    <button
                      key={h}
                      onClick={() => setSelectedHat(h)}
                      style={{
                        width: 44, height: 44, borderRadius: 10, cursor: 'pointer', padding: 0, border: 'none',
                        background: h === selectedHat ? colors.primaryLight : colors.surfaceRaised,
                        outline: h === selectedHat ? `2px solid ${colors.primary}` : `2px solid ${colors.border}`,
                        display: 'grid', placeItems: 'center',
                      }}
                    >
                      <Monster size={32} color={monsterColor} hat={h} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Points balance */}
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'white', borderRadius: 12, border: `2px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: colors.textSecondary, letterSpacing: '0.06em' }}>COINS</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: colors.points }}>
                  {loading ? '…' : (stats?.balance ?? 0).toLocaleString()}
                </div>
              </div>
            </Panel>

            {/* ── Right column ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Recent fites + Streak */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                {/* Recent fites */}
                <Panel color={colors.accent} pad={16}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: colors.textPrimary, marginBottom: 10 }}>Recent grub fites</div>
                  {loading ? (
                    <div style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Loading…</div>
                  ) : ledger.filter((e) => e.reason.startsWith('vote_')).length === 0 ? (
                    <div style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No fites yet — go claim a territory!</div>
                  ) : (
                    ledger.filter((e) => e.reason.startsWith('vote_')).slice(0, 5).map((entry, i) => {
                      const win = entry.reason.startsWith('vote_winner');
                      const tName = entry.territoryId ? (territoryNames[entry.territoryId] ?? 'Unknown spot') : 'Unknown spot';
                      return (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i > 0 ? `1px solid ${colors.border}` : 'none' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: win ? colors.success : colors.error, color: 'white', fontFamily: 'var(--font-display)', fontSize: 12, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {win ? 'W' : 'L'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tName}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: colors.textSecondary }}>
                              {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: entry.delta > 0 ? colors.success : colors.error, flexShrink: 0 }}>
                            {entry.delta > 0 ? '+' : ''}{entry.delta}
                          </div>
                        </div>
                      );
                    })
                  )}
                </Panel>

                {/* Streak */}
                <Panel color={colors.warning} pad={16}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: colors.textPrimary, marginBottom: 10 }}>Streak</div>
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, color: colors.warning, lineHeight: 1 }}>
                      🔥{loading ? '…' : (stats?.streak ?? 0)}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>DAYS IN A ROW</div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                    {Array.from({ length: Math.min(stats?.streak ?? 0, 14) }).map((_, i) => (
                      <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: colors.warning, boxShadow: '0 2px 0 #D68A00' }} />
                    ))}
                    {Array.from({ length: Math.max(0, 14 - (stats?.streak ?? 0)) }).map((_, i) => (
                      <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: colors.border }} />
                    ))}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 10 }}>
                    Claim one block a day to keep it warm.
                  </div>
                </Panel>
              </div>

              {/* Photo gallery */}
              <Panel color={colors.primary} pad={16}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: colors.textPrimary, marginBottom: 12 }}>
                  {displayName}&apos;s Best Dishes
                </div>
                {loadingGallery ? (
                  <div style={{ color: colors.textSecondary, textAlign: 'center', padding: '20px 0', fontSize: 13 }}>Loading gallery…</div>
                ) : submissions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: colors.textSecondary }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📭</div>
                    <div style={{ fontSize: 13 }}>No photos yet — go eat somewhere and claim a territory!</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {submissions.map((entry) => {
                      const photoUrl = entry.photoKey ? (photoUrls[entry.photoKey] ?? null) : null;
                      return (
                        <div
                          key={entry.id}
                          onClick={() => photoUrl && setLightboxSrc(photoUrl)}
                          style={{
                            borderRadius: 14, overflow: 'hidden', cursor: photoUrl ? 'zoom-in' : 'default',
                            border: `2px solid ${entry.isWinner ? colors.warning : colors.border}`,
                            background: entry.isWinner ? '#FFF8E8' : 'white',
                          }}
                        >
                          <div style={{ aspectRatio: '1', background: colors.surfaceRaised, overflow: 'hidden' }}>
                            {photoUrl ? (
                              <img src={photoUrl} alt="Submission" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🍽️</div>
                            )}
                          </div>
                          <div style={{ padding: '6px 8px' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {entry.territoryName}
                            </div>
                            {entry.isWinner && (
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: colors.warning, marginTop: 2 }}>👑 WINNER</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              {/* Points history */}
              <Panel color={colors.border} pad={16} style={{ background: 'white' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: colors.textPrimary, marginBottom: 10 }}>Points History</div>
                {loading ? (
                  <div style={{ color: colors.textSecondary, textAlign: 'center', padding: '16px 0', fontSize: 13 }}>Loading…</div>
                ) : ledger.length === 0 ? (
                  <div style={{ color: colors.textSecondary, textAlign: 'center', padding: '16px 0', fontSize: 13 }}>No activity yet — go claim a territory!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ledger.map((entry, i) => (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${colors.border}` : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: colors.textPrimary }}>
                            {reasonLabel(entry.reason, entry.territoryId ? territoryNames[entry.territoryId] : undefined)}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: colors.textSecondary }}>
                            {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: entry.delta > 0 ? colors.success : colors.error, flexShrink: 0 }}>
                          {entry.delta > 0 ? '+' : ''}{entry.delta} pts
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
