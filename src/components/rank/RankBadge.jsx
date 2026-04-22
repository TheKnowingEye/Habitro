import { RANK_TIERS } from '../../constants/ranks';

const TIER_COLORS = {
  bronze:   { bg: 'rgba(180,100,40,0.15)',  border: '#b46428', text: '#d4824a' },
  silver:   { bg: 'rgba(150,160,170,0.15)', border: '#8a98a8', text: '#b0bec5' },
  gold:     { bg: 'rgba(200,160,0,0.15)',   border: '#c8a000', text: '#ffc107' },
  platinum: { bg: 'rgba(0,180,200,0.15)',   border: '#00b4c8', text: '#4dd0e1' },
  elite:    { bg: 'rgba(108,71,255,0.2)',   border: '#6c47ff', text: '#9b7dff' },
};

export default function RankBadge({ tier, size = 'md' }) {
  const label  = RANK_TIERS.find((t) => t.id === tier)?.label ?? tier;
  const colors = TIER_COLORS[tier] ?? TIER_COLORS.bronze;

  return (
    <span
      className={`rank-badge rank-badge--${size}`}
      style={{ background: colors.bg, border: `1.5px solid ${colors.border}`, color: colors.text }}
      aria-label={`Rank: ${label}`}
    >
      {label}
    </span>
  );
}
