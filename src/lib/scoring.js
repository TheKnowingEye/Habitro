// ── Duel scoring (total_points) ──────────────────────────────

const BASE_POINTS        = 10;
const CONSISTENCY_BONUS  = 5;
const STREAK_MULTIPLIER_3 = 1.10;
const STREAK_MULTIPLIER_5 = 1.25;

export function calculateDailyPoints(habitsCompleted, totalHabits, consecutiveDays) {
  let points = habitsCompleted * BASE_POINTS;

  if (habitsCompleted === totalHabits) {
    points += CONSISTENCY_BONUS;
  }

  if (consecutiveDays >= 5) {
    points *= STREAK_MULTIPLIER_5;
  } else if (consecutiveDays >= 3) {
    points *= STREAK_MULTIPLIER_3;
  }

  return Math.round(points);
}

// ── XP system ────────────────────────────────────────────────

// XP per check-in — based on target_frequency × 3, with streak multiplier.
// Mirrors the calculation in 011_xp_and_hp_trigger.sql — keep in sync.
export function calculateCheckInXP(targetFrequency, consecutiveDays) {
  let xp = targetFrequency * 3;
  if (consecutiveDays >= 5)      xp *= 1.25;
  else if (consecutiveDays >= 3) xp *= 1.10;
  return Math.round(xp);
}

// Bonus XP when all habits are completed in a single day
export const ALL_HABITS_BONUS_XP = 50;

// XP awarded at duel end
export const WIN_XP  = 200;
export const LOSS_XP = 50;
export const DRAW_XP = 100;

// ── HP system ────────────────────────────────────────────────

// HP drained from scores.hp per missed habit at end of day (floor: 0)
export const HP_DRAIN_PER_MISSED_HABIT = 10;

// ── Stat system ───────────────────────────────────────────────

// profiles.stat_* incremented by this amount per completed check-in
export const STAT_INCREMENT = 1;

// ── Level calculation ─────────────────────────────────────────
// Level thresholds live in the level_thresholds DB table — do not hardcode
// them here. Use this query pattern wherever level recalculation is needed:
//
//   select level, title from level_thresholds
//   where xp_required <= <total_xp>
//   order by level desc limit 1;
//
// The trigger in 011_xp_and_hp_trigger.sql handles this server-side.
// Client-side calls (e.g. profile display) should query level_thresholds directly.

// ── Snapshot prompt ───────────────────────────────────────────

// Defined in CLAUDE.md §6 — single source of truth for snapshot prompt logic.
// Call once per submission, not on every render (Math.random is intentional).
export function shouldPromptSnapshot(targetDaysPerWeek) {
  if (targetDaysPerWeek < 4) return false;
  return Math.random() < 0.5;
}
