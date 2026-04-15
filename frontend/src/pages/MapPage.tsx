import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import type { VoteSession } from '../api/voteApi';
import { AUTH_DISABLED, DEV_USER_ID } from '../config/devAuth';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { MapView } from '../components/map/MapView';
import { UploadModal } from '../components/voting/UploadModal';
import { WinnerAnnouncement } from '../components/voting/WinnerAnnouncement';
import { VotingRoom } from '../components/voting/VotingRoom';

export function MapPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [claimingTerritory, setClaimingTerritory] = useState<Territory | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<VoteSession | null>(null);

  function handleClaim(territory: Territory) {
    if (!AUTH_DISABLED && !isAuthenticated) {
      // Send the user to login, then bounce them back to the map.
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    setClaimingTerritory(territory);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />

      {/* Map fills all remaining height */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapView onClaim={handleClaim} />
      </div>

      {/* Live vote room — floats over the map when a session is active */}
      {activeSessionId && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          zIndex: 'var(--z-panel)' as never,
          width: 'clamp(300px, 40vw, 480px)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}>
          <VotingRoom
            sessionId={activeSessionId}
            currentUserId={AUTH_DISABLED ? DEV_USER_ID : (user?.id ?? 'guest')}
            onCompleted={(session) => {
              setCompletedSession(session);
              setActiveSessionId(null);
            }}
          />
        </div>
      )}

      <UploadModal
        isOpen={claimingTerritory !== null}
        territoryId={claimingTerritory?.id ?? ''}
        onClose={() => setClaimingTerritory(null)}
        onSessionCreated={(sessionId) => {
          setCompletedSession(null);
          setActiveSessionId(sessionId);
          setClaimingTerritory(null);
        }}
      />

      <WinnerAnnouncement
        session={completedSession}
        onDismiss={() => {
          setCompletedSession(null);
          setActiveSessionId(null);
        }}
      />
    </div>
  );
}
