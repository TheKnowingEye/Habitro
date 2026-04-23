export default function HabitCard({ habit, icon, minFreq, maxFreq, selected, frequency, disabled, onToggle, onFrequencyChange }) {
  const isFixed = minFreq === maxFreq;

  function handleStepperClick(e, newFreq) {
    e.stopPropagation();
    onFrequencyChange(newFreq);
  }

  return (
    <div
      className={['habit-card', selected ? 'habit-card--selected' : '', disabled ? 'habit-card--disabled' : ''].filter(Boolean).join(' ')}
      onClick={!disabled ? onToggle : undefined}
      role="checkbox"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!disabled) onToggle(); } }}
    >
      {selected && <div className="habit-card__badge" aria-hidden="true">✓</div>}

      <div className="habit-card__header">
        <span className="habit-card__emoji" aria-hidden="true">{icon}</span>
        <div className="habit-card__info">
          <span className="habit-card__name">{habit.name}</span>
          <span className="habit-card__meta">
            {isFixed ? `${minFreq} days/week` : `${minFreq}–${maxFreq} days/week`}
          </span>
        </div>
      </div>

      {selected && (
        <div className="habit-card__frequency" role="group" aria-label="Target frequency">
          {isFixed ? (
            <div className="habit-card__freq-fixed">
              <span className="habit-card__lock" aria-hidden="true">🔒</span>
              <span>{frequency} times this week</span>
            </div>
          ) : (
            <div className="habit-card__stepper">
              <button
                className="stepper-btn"
                aria-label="Decrease frequency"
                onClick={(e) => handleStepperClick(e, Math.max(minFreq, frequency - 1))}
                disabled={frequency <= minFreq}
              >
                −
              </button>
              <span className="stepper-value" aria-live="polite">{frequency} times this week</span>
              <button
                className="stepper-btn"
                aria-label="Increase frequency"
                onClick={(e) => handleStepperClick(e, Math.min(maxFreq, frequency + 1))}
                disabled={frequency >= maxFreq}
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
