import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarStrip({ weekStart, duelId, userId }) {
  const [tiles, setTiles] = useState(null);
  const navigate = useNavigate();

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
        const dateNum = parseInt(day.split('-')[2], 10);

        let state = 'neutral';
        if (isPast) {
          if (done === 0)            state = 'red';
          else if (done < total / 2) state = 'orange';
          else if (done < total)     state = 'yellow';
          else                       state = 'green';
        } else if (isToday && done > 0) {
          if (done >= total)         state = 'green';
          else if (done < total / 2) state = 'orange';
          else                       state = 'yellow';
        }

        return { day, label: DAY_LABELS[i], dateNum, state, isToday };
      }));
    }

    load();
  }, [weekStart, duelId, userId]);

  if (!tiles) return null;

  return (
    <button
      className="calendar-strip calendar-strip--clickable"
      onClick={() => navigate('/calendar')}
      aria-label="View full calendar history"
    >
      {tiles.map(({ day, label, dateNum, state, isToday }) => (
        <div
          key={day}
          className={`calendar-tile calendar-tile--${state}${isToday ? ' calendar-tile--today' : ''}`}
        >
          <span className="calendar-tile__label">{label}</span>
          <span className="calendar-tile__date">{dateNum}</span>
          {isToday && <span className="calendar-tile__arrow" aria-hidden="true">▼</span>}
        </div>
      ))}
    </button>
  );
}
