import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import { AUTH_DISABLED, DEV_USER_ID } from '../config/devAuth';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { VotingRoom } from '../components/voting/VotingRoom';
import { Lightbox } from '../components/ui/Lightbox';
import { io } from 'socket.io-client';
import { voteApi, type VoteSession, type VoteCandidate } from '../api/voteApi';
import { territoryApi, type ClaimHistoryEntry } from '../api/territoryApi';
import { economyApi } from '../api/economyApi';
import { profileApi } from '../api/profileApi';
import type { ClaimData } from '../components/map/ClaimingMoment';

export function VotingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const routeState = (location.state as {
    territory?: Territory;
    fromBatteringRam?: boolean;
  } | null) ?? {};
  const territory = routeState.territory ?? null;
  /** Only set when arriving from POST /territories/:id/battering-ram (used to unlock mid–food-fight uploads). */
  const fromBatteringRam = Boolean(routeState.fromBatteringRam);

  const currentUserId = AUTH_DISABLED ? DEV_USER_ID : (user?.id ?? 'guest');
  const currentUserName = AUTH_DISABLED ? 'Monster Grubby' : (user?.username ?? 'Hungry Monster');
  const authToken = AUTH_DISABLED ? 'dev-bypass-token' : (token ?? '');

  // Upload form
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Session state
  const [activeSession, setActiveSession] = useState<VoteSession | null>(null);

  // Gallery
  const [history, setHistory] = useState<ClaimHistoryEntry[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );

  const isContested = Boolean(territory?.ownerId);
  const galleryRef = useRef<HTMLElement>(null);
  const voteRoomRef = useRef<HTMLDivElement>(null);

  const fightActive =
    activeSession != null
    && activeSession.status !== 'completed'
    && activeSession.status !== 'cancelled';

  /** Mid-fight uploads (add another candidate) are only allowed after using a battering ram on this visit. */
  const canAddDishDuringFight = fightActive && fromBatteringRam;

  const resolvePhotoUrls = useCallback(async (entries: ClaimHistoryEntry[]) => {
    const keys = entries.map((e) => e.photoKey).filter(Boolean) as string[];
    const resolved = await Promise.all(
      keys.map(async (key) => ({ key, url: await voteApi.getPhotoUrl(key) }))
    );
    const map: Record<string, string> = {};
    resolved.forEach(({ key, url }) => { if (url) map[key] = url; });
    setPhotoUrls(map);
  }, []);

  useEffect(() => {
    if (!territory) return;
    setLoadingHistory(true);

    Promise.all([
      voteApi.getActiveSessionForTerritory(territory.id),
      territoryApi.getHistory(territory.id),
    ])
      .then(([session, hist]) => {
        if (session) setActiveSession(session);
        setHistory(hist);
        void resolvePhotoUrls(hist);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [territory?.id, resolvePhotoUrls]);

  useEffect(() => {
    if (!fightActive || fromBatteringRam) return;
    setShowUploadForm(false);
    setUploadError(null);
    setSelectedFile(null);
  }, [fightActive, fromBatteringRam]);

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!territory || !selectedFile) return;

    setIsSubmitting(true);
    setUploadError(null);

    try {
      const { photoKey } = await voteApi.uploadFile(selectedFile);

      if (!isContested) {
        // Uncontested — direct claim
        await territoryApi.claim(territory.id, authToken, {
          photoKey,
          displayName: currentUserName,
        });

        // Fetch updated stats to build the claiming moment overlay
        const [balance, stats, owned] = await Promise.allSettled([
          AUTH_DISABLED ? Promise.resolve(50) : economyApi.getBalance(authToken),
          AUTH_DISABLED
            ? Promise.resolve({ balance: 50, streak: 1, lastUploadDate: null })
            : profileApi.getUserStats(authToken),
          territoryApi.getOwned(authToken),
        ]);

        const newBalance = balance.status === 'fulfilled' ? balance.value : 50;
        const streak = stats.status === 'fulfilled' ? stats.value.streak : 1;
        const blocksHeld = owned.status === 'fulfilled' ? owned.value.length : 1;

        const claimData: ClaimData = {
          territoryName: territory.name,
          ownerName: currentUserName,
          claimedAt: Date.now(),
          lockedUntil: Date.now() + 12 * 60 * 60 * 1000,
          pointsDelta: 50,
          newBalance,
          streak,
          blocksHeld,
        };

        navigate('/', { state: { claimData } });
      } else if (activeSession) {
        // Session exists — add as new candidate (only after battering ram while fight is live)
        if (!fromBatteringRam) {
          setUploadError('Adding a dish mid-fite is locked. Cast your vote on the competing dishes below.');
          return;
        }
        const updated = await voteApi.addCandidate(activeSession.id, {
          photoKey,
          userId: currentUserId,
          displayName: currentUserName,
        });
        setActiveSession(updated);
        setShowUploadForm(false);
      } else {
        // Contested, no session yet — create one
        const { session } = await voteApi.createSession({
          territoryId: territory.id,
          territoryName: territory.name,
          photoKey,
          challengerId: currentUserId,
          challengerName: currentUserName,
          defenderId: territory.ownerId ?? undefined,
          defenderName: territory.ownerName ?? 'Current Owner',
          defenderPhotoKey: territory.dishPhotoKey ?? undefined,
        });
        setActiveSession(session);
        setShowUploadForm(false);
      }
    } catch (err) {
      console.error(err);
      setUploadError('Upload fizzled out. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Territory gallery + upload ──────────────────────────────────────────────

  const blockNum = territory ? blockNumber(territory.id) : '00';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <Navbar />

      {territory ? (
        /* ── Full territory detail view ──────────────────────── */
        <div style={{
          minHeight: 'calc(100vh - 64px)',
          background: 'linear-gradient(180deg, #FEF0FA 0%, #F7E8FF 100%)',
          backgroundImage: 'radial-gradient(circle, rgba(220,130,180,0.1) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '22px 28px 48px' }}>

            {/* Breadcrumb */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '22px', fontSize: '0.72rem', fontWeight: 700, color: '#B8A0C8', letterSpacing: '0.05em' }}>
              <button
                onClick={() => navigate('/')}
                style={{ background: 'none', border: 'none', color: '#B8A0C8', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', padding: 0, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                ← MAP
              </button>
              <span>/</span>
              <span>BLOCK {blockNum}</span>
              <span>/</span>
              <span style={{ color: '#2D1B4E' }}>{territory.name.toUpperCase()}</span>
            </nav>

            {/* ── Hero 2-column ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '55fr 45fr',
              gap: '28px',
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(8px)',
              borderRadius: '24px',
              padding: '32px',
              border: '1.5px solid #F0D8EC',
              boxShadow: '0 4px 32px rgba(180,80,140,0.08)',
              marginBottom: '28px',
            }}>
              {/* Left info panel */}
              <div>
                {/* Status badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isContested ? '#E53935' : '#FF8C00',
                  color: '#fff',
                  padding: '5px 16px',
                  borderRadius: '999px',
                  fontSize: '0.68rem',
                  fontWeight: 900,
                  letterSpacing: '0.09em',
                  marginBottom: '14px',
                  textTransform: 'uppercase' as const,
                }}>
                  {isContested ? '⚔️  Contested Territory' : '⭐  Unclaimed · Up for Grabs'}
                </div>

                <h1 style={{
                  margin: '0 0 14px',
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.5rem',
                  color: '#D4186A',
                  lineHeight: 1.1,
                  fontWeight: 900,
                }}>
                  {territory.name}
                </h1>

                <p style={{ color: '#7A5A8A', lineHeight: 1.65, marginBottom: '20px', fontSize: '0.92rem', margin: '0 0 20px' }}>
                  {fightActive
                    ? (fromBatteringRam
                      ? 'The fite is live! You broke through with a battering ram—you can add your dish or rate the plates below.'
                      : 'A food fite is happening on this block right now. Rate each dish in the fight room—adding your own photo is only for grubs who broke the lock with a battering ram.')
                    : isContested
                      ? `${territory.ownerName ?? 'A grub'} is defending this block. Upload your best dish to start a food fight — the community votes to decide who holds it for 12 hours.`
                      : "A sweet little spot up for grabs! Be the first grub to plant your flag — upload your meal photo and hold this block for 12 hours."}
                </p>

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '26px' }}>
                  {[
                    { icon: '🍬', label: 'Sweets' },
                    { icon: '📍', label: '0.4 mi from you' },
                    { icon: '👾', label: '12 grubs nearby' },
                    { icon: isContested ? '⚔️' : '⭐', label: isContested ? 'Contested' : 'Corner spot' },
                  ].map(({ icon, label }) => (
                    <span key={label} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: '#fff', border: '1.5px solid #E0C8E8',
                      borderRadius: '999px', padding: '5px 13px',
                      fontSize: '0.8rem', color: '#5A3A7A', fontWeight: 600,
                    }}>
                      {icon} {label}
                    </span>
                  ))}
                </div>

                {/* Action buttons — only show when not in upload/voting flow */}
                {!activeSession && !showUploadForm && (
                  <>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: '14px' }}>
                      <button
                        onClick={() => setShowUploadForm(true)}
                        style={{
                          background: 'linear-gradient(135deg, #FF5FAD 0%, #FF2D78 100%)',
                          color: '#fff', border: 'none', borderRadius: '999px',
                          padding: '14px 30px', fontWeight: 900, fontSize: '0.95rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                          boxShadow: '0 4px 24px rgba(255,45,120,0.35)',
                          letterSpacing: '0.01em',
                        }}
                      >
                        ▶&nbsp; {isContested ? 'Challenge this territory' : 'Claim this territory'}
                      </button>
                      <button
                        onClick={() => galleryRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        style={{
                          background: '#3D1A78', color: '#fff', border: 'none', borderRadius: '999px',
                          padding: '14px 24px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                          letterSpacing: '0.01em',
                        }}
                      >
                        + Watch this block
                      </button>
                    </div>
                    {!isContested ? (
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#22A060', fontWeight: 800, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22A060', display: 'inline-block', flexShrink: 0 }} />
                        FREE CLAIM — NO COINS NEEDED. JUST SNAP A MEAL.
                      </p>
                    ) : territory.ownerName ? (
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#FF8C00', fontWeight: 800, letterSpacing: '0.05em' }}>
                        👑 OWNED BY {territory.ownerName.toUpperCase()}
                      </p>
                    ) : null}
                  </>
                )}

                {/* Voting in progress call-to-action */}
                {activeSession && !showUploadForm && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      background: '#FFF3E0', border: '1.5px solid #FFB800', borderRadius: '12px',
                      padding: '10px 16px', fontSize: '0.85rem', color: '#7A4100', fontWeight: 700,
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E53935', display: 'inline-block', animation: 'pulse 1.4s infinite' }} />
                      LIVE FOOD FIGHT IN PROGRESS
                    </div>
                    {canAddDishDuringFight ? (
                      <button
                        type="button"
                        onClick={() => setShowUploadForm(true)}
                        style={{
                          background: 'linear-gradient(135deg, #FF5FAD 0%, #FF2D78 100%)',
                          color: '#fff', border: 'none', borderRadius: '999px',
                          padding: '12px 22px', fontWeight: 900, fontSize: '0.85rem',
                          cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,45,120,0.3)',
                        }}
                      >
                        + Add my dish
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => voteRoomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        style={{
                          background: '#3D1A78', color: '#fff', border: 'none', borderRadius: '999px',
                          padding: '12px 22px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                        }}
                      >
                        ♥ Go vote
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Right: neighborhood mini-map */}
              <NeighborhoodMiniMap territoryId={territory.id} blockNum={blockNum} />
            </div>

            {/* ── Upload form card ── */}
            {showUploadForm && (
              <div style={{
                background: 'rgba(255,255,255,0.92)',
                border: '2px solid #F0D8EC',
                borderRadius: '20px',
                padding: '28px',
                marginBottom: '28px',
                boxShadow: '0 4px 24px rgba(180,80,140,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '14px',
                    background: 'linear-gradient(135deg, #FF5FAD, #FF2D78)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', flexShrink: 0,
                  }}>
                    📸
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: '#D4186A' }}>
                      {activeSession ? 'Add your dish to the fight' : isContested ? 'Upload your battle dish' : 'Snap your meal!'}
                    </h2>
                    <p style={{ margin: 0, color: '#9A6AAA', fontSize: '0.82rem' }}>
                      {activeSession
                        ? 'Submit a photo and join the community rating!'
                        : isContested
                        ? 'The community rates all dishes 1–10. Highest avg score wins!'
                        : "No one owns this spot yet — upload a photo and it's instantly yours."}
                    </p>
                  </div>
                </div>

                <form className="upload-form" onSubmit={handleUploadSubmit} style={{ marginTop: '20px' }}>
                  <label style={{
                    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
                    gap: '10px', border: '2px dashed #E0C8E8', borderRadius: '16px',
                    padding: '32px 24px', cursor: 'pointer', textAlign: 'center' as const,
                    background: selectedFile ? '#FFF5FB' : '#FDFBFF',
                    transition: 'background 0.2s',
                  }}>
                    <input
                      accept="image/*"
                      capture="environment"
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    <span style={{ fontSize: '2rem' }}>{selectedFile ? '✅' : '📷'}</span>
                    <span style={{ fontWeight: 700, color: '#7A5A8A', fontSize: '0.9rem' }}>
                      {selectedFile ? selectedFile.name : 'Tap to choose your meal photo'}
                    </span>
                    {!selectedFile && (
                      <span style={{ fontSize: '0.75rem', color: '#B8A0C8' }}>JPG, PNG, HEIC — any food pic works!</span>
                    )}
                  </label>

                  {previewUrl && (
                    <div
                      className="preview-frame"
                      onClick={() => setLightboxSrc(previewUrl)}
                      style={{ cursor: 'zoom-in' }}
                    >
                      <img src={previewUrl} alt="Meal preview" className="preview-image" />
                    </div>
                  )}

                  {uploadError && (
                    <p style={{ margin: '12px 0 0', color: '#E53935', fontSize: '0.82rem', fontWeight: 700, background: '#FFF0F0', borderRadius: '10px', padding: '10px 14px' }}>
                      {uploadError}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button
                      type="button"
                      onClick={() => setShowUploadForm(false)}
                      style={{
                        flex: 1, background: '#F5EBF8', color: '#7A5A8A', border: 'none',
                        borderRadius: '999px', padding: '13px', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedFile}
                      style={{
                        flex: 2,
                        background: isSubmitting || !selectedFile
                          ? '#E0C8E8'
                          : 'linear-gradient(135deg, #FF5FAD 0%, #FF2D78 100%)',
                        color: '#fff', border: 'none', borderRadius: '999px',
                        padding: '13px', fontWeight: 900, fontSize: '0.95rem',
                        cursor: isSubmitting || !selectedFile ? 'not-allowed' : 'pointer',
                        boxShadow: isSubmitting || !selectedFile ? 'none' : '0 4px 20px rgba(255,45,120,0.3)',
                      }}
                    >
                      {isSubmitting
                        ? '⏳ Uploading...'
                        : activeSession ? '🍽️ Add to fight' : isContested ? '⚔️ Start food fight' : '🚩 Claim it!'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Live voting room ── */}
            {activeSession && !showUploadForm && (
              <div ref={voteRoomRef} style={{ marginBottom: '28px' }}>
                <VotingRoom
                  sessionId={activeSession.id}
                  currentUserId={currentUserId}
                  territoryName={territory.name}
                  onBack={() => navigate('/')}
                  onAddDish={canAddDishDuringFight ? () => setShowUploadForm(true) : undefined}
                />
              </div>
            )}

            {/* ── Submissions gallery ── */}
            <section ref={galleryRef}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 900, color: '#2D1B4E', marginBottom: '16px', letterSpacing: '0.06em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📸 All submissions at {territory.name}
              </h2>

              {loadingHistory ? (
                <p style={{ color: '#C5A8D5', textAlign: 'center', fontWeight: 600, padding: '32px' }}>Loading submissions…</p>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: '#C5A8D5' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🍽️</div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>No submissions yet</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>Be the first to claim this spot!</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '14px',
                }}>
                  {history.map((entry) => {
                    const photoUrl = entry.photoKey ? (photoUrls[entry.photoKey] ?? null) : null;
                    const fightOngoing = activeSession != null && activeSession.status !== 'completed' && activeSession.status !== 'cancelled';
                    const showWinner = entry.isWinner && !fightOngoing;
                    const avgDisplay = entry.avgRating != null
                      ? `⭐ ${entry.avgRating.toFixed(1)}`
                      : showWinner ? '👑 Winner' : '—';

                    return (
                      <div key={entry.id} style={{
                        borderRadius: '16px',
                        overflow: 'hidden',
                        background: showWinner ? '#FFF9EE' : 'rgba(255,255,255,0.9)',
                        border: `2px solid ${showWinner ? '#FFD8A8' : '#F0D8EC'}`,
                        boxShadow: showWinner ? '0 4px 16px rgba(255,180,60,0.2)' : '0 2px 8px rgba(180,80,140,0.06)',
                      }}>
                        <div
                          onClick={() => photoUrl && setLightboxSrc(photoUrl)}
                          style={{ width: '100%', aspectRatio: '1', background: '#F5E8FF', position: 'relative', overflow: 'hidden', cursor: photoUrl ? 'zoom-in' : 'default' }}
                        >
                          {photoUrl ? (
                            <img src={photoUrl} alt="Submission" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🍽️</div>
                          )}
                          {showWinner && (
                            <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#FFD8A8', borderRadius: '999px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 800, color: '#7A4100' }}>
                              👑 Owner
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2D1B4E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.claimantName}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#FF9E5E' }}>{avgDisplay}</span>
                            {entry.voteCount > 0 && (
                              <span style={{ fontSize: '0.7rem', color: '#C5A8D5' }}>{entry.voteCount} votes</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#C5A8D5', marginTop: '2px' }}>
                            {new Date(entry.claimedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        </div>
      ) : (
        /* ── Live fites landing ── */
        <div style={{ padding: '32px 24px' }}>
          <LiveFitesLanding navigate={navigate} currentUserId={currentUserId} authToken={authToken} />
        </div>
      )}
    </div>
  );
}

// ── Block number helper ───────────────────────────────────────────────────────

function blockNumber(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String((h % 98) + 1).padStart(2, '0');
}

// ── Hex point generator (pointy-top) ──────────────────────────────────────────

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

// ── Neighborhood mini-map ──────────────────────────────────────────────────────

interface NeighborhoodMiniMapProps {
  territoryId: string;
  blockNum: string;
}

const NEIGHBOR_PALETTE = [
  { color: '#FFD59E', stroke: '#E8A830' },
  { color: '#FFB3C6', stroke: '#E05080' },
  { color: '#B5D8FF', stroke: '#5090D8' },
  { color: '#FFE68A', stroke: '#D8A820' },
  { color: '#B5F0C3', stroke: '#40B860' },
  { color: '#C5B8FF', stroke: '#7058D8' },
];

const NEIGHBOR_LABELS = [
  'Sugar Lane', "Fizzy Ave", 'Blue Berry Block',
  'Sweet Row', 'Mochi Mile', 'Candy Street',
];

function NeighborhoodMiniMap({ territoryId, blockNum }: NeighborhoodMiniMapProps) {
  const CX = 200, CY = 168, R = 68, NR = 50, DIST = 126;

  // Pick neighbour labels deterministically from territory ID
  let seed = 0;
  for (let i = 0; i < territoryId.length; i++) seed = (seed * 31 + territoryId.charCodeAt(i)) >>> 0;
  const labelOffset = seed % NEIGHBOR_LABELS.length;

  const neighbors = NEIGHBOR_PALETTE.map(({ color, stroke }, i) => {
    const a = (Math.PI / 180) * (-90 + i * 60);
    return {
      cx: CX + DIST * Math.cos(a),
      cy: CY + DIST * Math.sin(a),
      color,
      stroke,
      label: NEIGHBOR_LABELS[(i + labelOffset) % NEIGHBOR_LABELS.length]!,
    };
  });

  const patternId = `diag-${blockNum}`;

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1.5px solid #F0D8EC',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '8px 14px',
        background: 'linear-gradient(90deg, #FDF0F8, #F7E8FF)',
        borderBottom: '1px solid #F0D8EC',
        fontSize: '0.67rem',
        fontWeight: 700,
        color: '#9A6AAA',
        letterSpacing: '0.08em',
      }}>
        📍 NEIGHBORHOOD VIEW
      </div>
      <svg viewBox="0 0 400 336" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)">
            <rect width="7" height="14" fill="#FFDDF0" />
            <rect x="7" width="7" height="14" fill="#FFFFFF" />
          </pattern>
        </defs>

        {/* Neighbor hexagons */}
        {neighbors.map(({ cx, cy, color, stroke, label }) => (
          <g key={label}>
            <polygon points={hexPoints(cx, cy, NR)} fill={color} stroke={stroke} strokeWidth="2" opacity="0.85" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" fill="#4A2A6A" fontFamily="system-ui, sans-serif">
              {label}
            </text>
          </g>
        ))}

        {/* Center hex — current territory (striped) */}
        <polygon points={hexPoints(CX, CY, R)} fill={`url(#${patternId})`} stroke="#E8186A" strokeWidth="3" strokeDasharray="9 5" />
        <text x={CX} y={CY - 10} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="900" fill="#D4186A" fontFamily="system-ui, sans-serif">
          YOU
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="900" fill="#D4186A" fontFamily="system-ui, sans-serif">
          HERE
        </text>

        <text x="394" y="330" textAnchor="end" fontSize="8" fill="#C5A8D5" fontFamily="monospace" fontWeight="700">
          BLOCK {blockNum} · 0.014 KM
        </text>
      </svg>
    </div>
  );
}

// ── Candidate colors cycling ──────────────────────────────────────────────────

const CANDIDATE_COLORS = [
  { border: '#FFB800', button: '#E53935', bar: '#FFB800', label: '#7A4100' },
  { border: '#3B6FE8', button: '#3B6FE8', bar: '#3B6FE8', label: '#fff' },
  { border: '#2EB86B', button: '#2EB86B', bar: '#2EB86B', label: '#fff' },
  { border: '#FF6B9E', button: '#FF6B9E', bar: '#FF6B9E', label: '#fff' },
];

function avgRating(c: VoteCandidate): number {
  if (c.votes === 0) return 0;
  return c.totalRating / c.votes;
}

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// ── Live fites landing page ───────────────────────────────────────────────────

interface LiveFitesLandingProps {
  navigate: (path: string) => void;
  currentUserId: string;
  authToken: string;
}

function LiveFitesLanding({ navigate, currentUserId }: LiveFitesLandingProps) {
  const [sessions, setSessions] = useState<VoteSession[]>([]);

  async function loadSessions() {
    const loaded = await voteApi.getActiveSessions();
    setSessions((prev) => {
      // Merge: keep completed ones briefly for winner display, add new active ones
      const byId = new Map(prev.map((s) => [s.id, s]));
      loaded.forEach((s) => byId.set(s.id, { ...byId.get(s.id), ...s }));
      return Array.from(byId.values());
    });
    // Backfill territory names for legacy sessions
    const needsLookup = loaded.filter((s) => !s.territoryName || s.territoryName === s.territoryId);
    if (needsLookup.length === 0) return;
    const resolved = await Promise.all(
      needsLookup.map(async (s) => {
        try {
          const t = await territoryApi.getById(s.territoryId);
          return { id: s.id, name: t.name };
        } catch {
          return null;
        }
      }),
    );
    setSessions((prev) => prev.map((s) => {
      const found = resolved.find((r) => r?.id === s.id);
      return found ? { ...s, territoryName: found.name } : s;
    }));
  }

  useEffect(() => {
    void loadSessions();
    // Poll every 15 s so expired fites get removed promptly
    const interval = setInterval(() => { void loadSessions(); }, 15_000);
    return () => clearInterval(interval);
  }, []);

  function handleCompleted(sessionId: string) {
    // Remove the fite card after a short winner-display delay
    setTimeout(() => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }, 5_000);
  }

  async function handleVote(sessionId: string, candidateId: string, rating: number): Promise<VoteSession | null> {
    try {
      const updated = await voteApi.submitVote(sessionId, { userId: currentUserId, candidateId, rating });
      setSessions((prev) => prev.map((s) => {
        if (s.id !== sessionId) return s;
        const name = (updated.territoryName && updated.territoryName !== updated.territoryId)
          ? updated.territoryName
          : s.territoryName;
        return { ...updated, territoryName: name };
      }));
      if (updated.status === 'completed') handleCompleted(sessionId);
      return updated;
    } catch {
      return null;
    }
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.8rem', fontWeight: 900, color: '#1A0A2E', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          Live fites
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#E53935', display: 'inline-block', boxShadow: '0 0 0 3px rgba(229,57,53,0.2)' }} />
        </h1>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Watch grubs duke it out. Cast your vote in the next 10 minutes.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>

        {/* ── All fites list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sessions.length === 0 ? (
            <div style={{
              background: 'var(--color-surface)',
              border: '2px dashed var(--color-border)',
              borderRadius: '16px',
              padding: '48px 32px',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🍽️</div>
              <p style={{ margin: 0, fontWeight: 700 }}>No live fites right now</p>
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>Start one by picking a block on the map!</p>
            </div>
          ) : (
            sessions.map((s, i) => (
              <FeaturedFite
                key={s.id}
                session={s}
                name={s.territoryName || `Block ${s.territoryId.slice(0, 4).toUpperCase()}`}
                blockLabel={`BLOCK ${String(i + 1).padStart(2, '0')}`}
                currentUserId={currentUserId}
                onVote={(sid, cid, rating) => handleVote(sid, cid, rating)}
                onCompleted={handleCompleted}
              />
            ))
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ margin: '0 0 2px', fontSize: '0.95rem', fontWeight: 900, color: '#1A0A2E' }}>Start your own fite</h2>
          <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '2px' }}>
            Snap a meal photo and pick a block to claim.
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%', background: '#2EB86B', color: '#fff', border: 'none',
              borderRadius: '999px', padding: '11px', fontWeight: 800, fontSize: '0.88rem',
              cursor: 'pointer', letterSpacing: '0.01em', marginBottom: '8px',
            }}
          >
            Pick a block →
          </button>

          {sessions.length > 0 && (
            <>
              <h2 style={{ margin: '4px 0 6px', fontSize: '0.95rem', fontWeight: 900, color: '#1A0A2E' }}>All fites</h2>
              {sessions.map((s, i) => {
                const totalVotes = s.candidates.reduce((sum, c) => sum + c.votes, 0);
                const thumbnail = s.candidates[0]?.photoUrl ?? '';
                return (
                  <div key={s.id} style={{
                    background: '#fff',
                    border: `2px solid ${CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]?.border ?? '#ccc'}`,
                    borderRadius: '12px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
                      background: '#EDE0FF', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {thumbnail
                        ? <img src={thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '1.2rem' }}>🍽️</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#1A0A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.territoryName || `Block ${s.territoryId.slice(0, 4).toUpperCase()}`}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: '#999' }}>
                        {totalVotes} votes · {s.candidates.length} grubs · {timeLeft(s.endsAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Featured fite card ────────────────────────────────────────────────────────

interface FeaturedFiteProps {
  session: VoteSession;
  name: string;
  blockLabel: string;
  currentUserId: string;
  onVote: (sessionId: string, candidateId: string, rating: number) => Promise<VoteSession | null>;
  onCompleted?: (sessionId: string) => void;
}

function FeaturedFite({ session, name, blockLabel, currentUserId, onVote, onCompleted }: FeaturedFiteProps) {
  const [voting, setVoting] = useState<string | null>(null);
  const [localSession, setLocalSession] = useState(session);
  const [tick, setTick] = useState(0);
  const [ratingCardId, setRatingCardId] = useState<string | null>(null);
  const [hoverRating, setHoverRating] = useState<{ candidateId: string; star: number } | null>(null);

  useEffect(() => { setLocalSession(session); }, [session]);

  // Live updates via Socket.io so winner is pushed as soon as the timer fires
  useEffect(() => {
    const socket = io('/', { path: '/ws/vote', transports: ['websocket'], query: { sessionId: session.id } });
    socket.on('session:update', (updated: VoteSession) => {
      setLocalSession(updated);
      if (updated.status === 'completed') onCompleted?.(session.id);
    });
    socket.emit('join-session', session.id);
    return () => { socket.disconnect(); };
  }, [session.id, onCompleted]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  void tick;

  const myRatedIds: string[] = currentUserId ? (localSession.votesByUser[currentUserId] ?? []) : [];
  const hasVotedForAny = myRatedIds.length > 0;

  const maxVotes = Math.max(...localSession.candidates.map((c) => c.votes), 1);
  const leaderId = localSession.candidates.reduce(
    (best, c) => (c.votes > (best?.votes ?? -1) ? c : best),
    localSession.candidates[0],
  )?.id;

  async function handleVote(candidateId: string, rating: number) {
    if (voting !== null) return;
    const target = localSession.candidates.find((c) => c.id === candidateId);
    if (target && currentUserId && target.userId === currentUserId) return;
    if (myRatedIds.includes(candidateId)) return;
    setVoting(candidateId);
    setRatingCardId(null);
    try {
      const updated = await onVote(session.id, candidateId, rating);
      if (updated) setLocalSession(updated);
    } finally { setVoting(null); }
  }

  const isCompleted = localSession.status === 'completed';
  const winner = isCompleted ? localSession.candidates.find((c) => c.userId === localSession.winnerId) : null;

  if (isCompleted) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #FFF8E1, #FFFDE7)',
        border: '3px solid #FFD54F',
        borderRadius: '16px',
        padding: '20px',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(255,213,79,0.3)',
      }}>
        <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>🏆</div>
        <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1A0A2E', marginBottom: '2px' }}>{name}</div>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#7A5490', marginBottom: '8px' }}>
          Fight over! <strong>{winner?.displayName ?? 'Someone'}</strong> claimed this block.
        </div>
        <div style={{ fontSize: '0.72rem', color: '#AAA', fontWeight: 600 }}>
          Disappearing in a moment…
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      border: '3px solid #FFB800',
      borderRadius: '16px',
      padding: '14px',
      boxShadow: '0 4px 24px rgba(255,184,0,0.15)',
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            background: '#E53935', color: '#fff', fontSize: '0.72rem', fontWeight: 900,
            padding: '4px 10px', borderRadius: '999px', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            LIVE
          </span>
          <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#1A0A2E' }}>{name}</span>
        </div>
        <span style={{ fontSize: '0.78rem', color: '#999', fontWeight: 700, letterSpacing: '0.04em' }}>
          {blockLabel} · CLOSES {timeLeft(localSession.endsAt)}
        </span>
      </div>

      {/* Voted banner */}
      {hasVotedForAny && (
        <div style={{
          background: '#F0FFF4', border: '1.5px solid #2EB86B', borderRadius: '10px',
          padding: '8px 14px', marginBottom: '12px', fontSize: '0.8rem',
          color: '#1A6641', fontWeight: 700, textAlign: 'center',
        }}>
          ✓ You rated {myRatedIds.length} dish{myRatedIds.length !== 1 ? 'es' : ''} — keep rating the others!
        </div>
      )}

      {/* Candidates */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(localSession.candidates.length, 3)}, 1fr)`, gap: '8px', marginBottom: '12px' }}>
        {localSession.candidates.slice(0, 3).map((c, i) => {
          const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]!;
          const isLeading = c.id === leaderId && c.votes > 0;
          const isVotedFor = myRatedIds.includes(c.id);
          const isOwnDish = Boolean(currentUserId && c.userId === currentUserId);
          const rating = avgRating(c);
          const barPct = maxVotes > 0 ? (c.votes / maxVotes) * 100 : 0;
          const buttonDisabled = voting !== null || isOwnDish || isVotedFor;
          const showRatingPicker = ratingCardId === c.id;
          const myRatingForThis = localSession.ratingByUser?.[currentUserId]?.[c.id] ?? null;

          return (
            <div key={c.id} style={{
              border: `2.5px solid ${isVotedFor ? '#2EB86B' : color.border}`,
              borderRadius: '14px',
              overflow: 'hidden',
              background: isVotedFor ? '#F0FFF4' : '#FAFAFA',
              position: 'relative',
            }}>
              {isLeading && (
                <div style={{
                  position: 'absolute', top: '6px', left: '6px', zIndex: 2,
                  background: '#FFB800', color: '#7A4100', fontSize: '0.58rem', fontWeight: 900,
                  padding: '2px 6px', borderRadius: '999px', letterSpacing: '0.06em',
                }}>
                  LEADING
                </div>
              )}

              {/* Photo area — fixed height so cards stay compact */}
              <div style={{ width: '100%', height: '120px', background: '#EDE0FF', position: 'relative', overflow: 'hidden' }}>
                {c.photoUrl ? (
                  <img src={c.photoUrl} alt={c.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: 'repeating-linear-gradient(135deg, #EDE0FF 0px, #EDE0FF 10px, #E0CFFF 10px, #E0CFFF 20px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                  }}>
                    🍽️
                  </div>
                )}
                {/* Monster avatar */}
                <div style={{
                  position: 'absolute', bottom: '6px', right: '6px',
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: color.button, border: '2px solid #fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}>
                  🐾
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: '8px 8px 10px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#1A0A2E', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.displayName}
                  {isOwnDish && (
                    <span style={{ fontSize: '0.62rem', marginLeft: '5px', fontWeight: 900, color: '#B8860B' }}>(you)</span>
                  )}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: '5px' }}>
                  ★ {rating > 0 ? rating.toFixed(1) : '—'} · {c.votes} VOTES
                </div>

                {/* Progress bar */}
                <div style={{ height: '3px', background: '#EEE', borderRadius: '999px', marginBottom: '8px' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: isVotedFor ? '#2EB86B' : color.bar, borderRadius: '999px', transition: 'width 0.3s' }} />
                </div>

                {/* Vote area — own dish is not votable */}
                {isOwnDish ? (
                  <div
                    title="You can't vote for your own dish"
                    style={{
                      width: '100%',
                      borderRadius: '999px',
                      padding: '8px 6px',
                      fontWeight: 800,
                      fontSize: '0.68rem',
                      textAlign: 'center',
                      color: '#8A6080',
                      background: 'rgba(240,220,235,0.9)',
                      border: '1.5px dashed rgba(180,120,160,0.45)',
                      lineHeight: 1.25,
                    }}
                  >
                    Your dish — voting disabled
                  </div>
                ) : isVotedFor ? (
                  <div style={{
                    width: '100%', borderRadius: '999px', padding: '6px 0',
                    background: '#2EB86B', color: '#fff',
                    fontWeight: 800, fontSize: '0.75rem', textAlign: 'center',
                  }}>
                    ✓ Rated {myRatingForThis != null ? `${myRatingForThis}/10` : ''}
                  </div>
                ) : showRatingPicker ? (
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '0.68rem', color: '#7A5490', fontWeight: 700, textAlign: 'center' }}>
                      Rate 1–10:
                    </p>
                    <div style={{ display: 'flex', gap: '1px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {[1,2,3,4,5,6,7,8,9,10].map((star) => {
                        const isHovered = hoverRating?.candidateId === c.id && star <= hoverRating.star;
                        return (
                          <button
                            key={star}
                            type="button"
                            disabled={voting === c.id}
                            title={`Rate ${star}/10`}
                            style={{
                              background: 'none', border: 'none',
                              cursor: voting === c.id ? 'not-allowed' : 'pointer',
                              fontSize: '0.9rem', padding: '1px', lineHeight: 1,
                              opacity: voting === c.id ? 0.5 : 1,
                            }}
                            onMouseEnter={() => setHoverRating({ candidateId: c.id, star })}
                            onMouseLeave={() => setHoverRating(null)}
                            onClick={() => void handleVote(c.id, star)}
                          >
                            {isHovered ? '⭐' : '☆'}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRatingCardId(null)}
                      style={{ marginTop: '3px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#9A78A0', fontSize: '0.65rem', fontWeight: 600 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRatingCardId(c.id)}
                    disabled={buttonDisabled}
                    style={{
                      width: '100%',
                      background: buttonDisabled ? '#CCC' : color.button,
                      color: '#fff',
                      border: 'none', borderRadius: '999px', padding: '6px 0',
                      fontWeight: 800, fontSize: '0.75rem',
                      cursor: buttonDisabled ? 'not-allowed' : 'pointer',
                      opacity: voting === c.id ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    }}
                  >
                    {voting === c.id ? '…' : '♥ Vote'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Watching footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #F0E8FF', paddingTop: '10px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#999', letterSpacing: '0.06em' }}>
          {localSession.candidates.reduce((s, c) => s + c.votes, 0)} GRUBS WATCHING
        </span>
        <div style={{ display: 'flex', gap: '-6px' }}>
          {localSession.candidates.slice(0, 5).map((c, i) => (
            <div key={c.id} style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]?.button ?? '#ccc',
              border: '2px solid #fff', marginLeft: i > 0 ? '-8px' : '0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', zIndex: 5 - i,
            }}>
              🐾
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
