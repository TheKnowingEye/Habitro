import { RANK_TIERS } from '../../constants/ranks';
import RankBadge from './RankBadge';

export default function TierProgress({ tier, wins }) {
  const currentIdx = RANK_TIERS.findIndex((t) => t.id === tier);
  const next       = RANK_TIERS[currentIdx + 1] ?? null;

  if (!next) {
    return (
      <div className="tier-progress">
        <RankBadge tier={tier} size="lg" />
        <p className="tier-progress__elite">Maximum rank achieved.</p>
      </div>
    );
  }

  const currentFloor = RANK_TIERS[currentIdx].winsRequired;
  const winsInTier   = wins - currentFloor;
  const winsNeeded   = next.winsRequired - currentFloor;
  const pct          = Math.min(100, Math.round((winsInTier / winsNeeded) * 100));
  const remaining    = next.winsRequired - wins;

  return (
    <div className="tier-progress">
      <div className="tier-progress__labels">
        <RankBadge tier={tier} size="md" />
        <span className="tier-progress__next-label">
          {remaining} win{remaining !== 1 ? 's' : ''} to <RankBadge tier={next.id} size="sm" />
        </span>
      </div>
      <div className="tier-progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="tier-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="tier-progress__sub">{winsInTier} / {winsNeeded} wins in tier</p>
    </div>
  );
}
