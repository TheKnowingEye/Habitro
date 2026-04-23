export default function HabitCheckItem({ habit, completed, onChange, doneThisWeek = 0 }) {
  const target   = habit.target_frequency;
  const weekDone = completed ? doneThisWeek + 1 : doneThisWeek;

  return (
    <div
      className={`check-item ${completed ? 'check-item--done' : ''}`}
      onClick={onChange}
      role="checkbox"
      aria-checked={completed}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(); }
      }}
    >
      <div className={`check-item__circle ${completed ? 'check-item__circle--done' : ''}`}
        aria-hidden="true"
      >
        {completed && '✓'}
      </div>
      <div className="check-item__info">
        <span className="check-item__name">{habit.name}</span>
        <div
          className="check-item__progress"
          role="progressbar"
          aria-valuenow={weekDone}
          aria-valuemax={target}
          aria-label={`${weekDone} of ${target} days completed this week`}
        >
          <div className="check-item__progress-header">
            <span className="check-item__progress-label">{weekDone} / {target} days</span>
            <span className="check-item__progress-target">this week</span>
          </div>
          <div className="check-item__segments">
            {Array.from({ length: target }, (_, i) => (
              <div
                key={i}
                className={`check-item__segment ${i < weekDone ? 'check-item__segment--filled' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
