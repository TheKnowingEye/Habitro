// Displays both players' scores and the live gap between them.
// All values come from the scores table rows — no calculation done here.
export default function ScoreGap({ myScore, opponentScore, myUsername, opponentUsername }) {
  const myPts  = myScore?.total_points     ?? 0;
  const oppPts = opponentScore?.total_points ?? 0;
  const myStreak  = myScore?.consecutive_days  ?? 0;

  const gap      = myPts - oppPts;
  const maxPts   = Math.max(myPts, oppPts, 1); // avoid divide-by-zero
  const myBar    = Math.round((myPts  / maxPts) * 100);
  const oppBar   = Math.round((oppPts / maxPts) * 100);

  const isAhead  = gap > 0;
  const isTied   = gap === 0;

  return (
    <div className="score-gap">
      {/* ── Players row ─────────────────────────────────────── */}
      <div className="score-gap__players">
        <div className="score-gap__player score-gap__player--me">
          <span className="score-gap__label">You</span>
          <span className="score-gap__pts">{myPts}</span>
          <span className="score-gap__pts-unit">pts</span>
          {myStreak >= 3 && (
            <span className="score-gap__streak" title={`${myStreak}-day streak`}>
              🔥 {myStreak}
            </span>
          )}
        </div>

        <div className={`score-gap__banner ${isAhead ? 'score-gap__banner--ahead' : isTied ? 'score-gap__banner--tied' : 'score-gap__banner--behind'}`}>
          {isTied  ? 'TIED'
            : isAhead ? `+${gap}`
            : `${gap}`}
        </div>

        <div className="score-gap__player score-gap__player--opp">
          <span className="score-gap__label">{opponentUsername ?? 'Opponent'}</span>
          <span className="score-gap__pts">{oppPts}</span>
          <span className="score-gap__pts-unit">pts</span>
        </div>
      </div>

      {/* ── Progress bars ───────────────────────────────────── */}
      <div className="score-gap__bars" aria-hidden="true">
        <div className="score-gap__bar-track">
          <div
            className="score-gap__bar score-gap__bar--me"
            style={{ width: `${myBar}%` }}
          />
        </div>
        <div className="score-gap__bar-track">
          <div
            className="score-gap__bar score-gap__bar--opp"
            style={{ width: `${oppBar}%` }}
          />
        </div>
      </div>

      {/* ── Contextual message ──────────────────────────────── */}
      <p className="score-gap__message">
        {isTied && 'It\'s all square — make today count.'}
        {isAhead && !isTied && `You're leading by ${gap} point${gap === 1 ? '' : 's'}.`}
        {!isAhead && !isTied && `You're down ${Math.abs(gap)} point${Math.abs(gap) === 1 ? '' : 's'}. Time to move.`}
      </p>
    </div>
  );
}
