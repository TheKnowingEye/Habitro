import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarStrip({ weekStart, duelId, userId }) {
  const [tiles, setTiles] = useState(null);

  useEffect(() => {
    if (!weekStart || !duelId || !userId) return;

    async function load() {
      const today = new Date().toISOString().split('T')[0];
      const days  = [...Array(7)].map((_, i) => {
        const d = new Date(weekStart + 'T12:00:00');
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      });

      const [{ data: habits }, { data: checkins }] = await Promise.all([
        supabase
          .from('duel_habits')
          .select('habit_id')
          .eq('duel_id', duelId)
          .eq('user_id', userId),
        supabase
          .from('check_ins')
          .select('checked_date, completed')
          .eq('duel_id', duelId)
          .eq('user_id', userId)
          .in('checked_date', days),
      ]);

      const total = habits?.length ?? 0;
      const doneByDate = {};
      for (const ci of checkins ?? []) {
        if (ci.completed) {
          doneByDate[ci.checked_date] = (doneByDate[ci.checked_date] ?? 0) + 1;
        }
      }

      setTiles(days.map((day, i) => {
        const isToday = day === today;
        const isPast  = day < today;
        const done    = doneByDate[day] ?? 0;

        let state = 'neutral';
        if (isPast) {
          if (done === 0)            state = 'red';
          else if (done < total / 2) state = 'orange';
          else if (done < total)     state = 'yellow';
          else                       state = 'green';
        }

        return { day, label: DAY_LABELS[i], state, isToday };
      }));
    }

    load();
  }, [weekStart, duelId, userId]);

  if (!tiles) return null;

  return (
    <div className="calendar-strip">
      {tiles.map(({ day, label, state, isToday }) => (
        <div
          key={day}
          className={`calendar-tile calendar-tile--${state}${isToday ? ' calendar-tile--today' : ''}`}
        >
          <span className="calendar-tile__label">{label}</span>
          {isToday && <span className="calendar-tile__dot" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
