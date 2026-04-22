export default function HabitCheckItem({ habit, completed, onChange }) {
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
        <span className="check-item__freq">{habit.target_frequency}×/week target</span>
      </div>
    </div>
  );
}
