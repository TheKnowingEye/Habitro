const BASE_POINTS = 10;
const CONSISTENCY_BONUS = 5;
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

// Defined in CLAUDE.md §6 — single source of truth for snapshot prompt logic.
// Call once per submission, not on every render (Math.random is intentional).
export function shouldPromptSnapshot(targetDaysPerWeek) {
  if (targetDaysPerWeek < 4) return false;
  return Math.random() < 0.5;
}
