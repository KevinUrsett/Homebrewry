import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listWorldbuildingEntries } from '../lib/worldbuildingStore';
import {
  calendarEventKinds,
  deleteCalendarEvent,
  loadCalendarEvents,
  saveCalendarEvent,
  saveCalendarToDrive,
  stageCalendarView,
  type BelentorCalendarEvent,
  type CalendarEventKind,
  type CalendarView
} from '../lib/calendarEventStore';
import type { WorldbuildingEntry } from '../types';
import '../belentor-calendar.css';
import '../belentor-calendar-events.css';
import '../belentor-calendar-save.css';

type BelentorMonth = {
  name: string;
  marker?: string;
  star: string | null;
};

type CalendarEventDraft = Pick<BelentorCalendarEvent, 'id' | 'title' | 'notes' | 'kind' | 'year' | 'monthIndex' | 'day' | 'annual' | 'worldbuildingIds' | 'createdAt' | 'updatedAt'>;

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
const eventKindLabels: Record<CalendarEventKind, string> = {
  holiday: 'Holiday',
  'major-event': 'Major event',
  event: 'Event',
  note: 'Calendar note'
};

function monthTitle(month: BelentorMonth) {
  return month.marker ? `${month.name} — ${month.marker}` : month.name;
}

function clampYear(value: number) {
  if (!Number.isFinite(value)) return 641;
  return Math.min(9999, Math.max(1, Math.trunc(value)));
}

function clampDay(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(30, Math.max(1, Math.trunc(value)));
}

