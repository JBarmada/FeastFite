import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { voteApi, type VoteSession } from '../../api/voteApi';

interface VotingRoomProps {
  sessionId: string;
  currentUserId: string;
  onCompleted: (session: VoteSession) => void;
}

let socket: Socket | null = null;

export function VotingRoom({ sessionId, currentUserId, onCompleted }: VotingRoomProps) {
  const [session, setSession] = useState<VoteSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let isMounted = true;

    voteApi
      .getSession(sessionId)
      .then((nextSession) => {
        if (!isMounted) return;
        setSession(nextSession);
        if (nextSession.status === 'completed') {
          onCompleted(nextSession);
        }
      })
      .catch((sessionError) => {
        console.error(sessionError);
        if (isMounted) {
          setError('This vote room melted away.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [onCompleted, sessionId]);

  useEffect(() => {
    socket = io('/', {
      path: '/ws/vote',
      transports: ['websocket'],
      query: { sessionId },
    });

    socket.on('session:update', (nextSession: VoteSession) => {
      setSession(nextSession);
      if (nextSession.status === 'completed') {
        onCompleted(nextSession);
      }
    });

    socket.on('session:completed', () => {
      void voteApi.getSession(sessionId).then((nextSession) => {
        setSession(nextSession);
        onCompleted(nextSession);
      });
    });

    socket.emit('join-session', sessionId);

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [onCompleted, sessionId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const secondsRemaining = useMemo(() => {
    if (!session) return 0;
    return Math.max(Math.ceil((new Date(session.endsAt).getTime() - now) / 1000), 0);
  }, [now, session]);

  async function handleVote(candidateId: string) {
    setIsVoting(true);
    setError(null);

    try {
      const nextSession = await voteApi.submitVote(sessionId, {
        userId: currentUserId,
        candidateId,
      });

      setSession(nextSession);
    } catch (voteError) {
      console.error(voteError);
      setError('Your vote did not stick. Another hungry monster may have clicked first.');
    } finally {
      setIsVoting(false);
    }
  }

  if (!session) {
    return (
      <section className="candy-card vote-room">
        <p>Warming up the jellybean judges...</p>
      </section>
    );
  }

  return (
    <section className="candy-card vote-room">
      <div className="vote-room-header">
        <div>
          <div className="eyebrow">Live Voting Room</div>
          <h2>Territory {session.territoryId}</h2>
        </div>
        <div className="countdown-pill">{secondsRemaining}s left</div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="candidate-grid">
        {session.candidates.map((candidate) => {
          const hasVotedForCandidate = session.votesByUser[currentUserId] === candidate.id;

          return (
            <article className="candidate-card" key={candidate.id}>
              <div className="candidate-photo">
                <span>{candidate.photoKey.split('/').pop()}</span>
              </div>
              <h3>{candidate.displayName}</h3>
              <p className="vote-total">{candidate.votes} sugar stars</p>
              <button
                className={hasVotedForCandidate ? 'secondary-button' : 'primary-button'}
                disabled={isVoting || Boolean(session.votesByUser[currentUserId])}
                onClick={() => void handleVote(candidate.id)}
                type="button"
              >
                {hasVotedForCandidate ? 'Your pick' : 'Vote for this dish'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
