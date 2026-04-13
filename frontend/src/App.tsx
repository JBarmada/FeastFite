import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { UploadModal } from './components/voting/UploadModal';
import { VotingRoom } from './components/voting/VotingRoom';
import { WinnerAnnouncement } from './components/voting/WinnerAnnouncement';
import type { VoteSession } from './api/voteApi';

function Dashboard() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<VoteSession | null>(null);

  return (
    <main className="sweet-shell">
      <section className="hero-panel">
        <div className="monster-badge">
          <span className="monster-face">o</span>
          <span className="monster-face">w</span>
        </div>

        <div className="hero-copy">
          <div className="eyebrow">FeastFite Referee Build</div>
          <h1>Candy-coated territory battles for cute little food monsters</h1>
          <p>
            This Dev C slice covers direct photo upload, live Socket.io voting, and the winner
            reveal that downstream services can consume.
          </p>

          <div className="chip-row">
            <span className="status-chip">MinIO upload</span>
            <span className="status-chip">10-minute room</span>
            <span className="status-chip">RabbitMQ events</span>
          </div>

          <button className="primary-button jumbo-button" onClick={() => setIsUploadOpen(true)}>
            Challenge Sprinkle Square
          </button>
        </div>
      </section>

      <section className="territory-strip">
        <article className="candy-card territory-card">
          <div className="eyebrow">Featured Territory</div>
          <h2>Sprinkle Square</h2>
          <p className="muted">
            The marshmallow mayor is defending a syrupy plaza. Upload a battle meal to open a live
            vote room.
          </p>
        </article>
      </section>

      {activeSessionId && (
        <VotingRoom
          currentUserId="spectator-sundae"
          onCompleted={setCompletedSession}
          sessionId={activeSessionId}
        />
      )}

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSessionCreated={(sessionId) => {
          setCompletedSession(null);
          setActiveSessionId(sessionId);
        }}
        territoryId="sprinkle-square"
      />

      <WinnerAnnouncement
        onDismiss={() => {
          setCompletedSession(null);
          setActiveSessionId(null);
        }}
        session={completedSession}
      />
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Dashboard />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
