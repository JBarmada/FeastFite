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
      className="ff-claim-btn"
    >
      Contest! Upload a better dish!
    </button>
  );
}
