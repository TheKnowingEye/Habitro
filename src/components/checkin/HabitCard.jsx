// habit: DB row from `habits` table (snake_case fields)
export default function HabitCard({ habit, selected, frequency, disabled, onToggle, onFrequencyChange }) {
  const isFixed = habit.min_frequency === habit.max_frequency;

  function handleStepperClick(e, newFreq) {
    e.stopPropagation(); // don't bubble to card toggle
    onFrequencyChange(newFreq);
  }

  return (
    <div
      className={[
        'habit-card',
        selected  ? 'habit-card--selected'  : '',
        disabled  ? 'habit-card--disabled'  : '',
      ].join(' ')}
      onClick={onToggle}
      role="checkbox"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(); } }}
    >
      <div className="habit-card__header">
        <div className="habit-card__check" aria-hidden="true">✓</div>
        <div className="habit-card__info">
          <span className="habit-card__name">{habit.name}</span>
          <span className="habit-card__meta">
            {isFixed
              ? `${habit.min_frequency}×/week`
              : `${habit.min_frequency}–${habit.max_frequency}×/week`}
          </span>
        </div>
      </div>

      {selected && (
        <div className="habit-card__frequency" role="group" aria-label="Target frequency">
          <span className="habit-card__freq-label">Target</span>
          {isFixed ? (
            <span className="habit-card__freq-fixed">{frequency}×/week (fixed)</span>
          ) : (
            <div className="habit-card__stepper">
              <button
                className="stepper-btn"
                aria-label="Decrease frequency"
                onClick={(e) => handleStepperClick(e, Math.max(habit.min_frequency, frequency - 1))}
                disabled={frequency <= habit.min_frequency}
              >
                −
              </button>
              <span className="stepper-value" aria-live="polite">{frequency}×/week</span>
              <button
                className="stepper-btn"
                aria-label="Increase frequency"
                onClick={(e) => handleStepperClick(e, Math.min(habit.max_frequency, frequency + 1))}
                disabled={frequency >= habit.max_frequency}
              >
                +
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
