import { useMemo, useState } from 'react';
import { voteApi } from '../../api/voteApi';

interface UploadModalProps {
  isOpen: boolean;
  territoryId: string;
  onClose: () => void;
  onSessionCreated: (sessionId: string) => void;
}

export function UploadModal({
  isOpen,
  territoryId,
  onClose,
  onSessionCreated,
}: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile]
  );

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedFile) {
      setError('Pick a delicious battle photo first.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const upload = await voteApi.createUploadUrl(selectedFile);
      await voteApi.uploadPhoto(upload.uploadUrl, selectedFile);

      const { session } = await voteApi.createSession({
        territoryId,
        photoKey: upload.photoKey,
        challengerId: 'monster-grubby',
        challengerName: 'Monster Grubby',
        defenderId: 'marshmallow-mayor',
        defenderName: 'Marshmallow Mayor',
        defenderPhotoKey: 'seed/candy-castle-defender.png',
      });

      setSelectedFile(null);
      onSessionCreated(session.id);
      onClose();
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
        <div className="eyebrow">Photo Challenge</div>
        <h2>Drop your cutest meal monster into the arena</h2>
        <p className="muted">
          Upload a snack photo for territory <strong>{territoryId}</strong> and start a 10-minute
          vote battle.
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
              {isSubmitting ? 'Launching vote...' : 'Start food fight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
