import { useEffect } from 'react';
import type { VoteSession } from '../../api/voteApi';

interface WinnerAnnouncementProps {
  session: VoteSession | null;
  onDismiss: () => void;
}

export function WinnerAnnouncement({ session, onDismiss }: WinnerAnnouncementProps) {
  useEffect(() => {
    if (session?.status === 'completed') {
      window.dispatchEvent(new CustomEvent('feastfite:sfx', { detail: 'win' }));
    }
  }, [session?.status]);

  if (!session || session.status !== 'completed') {
    return null;
  }

  const winner = session.candidates.find((candidate) => candidate.userId === session.winnerId);

  return (
    <div className="overlay">
      <div className="candy-card winner-card">
        <div className="eyebrow">Sweet Victory</div>
        <h2>{winner?.displayName ?? 'Mystery Munchie'} wins the territory!</h2>
        <p className="muted">
          The map can now repaint territory <strong>{session.territoryId}</strong> with the winning
          dish photo key <code>{session.winnerPhotoKey}</code>.
        </p>
        <button className="primary-button" onClick={onDismiss} type="button">
          Back to the candy map
        </button>
      </div>
    </div>
  );
}
