import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { icon: '⚔️', title: 'Weekly duels', desc: 'Get matched with a real opponent every Monday. One week to prove your habits are stronger.' },
  { icon: '📸', title: 'Evidence feed', desc: 'Post proof of your check-ins. Hold yourself — and your opponent — accountable.' },
  { icon: '🏆', title: 'Rank up', desc: 'Win duels to climb tiers. Lose and you drop. Your rank reflects how consistent you actually are.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="landing__hero">
        <div className="landing__logo" aria-hidden="true">⚔️</div>
        <h1 className="landing__title">HabitDuel</h1>
        <p className="landing__tagline">Build habits. Beat your rival. Every week.</p>
        <div className="landing__cta-group">
          <button className="landing__cta-primary" onClick={() => navigate('/onboarding?mode=signup')}>
            Start for free
          </button>
          <button className="landing__cta-secondary" onClick={() => navigate('/onboarding?mode=signin')}>
            Sign in
          </button>
        </div>
      </div>

      <ul className="landing__features" role="list">
        {FEATURES.map((f) => (
          <li key={f.title} className="landing__feature">
            <span className="landing__feature-icon" aria-hidden="true">{f.icon}</span>
            <div>
              <p className="landing__feature-title">{f.title}</p>
              <p className="landing__feature-desc">{f.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="landing__footer">No fluff. No streaks for their own sake. Just you vs. someone equally motivated.</p>
    </div>
  );
}
