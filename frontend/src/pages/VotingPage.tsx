import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import { AUTH_DISABLED, DEV_USER_ID } from '../config/devAuth';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { VotingRoom } from '../components/voting/VotingRoom';
import { Lightbox } from '../components/ui/Lightbox';
import { voteApi, type VoteSession, type VoteCandidate } from '../api/voteApi';
import { territoryApi, type ClaimHistoryEntry } from '../api/territoryApi';
import { economyApi } from '../api/economyApi';
import { profileApi } from '../api/profileApi';
import type { ClaimData } from '../components/map/ClaimingMoment';

export function VotingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const territory = (location.state as { territory?: Territory } | null)?.territory ?? null;

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

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!territory || !selectedFile) return;

    setIsSubmitting(true);
    setUploadError(null);

    try {
      const upload = await voteApi.createUploadUrl(selectedFile);
      await voteApi.uploadPhoto(upload.uploadUrl, selectedFile);

      if (!isContested) {
        // Uncontested — direct claim
        await territoryApi.claim(territory.id, authToken, {
          photoKey: upload.photoKey,
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
        // Session exists — add as new candidate
        const updated = await voteApi.addCandidate(activeSession.id, {
          photoKey: upload.photoKey,
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
          photoKey: upload.photoKey,
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <Navbar />
      <div style={territory ? { maxWidth: '800px', margin: '0 auto', padding: '40px 16px' } : { padding: '32px 24px' }}>

        {territory ? (
          <>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <div className="eyebrow">{isContested ? 'Conquered Territory' : 'Unclaimed Territory'}</div>
              <h1 style={{ margin: '4px 0 4px', color: 'var(--color-primary)', fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>
                {territory.name}
              </h1>
              {isContested && (
                <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                  👑 Owned by <strong>{territory.ownerName ?? 'Unknown Foodie'}</strong>
                </p>
              )}
            </div>

            {/* Live voting room — visible to everyone even without uploading */}
            {activeSession && !showUploadForm && (
              <div style={{ marginBottom: '32px' }}>
                <VotingRoom
                  sessionId={activeSession.id}
                  currentUserId={currentUserId}
                  territoryName={territory.name}
                  onBack={() => navigate('/')}
                  onAddDish={() => setShowUploadForm(true)}
                />
              </div>
            )}

            {/* Upload form */}
            {showUploadForm && (
              <div style={{
                background: 'var(--color-surface)',
                border: '2px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: '24px',
                marginBottom: '32px',
              }}>
                <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                  {activeSession ? 'Add your dish to the fight' : isContested ? 'Upload your battle dish' : 'Upload your meal photo'}
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 16px', fontSize: '0.875rem' }}>
                  {activeSession
                    ? 'Submit a photo and join the community rating!'
                    : isContested
                    ? 'The community rates all dishes 1–10. Highest avg score wins!'
                    : "No one owns this spot yet — upload a photo and it's instantly yours."}
                </p>
                <form className="upload-form" onSubmit={handleUploadSubmit}>
                  <label className="upload-dropzone">
                    <input
                      accept="image/*"
                      capture="environment"
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    <span>{selectedFile ? selectedFile.name : '📷 Tap to choose your meal photo'}</span>
                  </label>

                  {previewUrl && (
                    <div className="preview-frame">
                      <img src={previewUrl} alt="Meal preview" className="preview-image" />
                    </div>
                  )}

                  {uploadError && <p className="error-text">{uploadError}</p>}

                  <div className="button-row">
                    <button className="ghost-button" type="button" onClick={() => setShowUploadForm(false)}>
                      Cancel
                    </button>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isSubmitting || !selectedFile}
                    >
                      {isSubmitting
                        ? 'Uploading...'
                        : activeSession ? '🍽️ Add to fight' : isContested ? '⚔️ Start food fight' : '🚩 Claim it!'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* No session yet — show claim/challenge button */}
            {!activeSession && !showUploadForm && (
              <button
                className="primary-button"
                onClick={() => setShowUploadForm(true)}
                style={{ marginBottom: '32px' }}
              >
                {isContested ? '⚔️ Challenge this territory' : '🚩 Claim this territory'}
              </button>
            )}

            {/* Submissions gallery */}
            <section>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#2D1B4E', marginBottom: '16px' }}>
                📸 All submissions at {territory.name}
              </h2>

              {loadingHistory ? (
                <p style={{ color: '#bbb', textAlign: 'center' }}>Loading submissions…</p>
              ) : history.length === 0 ? (
                <p style={{ color: '#bbb', textAlign: 'center' }}>
                  No submissions yet — be the first to claim this spot!
                </p>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '14px',
                }}>
                  {history.map((entry) => {
                    const photoUrl = entry.photoKey ? (photoUrls[entry.photoKey] ?? null) : null;
                    const avgDisplay = entry.avgRating != null
                      ? `⭐ ${entry.avgRating.toFixed(1)}`
                      : entry.isWinner ? '👑 Winner' : '—';

                    return (
                      <div key={entry.id} style={{
                        borderRadius: '14px',
                        overflow: 'hidden',
                        background: entry.isWinner ? '#FFF4E6' : 'var(--color-surface)',
                        border: `2px solid ${entry.isWinner ? '#FFD8A8' : 'var(--color-border)'}`,
                        boxShadow: entry.isWinner ? '0 2px 12px rgba(255,180,60,0.18)' : undefined,
                      }}>
                        {/* Photo */}
                        <div
                          onClick={() => photoUrl && setLightboxSrc(photoUrl)}
                          style={{ width: '100%', aspectRatio: '1', background: '#F5E8FF', position: 'relative', overflow: 'hidden', cursor: photoUrl ? 'zoom-in' : 'default' }}
                        >
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt="Submission"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                              🍽️
                            </div>
                          )}
                          {entry.isWinner && (
                            <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#FFD8A8', borderRadius: '999px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 800, color: '#7A4100' }}>
                              👑 Owner
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2D1B4E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.claimantName}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#FF9E5E' }}>{avgDisplay}</span>
                            {entry.voteCount > 0 && (
                              <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{entry.voteCount} votes</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#bbb', marginTop: '2px' }}>
                            {new Date(entry.claimedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <LiveFitesLanding navigate={navigate} currentUserId={currentUserId} authToken={authToken} />
        )}
      </div>
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

  useEffect(() => {
    voteApi.getActiveSessions().then(async (loaded) => {
      setSessions(loaded);
      // For legacy sessions where territoryName wasn't stored, fetch from territory service
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
    });
  }, []);

  async function handleVote(sessionId: string, candidateId: string): Promise<VoteSession | null> {
    try {
      const updated = await voteApi.submitVote(sessionId, { userId: currentUserId, candidateId, rating: 5 });
      setSessions((prev) => prev.map((s) => {
        if (s.id !== sessionId) return s;
        // Preserve locally-resolved territory name if backend didn't return one
        const name = (updated.territoryName && updated.territoryName !== updated.territoryId)
          ? updated.territoryName
          : s.territoryName;
        return { ...updated, territoryName: name };
      }));
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
                onVote={handleVote}
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
  onVote: (sessionId: string, candidateId: string) => Promise<VoteSession | null>;
}

function FeaturedFite({ session, name, blockLabel, currentUserId, onVote }: FeaturedFiteProps) {
  const [voting, setVoting] = useState<string | null>(null);
  const [localSession, setLocalSession] = useState(session);
  const [tick, setTick] = useState(0);

  useEffect(() => { setLocalSession(session); }, [session]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  void tick;

  const hasVoted = currentUserId
    ? (localSession.votesByUser[currentUserId]?.length ?? 0) > 0
    : false;

  const maxVotes = Math.max(...localSession.candidates.map((c) => c.votes), 1);
  const leaderId = localSession.candidates.reduce(
    (best, c) => (c.votes > (best?.votes ?? -1) ? c : best),
    localSession.candidates[0],
  )?.id;

  async function handleVote(candidateId: string) {
    if (hasVoted || voting !== null) return;
    setVoting(candidateId);
    try {
      const updated = await onVote(session.id, candidateId);
      if (updated) setLocalSession(updated);
    } finally { setVoting(null); }
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
      {hasVoted && (
        <div style={{
          background: '#F0FFF4', border: '1.5px solid #2EB86B', borderRadius: '10px',
          padding: '8px 14px', marginBottom: '12px', fontSize: '0.8rem',
          color: '#1A6641', fontWeight: 700, textAlign: 'center',
        }}>
          ✓ You voted in this fite!
        </div>
      )}

      {/* Candidates */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(localSession.candidates.length, 3)}, 1fr)`, gap: '8px', marginBottom: '12px' }}>
        {localSession.candidates.slice(0, 3).map((c, i) => {
          const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]!;
          const isLeading = c.id === leaderId && c.votes > 0;
          const isVotedFor = currentUserId ? (localSession.votesByUser[currentUserId] ?? []).includes(c.id) : false;
          const rating = avgRating(c);
          const barPct = maxVotes > 0 ? (c.votes / maxVotes) * 100 : 0;
          const buttonDisabled = hasVoted || voting !== null;

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
                </div>
                <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: '5px' }}>
                  ★ {rating > 0 ? rating.toFixed(1) : '—'} · {c.votes} VOTES
                </div>

                {/* Progress bar */}
                <div style={{ height: '3px', background: '#EEE', borderRadius: '999px', marginBottom: '8px' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: isVotedFor ? '#2EB86B' : color.bar, borderRadius: '999px', transition: 'width 0.3s' }} />
                </div>

                {/* Vote button */}
                <button
                  onClick={() => handleVote(c.id)}
                  disabled={buttonDisabled}
                  style={{
                    width: '100%',
                    background: isVotedFor ? '#2EB86B' : buttonDisabled ? '#CCC' : color.button,
                    color: '#fff',
                    border: 'none', borderRadius: '999px', padding: '6px 0',
                    fontWeight: 800, fontSize: '0.75rem',
                    cursor: buttonDisabled ? 'not-allowed' : 'pointer',
                    opacity: voting === c.id ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}
                >
                  {voting === c.id ? '…' : isVotedFor ? '✓ Voted' : hasVoted ? 'Voted' : '♥ Vote'}
                </button>
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
