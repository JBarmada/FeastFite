import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { voteApi, type VoteSession } from '../../api/voteApi';
import { Lightbox } from '../ui/Lightbox';

interface VotingRoomProps {
  sessionId: string;
  currentUserId: string;
  territoryName?: string;
  onBack?: () => void;
  onAddDish?: () => void;
  onCompleted?: (session: VoteSession) => void;
}

let socket: Socket | null = null;

export function VotingRoom({ sessionId, currentUserId, territoryName, onBack, onAddDish, onCompleted }: VotingRoomProps) {
  const [session, setSession] = useState<VoteSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const [hoverRating, setHoverRating] = useState<{ candidateId: string; star: number } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    voteApi.getSession(sessionId)
      .then((s) => {
        if (!isMounted) return;
        setSession(s);
        if (s.status === 'completed') onCompleted?.(s);
      })
      .catch((e) => { console.error(e); if (isMounted) setError('This vote room melted away.'); });
    return () => { isMounted = false; };
  }, [sessionId, onCompleted]);

  useEffect(() => {
    socket = io('/', { path: '/ws/vote', transports: ['websocket'], query: { sessionId } });
    socket.on('session:update', (s: VoteSession) => {
      setSession(s);
      if (s.status === 'completed') onCompleted?.(s);
    });
    socket.emit('join-session', sessionId);
    return () => { socket?.disconnect(); socket = null; };
  }, [sessionId, onCompleted]);

  const myRatedIds: string[] = session?.votesByUser[currentUserId] ?? [];
  const myRatings: Record<string, number> = session?.ratingByUser?.[currentUserId] ?? {};
  const myCandidate = session?.candidates.find((c) => c.userId === currentUserId);
  const totalVotes = session?.candidates.reduce((sum, c) => sum + c.votes, 0) ?? 0;

  async function handleRate(candidateId: string, rating: number) {
    setVotingFor(candidateId);
    setError(null);
    try {
      const nextSession = await voteApi.submitVote(sessionId, { userId: currentUserId, candidateId, rating });
      setSession(nextSession);
      if (nextSession.status === 'completed') onCompleted?.(nextSession);
    } catch (e) {
      console.error(e);
      setError("Your rating didn't stick. Another hungry monster may have clicked first.");
    } finally {
      setVotingFor(null);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    setError(null);
    try {
      const updated = await voteApi.finalizeSession(sessionId);
      if (updated) {
        setSession(updated);
        onCompleted?.(updated);
      }
    } catch (e) {
      console.error(e);
      setError('Could not declare winner right now.');
    } finally {
      setFinalizing(false);
    }
  }

  if (!session) {
    return (
      <section className="candy-card vote-room">
        <p>Warming up the jellybean judges...</p>
      </section>
    );
  }

  if (session.status === 'completed') {
    const winner = session.candidates.find((c) => c.userId === session.winnerId);
    return (
      <section className="candy-card vote-room">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: '3rem' }}>🏆</div>
          <h2 style={{ color: '#FFD700', margin: '8px 0 4px' }}>Fight Over!</h2>
          <p style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
            {winner?.displayName ?? 'Someone'} won this territory!
          </p>
          {onBack && (
            <button type="button" onClick={onBack} className="primary-button" style={{ marginTop: '16px' }}>
              ← Back to Map
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <section className="candy-card vote-room">
        <div className="vote-room-header">
          <div>
            <div className="eyebrow">Community Food Fight</div>
            <h2 style={{ margin: 0, fontSize: '0.95rem' }}>{territoryName ?? session.territoryId.slice(0, 8) + '…'}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(255,255,255,0.25)', border: '1.5px solid rgba(255,255,255,0.5)',
              borderRadius: '999px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#fff',
            }}>
              🍽️ {session.candidates.length} dishes
            </span>
            {onBack && (
              <button type="button" onClick={onBack} style={{
                background: 'rgba(255,255,255,0.25)', border: '1.5px solid rgba(255,255,255,0.5)',
                borderRadius: '999px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700,
                cursor: 'pointer', color: '#fff',
              }}>
                ← Map
              </button>
            )}
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {/* Add dish prompt */}
        {!myCandidate && onAddDish && (
          <div style={{ textAlign: 'center', margin: '12px 0', padding: '12px', background: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
              Eaten here? Add your dish and join the fight!
            </p>
            <button type="button" onClick={onAddDish} style={{
              background: '#fff', color: '#A020C8', border: 'none', borderRadius: '999px',
              padding: '6px 18px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem',
            }}>
              📷 Submit my dish
            </button>
          </div>
        )}

        <div className="candidate-grid">
          {session.candidates.map((candidate) => {
            const alreadyRated = myRatedIds.includes(candidate.id);
            const myRating = myRatings[candidate.id] ?? null;
            const isSubmitting = votingFor === candidate.id;
            const avgRating = candidate.votes > 0
              ? (candidate.totalRating / candidate.votes).toFixed(1)
              : '–';
            const isOwnDish = candidate.userId === currentUserId;

            return (
              <article className="candidate-card" key={candidate.id}>
                {/* Clickable photo */}
                <div
                  className="candidate-photo"
                  onClick={() => candidate.photoUrl && setLightboxSrc(candidate.photoUrl)}
                  style={{ cursor: 'zoom-in', position: 'relative' }}
                >
                  <img
                    alt={`${candidate.displayName} dish`}
                    className="candidate-photo-image"
                    src={candidate.photoUrl}
                  />
                  <div style={{
                    position: 'absolute', bottom: '6px', right: '6px',
                    background: 'rgba(0,0,0,0.45)', borderRadius: '6px',
                    padding: '2px 6px', fontSize: '0.65rem', color: '#fff',
                  }}>
                    🔍 tap
                  </div>
                </div>

                <h3 style={{ margin: '6px 0 2px', fontSize: '0.9rem' }}>
                  {candidate.displayName}
                  {isOwnDish && <span style={{ fontSize: '0.7rem', marginLeft: '6px', color: '#FFD700' }}>★ Yours</span>}
                </h3>

                <p className="vote-total" style={{ margin: '0 0 8px', fontSize: '0.78rem' }}>
                  ⭐ {avgRating} avg &nbsp;·&nbsp; {candidate.votes} rated
                </p>

                {!alreadyRated && !isOwnDish && (
                  <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => {
                      const isHovered =
                        hoverRating?.candidateId === candidate.id && star <= hoverRating.star;
                      return (
                        <button
                          key={star}
                          type="button"
                          disabled={isSubmitting}
                          title={`Rate ${star}/10`}
                          style={{
                            background: 'none', border: 'none',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            fontSize: '1.1rem', padding: '1px', lineHeight: 1,
                            opacity: isSubmitting ? 0.5 : 1,
                          }}
                          onMouseEnter={() => setHoverRating({ candidateId: candidate.id, star })}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => void handleRate(candidate.id, star)}
                        >
                          {isHovered ? '⭐' : '☆'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isOwnDish && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                    Others are rating your dish!
                  </p>
                )}

                {alreadyRated && myRating !== null && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#A020C8', fontWeight: 700 }}>
                    You rated: {'⭐'.repeat(myRating)} ({myRating}/10)
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {/* Declare winner button */}
        {totalVotes > 0 && (
          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', margin: '0 0 10px' }}>
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} cast · auto-closes at 3 votes per dish
            </p>
            <button
              type="button"
              onClick={() => void handleFinalize()}
              disabled={finalizing}
              style={{
                background: '#FFD700', color: '#3B1F00', border: 'none',
                borderRadius: '999px', padding: '8px 24px',
                fontWeight: 800, cursor: finalizing ? 'not-allowed' : 'pointer',
                fontSize: '0.88rem', opacity: finalizing ? 0.6 : 1,
              }}
            >
              {finalizing ? 'Declaring...' : '🏆 Declare Winner Now'}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
