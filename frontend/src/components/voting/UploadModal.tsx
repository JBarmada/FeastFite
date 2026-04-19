import { useMemo, useState } from 'react';
import type { Territory } from '@feastfite/shared';
import { voteApi } from '../../api/voteApi';
import { territoryApi } from '../../api/territoryApi';

interface UploadModalProps {
  territory: Territory | null;
  currentUserId: string;
  currentUserName: string;
  token: string;
  onClose: () => void;
  /** Called when a contested vote session is created */
  onSessionCreated: (sessionId: string) => void;
  /** Called when an uncontested territory was directly claimed */
  onClaimSuccess: () => void;
}

export function UploadModal({
  territory,
  currentUserId,
  currentUserName,
  token,
  onClose,
  onSessionCreated,
  onClaimSuccess,
}: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile]
  );

  const isContested = Boolean(territory?.ownerId);

  if (!territory) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!territory) return;

    if (!selectedFile) {
      setError('Pick a delicious battle photo first.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upload photo to MinIO
      const upload = await voteApi.createUploadUrl(selectedFile);
      await voteApi.uploadPhoto(upload.uploadUrl, selectedFile);

      if (!isContested) {
        // 2a. Uncontested — direct claim, save photo immediately
        await territoryApi.claim(territory.id, token, {
          photoKey: upload.photoKey,
          displayName: currentUserName,
        });
        setSelectedFile(null);
        onClaimSuccess();
        onClose();
      } else {
        // 2b. Contested — create a vote session with real challenger + defender
        const { session } = await voteApi.createSession({
          territoryId: territory.id,
          photoKey: upload.photoKey,
          challengerId: currentUserId,
          challengerName: currentUserName,
          defenderId: territory.ownerId ?? undefined,
          defenderName: 'Current Owner',
          defenderPhotoKey: territory.dishPhotoKey ?? undefined,
        });
        setSelectedFile(null);
        onSessionCreated(session.id);
        onClose();
      }
    } catch (submitError) {
      console.error(submitError);
      setError('Upload fizzled out. Try another snack shot.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="overlay">
      <div className="candy-card modal-card">
        <div className="eyebrow">{isContested ? 'Food Fight Challenge' : 'Claim Territory'}</div>
        <h2>
          {isContested
            ? 'Drop your dish into the arena'
            : 'Show off your meal to claim this spot'}
        </h2>
        <p className="muted">
          {isContested
            ? <>Challenge the current owner of <strong>{territory.name}</strong> with your best food photo. The crowd rates 1–10 — highest score wins!</>
            : <><strong>{territory.name}</strong> is unclaimed. Upload a food photo and it's yours instantly.</>
          }
        </p>

        <form className="upload-form" onSubmit={handleSubmit}>
          <label className="upload-dropzone">
            <input
              accept="image/*"
              capture="environment"
              type="file"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
              }}
            />
            <span>{selectedFile ? selectedFile.name : 'Tap to choose a camera roll treat'}</span>
          </label>

          {previewUrl && (
            <div className="preview-frame">
              <img src={previewUrl} alt="Meal preview" className="preview-image" />
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="button-row">
            <button className="ghost-button" type="button" onClick={onClose}>
              Maybe later
            </button>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isContested ? 'Launching vote...' : 'Claiming...'
                : isContested ? 'Start food fight' : 'Claim it!'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
