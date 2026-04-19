import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import { AUTH_DISABLED, DEV_USER_ID } from '../config/devAuth';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { VotingRoom } from '../components/voting/VotingRoom';
import { Lightbox } from '../components/ui/Lightbox';
import { voteApi, type VoteSession } from '../api/voteApi';
import { territoryApi, type ClaimHistoryEntry } from '../api/territoryApi';

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
  const [claimed, setClaimed] = useState(false);

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
        setClaimed(true);
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

  // ── Claimed success ─────────────────────────────────────────────────────────

  if (claimed) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <Navbar />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)', gap: '16px', padding: '32px' }}>
          <div style={{ fontSize: '4rem' }}>🎉</div>
          <h1 style={{ margin: 0, color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
            Territory Claimed!
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            <strong>{territory?.name}</strong> is yours. Challenge it anytime!
          </p>
          <button className="primary-button" onClick={() => navigate('/')} style={{ marginTop: '8px' }}>
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  // ── Territory gallery + upload ──────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 16px' }}>

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
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚔️</div>
            <h1 style={{ margin: '0 0 8px', color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
              Territory Gallery
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 24px' }}>
              Tap a territory on the map and hit <strong>Claim Territory</strong> to start a battle.
            </p>
            <button className="primary-button" onClick={() => navigate('/')}>
              Go to Map
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
