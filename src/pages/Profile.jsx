import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import RankBadge from '../components/rank/RankBadge';
import TierProgress from '../components/rank/TierProgress';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile,  setProfile]  = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const [{ data: prof }, { data: duels }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('duels')
          .select(`
            id, winner_id, week_start, week_end, status,
            user_a:profiles!duels_user_a_id_fkey(id, username),
            user_b:profiles!duels_user_b_id_fkey(id, username)
          `)
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .eq('status', 'closed')
          .order('week_end', { ascending: false })
          .limit(10),
      ]);

      setProfile(prof);
      setHistory(duels ?? []);
      setLoading(false);
    }

    load();
  }, [user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/onboarding', { replace: true });
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!profile) return null;

  return (
    <div className="profile-page">
      <header className="profile-page__header">
        <button className="profile-page__back" onClick={() => navigate('/')} aria-label="Back">←</button>
        <h1 className="profile-page__title">Profile</h1>
      </header>

      {/* ── Identity ──────────────────────────────────────── */}
      <div className="profile-card">
        <div className="profile-card__avatar" aria-hidden="true">
          {profile.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="profile-card__info">
          <p className="profile-card__username">{profile.username}</p>
          <RankBadge tier={profile.rank_tier} size="md" />
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────── */}
      <div className="profile-stats">
        <div className="profile-stats__item">
          <span className="profile-stats__value">{profile.wins}</span>
          <span className="profile-stats__label">Wins</span>
        </div>
        <div className="profile-stats__divider" aria-hidden="true" />
        <div className="profile-stats__item">
          <span className="profile-stats__value">{profile.losses}</span>
          <span className="profile-stats__label">Losses</span>
        </div>
        <div className="profile-stats__divider" aria-hidden="true" />
        <div className="profile-stats__item">
          <span className="profile-stats__value">{profile.rank_points}</span>
          <span className="profile-stats__label">Rank pts</span>
        </div>
      </div>

      {/* ── Tier progress ─────────────────────────────────── */}
      <TierProgress tier={profile.rank_tier} wins={profile.wins} />

      {/* ── Recent duel history ───────────────────────────── */}
      {history.length > 0 && (
        <section className="profile-history">
          <h2 className="profile-history__title">Recent Duels</h2>
          <ul className="profile-history__list">
            {history.map((duel) => {
              const opp     = duel.user_a.id === user.id ? duel.user_b : duel.user_a;
              const outcome = duel.winner_id === user.id ? 'win'
                            : duel.winner_id === null    ? 'draw'
                            : 'loss';
              const weekLabel = new Date(duel.week_start + 'T00:00:00')
                .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <li key={duel.id} className={`history-item history-item--${outcome}`}>
                  <span className="history-item__outcome">
                    {outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'D'}
                  </span>
                  <span className="history-item__opp">vs {opp?.username ?? 'Unknown'}</span>
                  <span className="history-item__date">{weekLabel}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <button className="profile-signout" onClick={handleSignOut}>Sign Out</button>
    </div>
  );
}