function createDraft(year: number, monthIndex: number, day: number, kind: CalendarEventKind = 'event'): CalendarEventDraft {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    notes: '',
    kind,
    year,
    monthIndex,
    day,
    annual: kind === 'holiday',
    worldbuildingIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function occursInYear(event: BelentorCalendarEvent, year: number) {
  return event.annual || event.year === year;
}

function eventDateLabel(event: BelentorCalendarEvent) {
  const date = `${event.day} ${belentorMonths[event.monthIndex]?.name ?? 'Unknown month'}`;
  return event.annual ? `${date} · every year` : `${date}, ${event.year} AA`;
}

function formatSavedTime(value?: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BelentorCalendar() {
  const [monthIndex, setMonthIndex] = useState(0);
  const [year, setYear] = useState(641);
  const [selectedDay, setSelectedDay] = useState(1);
  const [events, setEvents] = useState<BelentorCalendarEvent[]>([]);
  const [worldbuildingEntries, setWorldbuildingEntries] = useState<WorldbuildingEntry[]>([]);
  const [eventDraft, setEventDraft] = useState<CalendarEventDraft | null>(null);
  const [worldbuildingQuery, setWorldbuildingQuery] = useState('');
  const [status, setStatus] = useState('Loading calendar entries…');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCalendarEvents(), listWorldbuildingEntries()])
      .then(([calendar, entries]) => {
        if (cancelled) return;
        setEvents(calendar.events);
        setMonthIndex(calendar.view.monthIndex);
        setYear(calendar.view.year);
        setSelectedDay(calendar.view.day);
        setDirty(calendar.syncState === 'pending' || calendar.syncState === 'error');
        setLastSavedAt(calendar.lastSavedAt);
        setStatus(calendar.status);
        setWorldbuildingEntries([...entries].sort((left, right) => left.name.localeCompare(right.name)));
      })
      .catch((error) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : 'Calendar entries could not be loaded.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirty]);

  const selectedDateEvents = useMemo(
    () => events
      .filter((event) => event.monthIndex === monthIndex && event.day === selectedDay && occursInYear(event, year))
      .sort((left, right) => calendarEventKinds.indexOf(left.kind) - calendarEventKinds.indexOf(right.kind) || left.title.localeCompare(right.title)),
    [events, monthIndex, selectedDay, year]
  );

  const visibleWorldbuildingEntries = useMemo(() => {
    const query = worldbuildingQuery.trim().toLocaleLowerCase();
    return worldbuildingEntries
      .filter((entry) => !eventDraft?.worldbuildingIds.includes(entry.id))
      .filter((entry) => !query || [entry.name, entry.kind, ...entry.aliases, entry.notes].join(' ').toLocaleLowerCase().includes(query))
      .slice(0, 12);
  }, [eventDraft?.worldbuildingIds, worldbuildingEntries, worldbuildingQuery]);

  const worldbuildingById = useMemo(
    () => new Map(worldbuildingEntries.map((entry) => [entry.id, entry])),
    [worldbuildingEntries]
  );

  const monthEventCounts = useMemo(
    () => belentorMonths.map((_, index) => events.filter((event) => event.monthIndex === index && occursInYear(event, year)).length),
    [events, year]
  );

  const eventsForDay = (day: number) => events.filter((event) => event.monthIndex === monthIndex && event.day === day && occursInYear(event, year));

  const stageView = (view: CalendarView) => {
    setMonthIndex(view.monthIndex);
    setYear(view.year);
    setSelectedDay(view.day);
    setDirty(true);
    setStatus('Unsaved calendar changes.');
    void stageCalendarView(view).catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Calendar date could not be staged.');
    });
  };

  const moveMonth = (direction: -1 | 1) => {
    let nextMonth = monthIndex + direction;
    let nextYear = year;
    if (nextMonth < 0) {
      nextMonth = belentorMonths.length - 1;
      nextYear = clampYear(year - 1);
    } else if (nextMonth >= belentorMonths.length) {
      nextMonth = 0;
      nextYear = clampYear(year + 1);
    }
    stageView({ year: nextYear, monthIndex: nextMonth, day: 1 });
    setEventDraft(null);
  };

  const selectMonth = (index: number) => {
    stageView({ year, monthIndex: index, day: 1 });
    setEventDraft(null);
  };

  const selectDay = (day: number) => {
    stageView({ year, monthIndex, day });
    if (eventDraft && !events.some((event) => event.id === eventDraft.id)) {
      setEventDraft((current) => current ? { ...current, year, monthIndex, day } : null);
    }
  };

  const startNewEvent = (kind: CalendarEventKind = 'event') => {
    setEventDraft(createDraft(year, monthIndex, selectedDay, kind));
    setWorldbuildingQuery('');
  };

  const startEditing = (event: BelentorCalendarEvent) => {
    setEventDraft({
      id: event.id,
      title: event.title,
      notes: event.notes,
      kind: event.kind,
      year: event.year,
      monthIndex: event.monthIndex,
      day: event.day,
      annual: event.annual,
      worldbuildingIds: [...event.worldbuildingIds],
      createdAt: event.createdAt,
      updatedAt: event.updatedAt
    });
    setWorldbuildingQuery('');
  };

  const linkWorldbuildingEntry = (entry: WorldbuildingEntry) => {
    setEventDraft((current) => current ? {
      ...current,
      title: current.title.trim() ? current.title : entry.name,
      worldbuildingIds: [...current.worldbuildingIds, entry.id]
    } : current);
    setWorldbuildingQuery('');
  };

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!eventDraft?.title.trim() || saving) return;
    setSaving(true);
    setStatus('Applying calendar entry…');
    const view = { year: eventDraft.year, monthIndex: eventDraft.monthIndex, day: eventDraft.day };
    try {
      const result = await saveCalendarEvent(eventDraft, view);
      setEvents(result.events);
      setMonthIndex(result.view.monthIndex);
      setYear(result.view.year);
      setSelectedDay(result.view.day);
      setDirty(true);
      setStatus(result.status);
      setEventDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (event: BelentorCalendarEvent) => {
    if (!window.confirm(`Delete “${event.title}” from the calendar?`)) return;
    setSaving(true);
    setStatus('Removing calendar entry…');
    try {
      const result = await deleteCalendarEvent(event.id, { year, monthIndex, day: selectedDay });
      setEvents(result.events);
      setDirty(true);
      setStatus(result.status);
      if (eventDraft?.id === event.id) setEventDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const saveCalendar = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setStatus('Saving calendar to Google Drive…');
    try {
      const result = await saveCalendarToDrive({ year, monthIndex, day: selectedDay });
      setEvents(result.events);
      setMonthIndex(result.view.monthIndex);
      setYear(result.view.year);
      setSelectedDay(result.view.day);
      setDirty(result.syncState === 'pending' || result.syncState === 'error');
      setLastSavedAt(result.lastSavedAt);
      setStatus(result.status);
    } finally {
      setSaving(false);
    }
  };

  const refreshCalendar = async () => {
    if (saving) return;
    if (dirty && !window.confirm('Discard unsaved calendar changes and reload the saved calendar?')) return;
    setSaving(true);
    setStatus('Refreshing calendar…');
    try {
      const result = await loadCalendarEvents({ discardPending: true });
      setEvents(result.events);
      setMonthIndex(result.view.monthIndex);
      setYear(result.view.year);
      setSelectedDay(result.view.day);
      setDirty(result.syncState === 'pending' || result.syncState === 'error');
      setLastSavedAt(result.lastSavedAt);
      setStatus(result.status);
      setEventDraft(null);
      setWorldbuildingEntries((await listWorldbuildingEntries()).sort((left, right) => left.name.localeCompare(right.name)));
    } finally {
      setSaving(false);
    }
  };

  const savedTime = formatSavedTime(lastSavedAt);
  const saveStateLabel = saving
    ? '⟳ Working…'
    : dirty
      ? '● Unsaved calendar'
      : savedTime
        ? `✓ Saved ${savedTime}`
        : 'No unsaved changes';

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
          <input min="1" max="9999" onChange={(event) => { stageView({ year: clampYear(Number(event.target.value)), monthIndex, day: selectedDay }); setEventDraft(null); }} type="number" value={year} />
        </label>
        <button aria-label="Next month" onClick={() => moveMonth(1)} type="button">→</button>
        <button className="belentor-refresh-button" disabled={saving} onClick={() => void refreshCalendar()} type="button">Refresh entries</button>
      </div>

      <div className="belentor-calendar-save-bar">
        <p className="belentor-calendar-status" aria-live="polite">{status}</p>
        <div className="belentor-calendar-save-actions">
          <span className={dirty ? 'is-unsaved' : 'is-saved'}>{saveStateLabel}</span>
          <button className="belentor-save-button" disabled={saving || !dirty} onClick={() => void saveCalendar()} type="button">
            {saving ? 'Saving…' : '💾 Save Calendar'}
          </button>
        </div>
      </div>

      <div className="belentor-calendar-main">
        <section className="belentor-month-card" aria-label={`${monthTitle(month)}, ${year} AA`}>
          <header className="belentor-month-heading">
            <div>
              <p className="eyebrow">Month {monthIndex + 1} of 12 · 30 days</p>
              <h3>{month.name}</h3>
              {month.marker && <span className="belentor-season-marker">{month.marker}</span>}
            </div>
            <div className="belentor-month-heading-actions">
              <div className="belentor-star-card">
                <span>Star name</span>
                <strong>{month.star ?? '—'}</strong>
              </div>
              <button className="primary-button" onClick={() => startNewEvent()} type="button">+ Add entry</button>
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
                  {tenDay.days.map((day) => {
                    const dayEvents = eventsForDay(day);
                    return (
                      <button
                        aria-label={`${day} ${month.name}, ${year} AA${dayEvents.length ? `, ${dayEvents.length} calendar entries` : ''}`}
                        aria-selected={selectedDay === day}
                        className={`${selectedDay === day ? 'is-selected' : ''} ${dayEvents.length ? 'has-events' : ''}`.trim()}
                        key={day}
                        onClick={() => selectDay(day)}
                        role="gridcell"
                        type="button"
                      >
                        <span>{day}</span>
                        {dayEvents.length ? (
                          <span className="belentor-day-event-markers" aria-hidden>
                            {dayEvents.slice(0, 4).map((calendarEvent) => <i className={`kind-${calendarEvent.kind}`} key={calendarEvent.id} />)}
                          </span>
                        ) : <small>{((day - 1) % 10) + 1}</small>}
                        {dayEvents.length > 0 && <small>{dayEvents.length}</small>}
                      </button>
                    );
                  })}
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

          <section className="belentor-selected-events" aria-label={`Entries for ${selectedDay} ${month.name}, ${year} AA`}>
            <header>
              <div><p className="eyebrow">Date entries</p><h4>{selectedDateEvents.length ? `${selectedDateEvents.length} scheduled` : 'Nothing scheduled'}</h4></div>
              <div className="belentor-event-quick-actions">
                <button onClick={() => startNewEvent('holiday')} type="button">Holiday</button>
                <button onClick={() => startNewEvent('major-event')} type="button">Major event</button>
                <button onClick={() => startNewEvent('event')} type="button">Event</button>
              </div>
            </header>
            {selectedDateEvents.length ? (
              <div className="belentor-event-list">
                {selectedDateEvents.map((calendarEvent) => (
                  <article className={`belentor-event-card kind-${calendarEvent.kind}`} key={calendarEvent.id}>
                    <div className="belentor-event-card-heading">
                      <div><span>{eventKindLabels[calendarEvent.kind]}</span><strong>{calendarEvent.title}</strong><small>{eventDateLabel(calendarEvent)}</small></div>
                      <div><button onClick={() => startEditing(calendarEvent)} type="button">Edit</button><button className="quiet-danger" onClick={() => void removeEvent(calendarEvent)} type="button">Delete</button></div>
                    </div>
                    {calendarEvent.notes && <p>{calendarEvent.notes}</p>}
                    {calendarEvent.worldbuildingIds.length > 0 && (
                      <div className="belentor-linked-worldbuilding">
                        <span>Worldbuilding</span>
                        <div>{calendarEvent.worldbuildingIds.map((id) => <strong key={id}>{worldbuildingById.get(id)?.name ?? 'Missing entry'}</strong>)}</div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : <p className="belentor-empty-date">Add a holiday, campaign event, celestial occurrence, or note to this date.</p>}
          </section>
        </section>

        <aside className="belentor-year-overview" aria-label={`Months of ${year} AA`}>
          <header><p className="eyebrow">Year at a glance</p><h3>{year} AA</h3></header>
          <div>
            {belentorMonths.map((item, index) => (
              <button className={index === monthIndex ? 'is-selected' : ''} key={item.name} onClick={() => selectMonth(index)} type="button">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item.name}</strong>
                <small>{monthEventCounts[index] ? `${monthEventCounts[index]} calendar entr${monthEventCounts[index] === 1 ? 'y' : 'ies'}` : item.marker ?? item.star ?? '—'}</small>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {eventDraft && (
        <form className="belentor-event-editor" onSubmit={submitEvent}>
          <header>
            <div><p className="eyebrow">{events.some((event) => event.id === eventDraft.id) ? 'Edit calendar entry' : 'New calendar entry'}</p><h3>{eventDraft.title || 'Untitled entry'}</h3></div>
            <button aria-label="Close calendar entry editor" onClick={() => setEventDraft(null)} type="button">×</button>
          </header>
          <div className="belentor-event-fields">
            <label>Entry type<select onChange={(event) => setEventDraft((current) => current ? { ...current, kind: event.target.value as CalendarEventKind, annual: event.target.value === 'holiday' ? true : current.annual } : current)} value={eventDraft.kind}>{calendarEventKinds.map((kind) => <option key={kind} value={kind}>{eventKindLabels[kind]}</option>)}</select></label>
            <label className="belentor-event-title-field">Title<input autoFocus onChange={(event) => setEventDraft((current) => current ? { ...current, title: event.target.value } : current)} placeholder="Festival, battle, celestial event…" value={eventDraft.title} /></label>
            <label>Year AA<input disabled={eventDraft.annual} min="1" max="9999" onChange={(event) => setEventDraft((current) => current ? { ...current, year: clampYear(Number(event.target.value)) } : current)} type="number" value={eventDraft.year} /></label>
            <label>Month<select onChange={(event) => setEventDraft((current) => current ? { ...current, monthIndex: Number(event.target.value) } : current)} value={eventDraft.monthIndex}>{belentorMonths.map((item, index) => <option key={item.name} value={index}>{monthTitle(item)}</option>)}</select></label>
            <label>Day<input min="1" max="30" onChange={(event) => setEventDraft((current) => current ? { ...current, day: clampDay(Number(event.target.value)) } : current)} type="number" value={eventDraft.day} /></label>
            <label className="belentor-event-repeat"><input checked={eventDraft.annual} onChange={(event) => setEventDraft((current) => current ? { ...current, annual: event.target.checked } : current)} type="checkbox" />Repeat every year</label>
            <label className="belentor-event-notes-field">Notes<textarea onChange={(event) => setEventDraft((current) => current ? { ...current, notes: event.target.value } : current)} placeholder="Traditions, consequences, participants, preparation notes…" value={eventDraft.notes} /></label>
          </div>

          <section className="belentor-worldbuilding-linker">
            <div><p className="eyebrow">Worldbuilding links</p><h4>Add people, factions, places, deities, or other entries</h4></div>
            {eventDraft.worldbuildingIds.length > 0 && (
              <div className="belentor-worldbuilding-chips">
                {eventDraft.worldbuildingIds.map((id) => (
                  <button key={id} onClick={() => setEventDraft((current) => current ? { ...current, worldbuildingIds: current.worldbuildingIds.filter((item) => item !== id) } : current)} type="button">
                    {worldbuildingById.get(id)?.name ?? 'Missing entry'} <span aria-hidden>×</span>
                  </button>
                ))}
              </div>
            )}
            <input aria-label="Search Worldbuilding entries to link" onChange={(event) => setWorldbuildingQuery(event.target.value)} placeholder="Search Worldbuilding…" value={worldbuildingQuery} />
            <div className="belentor-worldbuilding-results">
              {visibleWorldbuildingEntries.map((entry) => <button key={entry.id} onClick={() => linkWorldbuildingEntry(entry)} type="button"><strong>{entry.name}</strong><span>{entry.kind}</span></button>)}
              {!visibleWorldbuildingEntries.length && <p>No available Worldbuilding entries match.</p>}
            </div>
          </section>

          <footer><button disabled={saving} onClick={() => setEventDraft(null)} type="button">Cancel</button><button className="primary-button" disabled={saving || !eventDraft.title.trim()} type="submit">{saving ? 'Applying…' : 'Apply calendar entry'}</button></footer>
        </form>
      )}

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
