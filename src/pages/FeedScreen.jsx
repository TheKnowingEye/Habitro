import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import CornerFrame from '../components/ui/CornerFrame';
import { AvatarMini } from '../components/ui/Avatar';
import { darken } from '../lib/darken';

const PROOF_COLORS = ['#8A9E7A', '#9E8AAA', '#B8A888', '#7A9EAA', '#AA887A', '#9EAA7A'];

function timeLabel(isoStr) {
  if (!isoStr) return '';
  const d    = new Date(isoStr);
  const today = new Date();
  const diff  = Math.floor((today.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86_400_000);
  const base  = new Date(isoStr);
  const time  = base.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diff === 0) return time;
  if (diff === 1) return 'YESTERDAY';
  return base.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function colorForItem(item, idx) {
  // Use the snapshot_url hash as a stable color index
  const hash = (item.habit_id ?? '').charCodeAt(0) + idx;
  return PROOF_COLORS[hash % PROOF_COLORS.length];
}

function ProofCard({ item, isMe, username, avatarKind, dark, accent, idx }) {
  const [imgError, setImgError] = useState(false);
  const bgColor   = colorForItem(item, idx);
  const habitName = item.habits?.name ?? '';

  return (
    <div style={{
      position: 'relative',
      background: dark ? 'rgba(30,38,64,0.88)' : 'rgba(251,244,230,0.92)',
      border: `1px solid ${dark ? 'rgba(78,94,133,0.45)' : 'rgba(62,47,36,0.14)'}`,
      borderRadius: 4,
      overflow: 'hidden',
      boxShadow: `0 3px 0 ${dark ? '#0E1220' : 'rgba(62,47,36,0.13)'}`,
    }}>
      <CornerFrame color={accent} size={8} />

      {/* Photo area */}
      <div style={{ position: 'relative', width: '100%', height: 180, background: bgColor, overflow: 'hidden' }}>
        {item.snapshot_url && !imgError ? (
          <img
            src={item.snapshot_url}
            alt=""
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          // Pixel image placeholder
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="20" viewBox="0 0 24 20" shapeRendering="crispEdges" style={{ opacity: 0.35 }}>
              <rect x="0"  y="4"  width="24" height="14" fill="none" stroke="#FBF4E6" strokeWidth="2"/>
              <rect x="8"  y="1"  width="8"  height="5"  fill="#FBF4E6" opacity="0.6"/>
              <rect x="2"  y="6"  width="3"  height="3"  fill="#FBF4E6" opacity="0.4"/>
              <rect x="8"  y="8"  width="8"  height="6"  fill="none" stroke="#FBF4E6" strokeWidth="2" opacity="0.5"/>
            </svg>
          </div>
        )}

        {/* Timestamp chip */}
        <div style={{
          position: 'absolute', bottom: 8, right: 10,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          borderRadius: 3, padding: '3px 7px',
        }}>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: '#FBF4E6', letterSpacing: '0.08em' }}>
            {timeLabel(item.created_at || item.checked_date)}
          </span>
        </div>
      </div>

      {/* Card footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <AvatarMini kind={avatarKind} size={32} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.06em', marginBottom: 2 }}>
            {isMe ? 'YOU' : username?.toUpperCase() ?? 'OPPONENT'}
          </div>
          <div style={{ fontSize: '12px', color: dark ? '#B8AE98' : '#7A6555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.note || habitName}
          </div>
        </div>

        <div style={{
          flexShrink: 0,
          padding: '4px 8px',
          background: `${accent}18`,
          border: `1px solid ${accent}44`,
          borderRadius: 3,
          fontFamily: '"Silkscreen",monospace', fontSize: '8px',
          color: accent, letterSpacing: '0.08em',
        }}>
          ✓ PROOF
        </div>
      </div>
    </div>
  );
}

export default function FeedScreen({ theme, dark, accent }) {
  const { user } = useAuth();

  const [pageState,   setPageState]   = useState('loading');
  const [items,       setItems]       = useState([]);
  const [oppProfile,  setOppProfile]  = useState(null);
  const [myAvatarKind, setMyAvatarKind] = useState('fox');

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: duel } = await supabase
        .from('duels')
        .select('id, week_start, user_a_id, user_b_id')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'active')
        .maybeSingle();

      if (!duel) { setPageState('no-duel'); return; }

      const oppId = duel.user_a_id === user.id ? duel.user_b_id : duel.user_a_id;

      const [{ data: checkins }, { data: oppProf }, { data: myProf }] = await Promise.all([
        supabase.from('check_ins')
          .select('habit_id, user_id, snapshot_url, note, checked_date, created_at, habits(name)')
          .eq('duel_id', duel.id)
          .eq('completed', true)
          .gte('checked_date', duel.week_start)
          .order('created_at', { ascending: false }),
        oppId
          ? supabase.from('profiles').select('username, avatar_kind').eq('id', oppId).single()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('avatar_kind').eq('id', user.id).single(),
      ]);

      setOppProfile(oppProf);
      setMyAvatarKind(myProf?.avatar_kind || 'fox');

      // Show both completed check-ins (with and without snapshot) but prioritise proof ones
      const all = (checkins ?? []).filter(c => c.snapshot_url || c.note);
      setItems(all);
      setPageState('ready');
    }

    load();
  }, [user]);

  if (pageState === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em' }}>LOADING...</span>
      </div>
    );
  }

  if (pageState === 'no-duel') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 40 }}>📸</span>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '11px', color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.08em' }}>NO ACTIVE DUEL</span>
        <span style={{ fontSize: '13px', color: dark ? '#B8AE98' : '#7A6555', lineHeight: 1.5 }}>Proof photos appear here during a live duel week.</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      {/* Header */}
      <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.35)' : 'rgba(62,47,36,0.1)'}` }}>
        <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: dark ? '#B8AE98' : '#7A6555', letterSpacing: '0.1em' }}>
          // PROOF FEED
        </span>
      </div>

      {/* Feed */}
      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
          <span style={{ fontSize: 36, opacity: 0.5 }}>📷</span>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#6B7A8E' : '#AAA090', letterSpacing: '0.08em' }}>
            NO PROOF YET
          </span>
          <span style={{ fontSize: '13px', color: dark ? '#B8AE98' : '#7A6555', lineHeight: 1.5 }}>
            Check in with proof to appear in the feed.
          </span>
        </div>
      ) : (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((item, idx) => {
            const isMe      = item.user_id === user.id;
            const username  = isMe ? null : oppProfile?.username;
            const avatarKind = isMe ? myAvatarKind : (oppProfile?.avatar_kind || 'cat');
            return (
              <ProofCard
                key={`${item.user_id}-${item.habit_id}-${item.checked_date}-${idx}`}
                item={item}
                isMe={isMe}
                username={username}
                avatarKind={avatarKind}
                dark={dark}
                accent={accent}
                idx={idx}
              />
            );
          })}
          <div style={{ height: 8 }} />
        </div>
      )}
    </div>
  );
}
