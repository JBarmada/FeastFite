import { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { VotingRoom } from '../components/voting/VotingRoom';
import type { VoteSession } from '../api/voteApi';
import { WinnerAnnouncement } from '../components/voting/WinnerAnnouncement';
import { AUTH_DISABLED, DEV_USER_ID } from '../config/devAuth';

// The full voting lobby — Dev C will extend this with a session list.
export function VotingPage() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<VoteSession | null>(null);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />
      <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{
          color: 'var(--color-primary)', fontFamily: 'var(--font-display)',
          fontSize: '2rem', margin: '0 0 8px',
        }}>
          ⚔️ Voting Arena
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: '32px' }}>
          Active battles across the map — vote for the best dish to decide who owns the territory.
        </p>

        {activeSessionId ? (
          <VotingRoom
            sessionId={activeSessionId}
            currentUserId={AUTH_DISABLED ? DEV_USER_ID : 'current-user'}
            onCompleted={(session) => {
              setCompletedSession(session);
              setActiveSessionId(null);
            }}
          />
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '60px 20px', gap: '12px',
            background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)',
            border: '2px dashed var(--color-border)',
          }}>
            <span style={{ fontSize: '3rem' }}>🍽️</span>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>
              No active sessions right now. Claim a territory on the map to start a battle!
            </p>
          </div>
        )}
      </div>

      <WinnerAnnouncement
        session={completedSession}
        onDismiss={() => setCompletedSession(null)}
      />
    </div>
  );
}
