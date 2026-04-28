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

function useCountdown(endsAt: string | undefined) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) { setLabel('Time\'s up!'); return; }
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      const label = m > 0
        ? `${m}m ${String(s).padStart(2, '0')}s`
        : `${s}s`;
      setLabel(`${label} remaining!`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return label;
}

export function VotingRoom({ sessionId, currentUserId, territoryName, onBack, onAddDish, onCompleted }: VotingRoomProps) {
  const [session, setSession] = useState<VoteSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const [ratingCardId, setRatingCardId] = useState<string | null>(null);
  const [hoverRating, setHoverRating] = useState<{ candidateId: string; star: number } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const countdown = useCountdown(session?.endsAt);

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
  const bestAvg = session?.candidates.reduce((best, c) => {
    if (c.votes === 0) return best;
    const avg = c.totalRating / c.votes;
    return avg > best ? avg : best;
  }, 0) ?? 0;

  async function handleRate(candidateId: string, rating: number) {
    setVotingFor(candidateId);
    setError(null);
    try {
      const nextSession = await voteApi.submitVote(sessionId, { userId: currentUserId, candidateId, rating });
      setSession(nextSession);
      setRatingCardId(null);
      if (nextSession.status === 'completed') onCompleted?.(nextSession);
    } catch (e) {
      console.error(e);
      setError("Rating fizzled out — try again!");
    } finally {
      setVotingFor(null);
    }
  }

  if (!session) {
    return (
      <section className="candy-card vote-room" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🍬</div>
        <p style={{ color: '#2D1040', fontWeight: 700 }}>Warming up the jellybean judges...</p>
      </section>
    );
  }

  if (session.status === 'completed') {
    const winner = session.candidates.find((c) => c.userId === session.winnerId);
    return (
      <section className="candy-card vote-room" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🏆</div>
        <h2 style={{ color: '#2D1040', fontFamily: 'var(--font-display)', fontSize: '1.8rem', margin: '0 0 8px' }}>
          Fight Over!
        </h2>
        <p style={{ color: '#7A5490', margin: '0 0 20px', fontWeight: 700 }}>
          {winner?.displayName ?? 'Someone'} won this territory!
        </p>
        {onBack && (
          <button type="button" onClick={onBack} className="primary-button">
            ← Back to Map
          </button>
        )}
      </section>
    );
  }

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <section className="candy-card vote-room">
        {/* Timer */}
        {countdown && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span className="timer-pill">⏳ {countdown}</span>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#2D1040', fontFamily: 'var(--font-display)' }}>
            Community: Food Fight full swing!
          </h2>
          <p style={{ margin: '4px 0 0', color: '#7A5490', fontSize: '0.82rem' }}>
            {territoryName ?? ''} · {session.candidates.length} dishes competing
          </p>
        </div>

        {/* Nav row */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
          {onBack && (
            <button type="button" onClick={onBack} style={{
              background: 'rgba(255,255,255,0.5)', border: '1.5px solid rgba(160,80,180,0.3)',
              borderRadius: '999px', padding: '5px 14px', fontSize: '0.8rem', fontWeight: 700,
              cursor: 'pointer', color: '#7A5490',
            }}>
              ← Map
            </button>
          )}
          {!myCandidate && onAddDish && (
            <button type="button" onClick={onAddDish} style={{
              background: 'rgba(255,255,255,0.5)', border: '1.5px solid rgba(160,80,180,0.3)',
              borderRadius: '999px', padding: '5px 14px', fontSize: '0.8rem', fontWeight: 700,
              cursor: 'pointer', color: '#A020C8',
            }}>
              📷 Add my dish
            </button>
          )}
        </div>

        {error && <p className="error-text" style={{ textAlign: 'center' }}>{error}</p>}

        {/* Candidates */}
        <div className="candidate-grid">
          {session.candidates.map((candidate) => {
            const alreadyRated = myRatedIds.includes(candidate.id);
            const myRating = myRatings[candidate.id] ?? null;
            const isSubmitting = votingFor === candidate.id;
            const avgRating = candidate.votes > 0 ? candidate.totalRating / candidate.votes : null;
            const avgDisplay = avgRating != null ? avgRating.toFixed(1) : '–';
            const isOwnDish = candidate.userId === currentUserId;
            const isLeading = avgRating != null && bestAvg > 0 && avgRating === bestAvg && candidate.votes > 0;
            const showRating = ratingCardId === candidate.id;

            return (
              <article className="candidate-card" key={candidate.id}>
                {/* Photo */}
                <div
                  className="candidate-photo"
                  onClick={() => candidate.photoUrl && setLightboxSrc(candidate.photoUrl)}
                  style={{ cursor: 'zoom-in' }}
                >
                  <img
                    alt={`${candidate.displayName} dish`}
                    className="candidate-photo-image"
                    src={candidate.photoUrl}
                  />
                  {/* Rating badge */}
                  <div className={`rating-badge${isLeading ? ' rating-badge-gold' : ''}`} style={
                    isLeading
                      ? { background: 'linear-gradient(135deg, #FFE566, #FFB800)', color: '#3B1F00' }
                      : { background: 'rgba(255,255,255,0.85)', color: '#2D1040' }
                  }>
                    {avgDisplay}
                  </div>
                  {isLeading && (
                    <div style={{
                      position: 'absolute', top: '10px', right: '10px',
                      fontSize: '1.4rem',
                    }}>⭐</div>
                  )}
                </div>

                {/* Info */}
                <div className="candidate-card-body">
                  <h3 style={{ margin: '0 0 2px', fontSize: '0.9rem', color: '#2D1040', fontWeight: 800 }}>
                    {candidate.displayName}
                    {isOwnDish && <span style={{ fontSize: '0.7rem', marginLeft: '6px', color: '#FFB800' }}>★ Yours</span>}
                  </h3>
                  <p className="vote-total">
                    Top Dish: {avgDisplay} stars · {candidate.votes} rated
                  </p>

                  {/* Action area */}
                  {isOwnDish ? (
                    <p style={{ fontSize: '0.78rem', color: '#7A5490', fontWeight: 600, margin: '8px 0 0' }}>
                      Others are rating your dish!
                    </p>
                  ) : alreadyRated ? (
                    <p style={{ fontSize: '0.78rem', color: '#A020C8', fontWeight: 700, margin: '8px 0 0' }}>
                      You rated: {'⭐'.repeat(Math.min(myRating ?? 0, 5))} ({myRating}/10)
                    </p>
                  ) : showRating ? (
                    <div>
                      <p style={{ margin: '8px 0 6px', fontSize: '0.78rem', color: '#7A5490', fontWeight: 600, textAlign: 'center' }}>
                        Rate 1–10:
                      </p>
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {[1,2,3,4,5,6,7,8,9,10].map((star) => {
                          const isHovered = hoverRating?.candidateId === candidate.id && star <= hoverRating.star;
                          return (
                            <button
                              key={star}
                              type="button"
                              disabled={isSubmitting}
                              title={`Rate ${star}/10`}
                              style={{
                                background: 'none', border: 'none',
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                fontSize: '1rem', padding: '1px', lineHeight: 1,
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
                      <button
                        type="button"
                        onClick={() => setRatingCardId(null)}
                        style={{ marginTop: '6px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#7A5490', fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="vote-btn"
                      disabled={isSubmitting}
                      onClick={() => setRatingCardId(candidate.id)}
                    >
                      VOTE
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Vote count */}
        {totalVotes > 0 && (
          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1.5px solid rgba(255,255,255,0.4)' }}>
            <p style={{ color: '#7A5490', fontSize: '0.8rem', margin: 0 }}>
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} cast
            </p>
          </div>
        )}
      </section>
    </>
  );
}
