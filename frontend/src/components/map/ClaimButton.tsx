import type { Territory } from '@feastfite/shared';

interface Props {
  territory: Territory;
  onClaim: (territory: Territory) => void;
  disabled?: boolean;
}

export function ClaimButton({ territory, onClaim, disabled }: Props) {
  return (
    <button
      onClick={() => !disabled && onClaim(territory)}
      disabled={disabled}
      title={`Claim ${territory.name}`}
      style={{
        width: '100%',
        padding: '10px 0',
        borderRadius: '12px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 800,
        fontSize: '0.95rem',
        letterSpacing: '0.03em',
        background: disabled
          ? '#E8E8E8'
          : 'linear-gradient(135deg, #FF6B9D 0%, #C77DFF 100%)',
        color: disabled ? '#999' : '#fff',
        boxShadow: disabled ? 'none' : '0 4px 12px rgba(199,125,255,0.4)',
        transition: 'opacity 0.15s',
      }}
    >
      ⚔️ Claim Territory
    </button>
  );
}
