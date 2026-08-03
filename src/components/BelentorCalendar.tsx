import { useMemo, useState } from 'react';
import '../belentor-calendar.css';

type BelentorMonth = {
  name: string;
  marker?: string;
  star: string | null;
};

export const belentorMonths: readonly BelentorMonth[] = [
  { name: 'Quen', marker: 'Winter Equinox', star: null },
  { name: 'Incan', star: 'Amarielle (Enchantment)' },
  { name: 'Abjar', star: 'Etoilien Ardienne (Abjuration)' },
  { name: 'Methyl Melt', marker: 'Spring', star: null },
  { name: 'Illin', star: 'Miralune Pectra (Illusion)' },
  { name: 'Evao', star: 'Flambelle Avedentri (Evocation)' },
  { name: 'Eryl', marker: 'Summer Equinox', star: null },
  { name: 'Conjun', star: 'Luminaire Saphira (Conjuration)' },
  { name: 'Din', star: 'Orelia Voyante (Divination)' },
  { name: 'Albedo Perigee', marker: 'Autumn', star: null },
  { name: 'Unri', star: 'Noctara Ombrelle (Necromancy)' },
  { name: 'Trin', star: 'Transmutia Evoline (Transmutation)' }
];

const tenDayLabels = ['First 10-day', 'Second 10-day', 'Third 10-day'] as const;

function monthTitle(month: BelentorMonth) {
  return month.marker ? `${month.name} — ${month.marker}` : month.name;
}

function clampYear(value: number) {
  if (!Number.isFinite(value)) return 641;
  return Math.min(9999, Math.max(1, Math.trunc(value)));
}

export function BelentorCalendar() {
  const [monthIndex, setMonthIndex] = useState(0);
  const [year, setYear] = useState(641);
  const [selectedDay, setSelectedDay] = useState(1);
  const month = belentorMonths[monthIndex];
  const selectedTenDay = Math.floor((selectedDay - 1) / 10);
  const selectedDayWithinTenDay = ((selectedDay - 1) % 10) + 1;

  const tenDays = useMemo(
    () => tenDayLabels.map((label, groupIndex) => ({
      label,
      days: Array.from({ length: 10 }, (_, dayIndex) => groupIndex * 10 + dayIndex + 1)
    })),
    []
  );

  const moveMonth = (direction: -1 | 1) => {
    const next = monthIndex + direction;
    if (next < 0) {
      setMonthIndex(belentorMonths.length - 1);
      setYear((current) => clampYear(current - 1));
    } else if (next >= belentorMonths.length) {
      setMonthIndex(0);
      setYear((current) => clampYear(current + 1));
    } else {
      setMonthIndex(next);
    }
    setSelectedDay(1);
  };

  const selectMonth = (index: number) => {
    setMonthIndex(index);
    setSelectedDay(1);
  };

  return (
    <section className="belentor-calendar" aria-label="Calendar in Belentor">
      <div className="belentor-calendar-introduction">
        <div>
          <p className="eyebrow">The Celestial Handful</p>
          <h2>Calendar in Belentor</h2>
        </div>
        <p>
          This is the callendar shared by all creatures on the Celestial Handful (the world). Local calendars in Belentor might have som alterations and a more fleshed out calendar with holidays, significant periods in relation to celestial objects and movement. These things may vary slightly from country to country.
        </p>
      </div>

      <div className="belentor-calendar-controls" aria-label="Calendar controls">
        <button aria-label="Previous month" onClick={() => moveMonth(-1)} type="button">←</button>
        <label>
          Month
          <select onChange={(event) => selectMonth(Number(event.target.value))} value={monthIndex}>
            {belentorMonths.map((item, index) => <option key={item.name} value={index}>{monthTitle(item)}</option>)}
          </select>
        </label>
        <label>
          Year AA
          <input min="1" max="9999" onChange={(event) => setYear(clampYear(Number(event.target.value)))} type="number" value={year} />
        </label>
        <button aria-label="Next month" onClick={() => moveMonth(1)} type="button">→</button>
      </div>

      <div className="belentor-calendar-main">
        <section className="belentor-month-card" aria-label={`${monthTitle(month)}, ${year} AA`}>
          <header className="belentor-month-heading">
            <div>
              <p className="eyebrow">Month {monthIndex + 1} of 12 · 30 days</p>
              <h3>{month.name}</h3>
              {month.marker && <span className="belentor-season-marker">{month.marker}</span>}
            </div>
            <div className="belentor-star-card">
              <span>Star name</span>
              <strong>{month.star ?? '—'}</strong>
            </div>
          </header>

          <div className="belentor-ten-day-calendar" role="grid" aria-label={`${month.name} days`}>
            {tenDays.map((tenDay, groupIndex) => (
              <div className="belentor-ten-day-row" key={tenDay.label} role="rowgroup">
                <div className="belentor-ten-day-label">
                  <strong>{tenDay.label}</strong>
                  <span>Days {groupIndex * 10 + 1}–{groupIndex * 10 + 10}</span>
                </div>
                <div className="belentor-day-row" role="row">
                  {tenDay.days.map((day) => (
                    <button
                      aria-label={`${day} ${month.name}, ${year} AA`}
                      aria-selected={selectedDay === day}
                      className={selectedDay === day ? 'is-selected' : ''}
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      role="gridcell"
                      type="button"
                    >
                      <span>{day}</span>
                      <small>{((day - 1) % 10) + 1}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <footer className="belentor-selected-date" aria-live="polite">
            <div>
              <span>Selected date</span>
              <strong>{selectedDay} {month.name}, {year} AA</strong>
            </div>
            <p>{tenDayLabels[selectedTenDay]} · Day {selectedDayWithinTenDay} of 10</p>
          </footer>
        </section>

        <aside className="belentor-year-overview" aria-label={`Months of ${year} AA`}>
          <header><p className="eyebrow">Year at a glance</p><h3>{year} AA</h3></header>
          <div>
            {belentorMonths.map((item, index) => (
              <button className={index === monthIndex ? 'is-selected' : ''} key={item.name} onClick={() => selectMonth(index)} type="button">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item.name}</strong>
                <small>{item.marker ?? item.star ?? '—'}</small>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="belentor-calendar-reference" aria-label="Belentor month reference">
        <div><p className="eyebrow">Reference</p><h3>Months in the year</h3><p>Each month has 30 days: 3×10-days.</p></div>
        <div className="belentor-month-reference-list">
          {belentorMonths.map((item) => (
            <article key={item.name}>
              <div><strong>{monthTitle(item)}</strong></div>
              <span>{item.star ?? '—'}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
