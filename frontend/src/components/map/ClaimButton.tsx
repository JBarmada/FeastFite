import type { Territory } from '@feastfite/shared';

interface Props {
  territory: Territory;
  /**
   * Dev C wires this prop to the photo-upload flow.
   * Dev B fires it — Dev C provides the implementation.
   */
  onClaim: (territory: Territory) => void;
  disabled?: boolean;
}

/**
 * Claim button stub — Dev B owns the UI/state, Dev C owns the upload flow
 * that gets triggered via `onClaim`.
 */
export function ClaimButton({ territory, onClaim, disabled }: Props) {
  const isLocked =
    territory.lockedUntil != null &&
    new Date(territory.lockedUntil) > new Date();

  const isDisabled = disabled || isLocked;

  return (
    <button
      onClick={() => !isDisabled && onClaim(territory)}
      disabled={isDisabled}
      title={isLocked ? 'Territory is locked — use a Battering Ram to break it' : `Claim ${territory.name}`}
      style={{
        width: '100%',
        padding: '10px 0',
        borderRadius: '12px',
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontWeight: 800,
        fontSize: '0.95rem',
        letterSpacing: '0.03em',
        background: isDisabled
          ? '#E8E8E8'
          : 'linear-gradient(135deg, #FF6B9D 0%, #C77DFF 100%)',
        color: isDisabled ? '#999' : '#fff',
        boxShadow: isDisabled ? 'none' : '0 4px 12px rgba(199,125,255,0.4)',
        transition: 'opacity 0.15s',
      }}
    >
      {isLocked ? '🔒 Locked' : '⚔️ Claim Territory'}
    </button>
  );
}
