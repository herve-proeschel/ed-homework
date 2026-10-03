import { useEffect, useRef } from 'react';

function parseDate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function scheduleDateKey(value) {
  const key = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
}

function startOfWeek(date) {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeek(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function positionEvent(event) {
  const start = parseDate(event.start_date);
  const end = parseDate(event.end_date) || start;
  if (!start || !end) return null;
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const visibleStart = Math.max(480, startMinutes);
  const visibleEnd = Math.min(1080, Math.max(visibleStart + 1, endMinutes));
  if (visibleStart >= 1080 || visibleEnd <= 480) return null;
  return {
    top: ((visibleStart - 480) / 600) * 100,
    height: ((visibleEnd - visibleStart) / 600) * 100,
  };
}

function buildWeeks(events) {
  const weeks = new Map();
  events
    .map((event) => ({ ...event, parsedStart: parseDate(event.start_date), scheduleDateKey: scheduleDateKey(event.start_date) }))
    .filter((event) => event.parsedStart && event.scheduleDateKey)
    .sort((a, b) => a.parsedStart - b.parsedStart)
    .forEach((event) => {
      const start = startOfWeek(event.parsedStart);
      const key = dateKey(start);
      if (!weeks.has(key)) weeks.set(key, { start, events: [] });
      weeks.get(key).events.push(event);
    });
  return [...weeks.values()];
}

function ScheduleEvent({ event, lane, laneCount }) {
  const position = positionEvent(event);
  if (!position) return null;
  const color = /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : '#d9e8f3';
  const left = (lane * 100) / laneCount;
  const right = ((laneCount - lane - 1) * 100) / laneCount;
  const start = parseDate(event.start_date);
  const end = parseDate(event.end_date) || start;
  return (
    <article
      className={`schedule-event${event.isAnnule ? ' is-cancelled' : ''}`}
      style={{ '--event-color': color, top: `${position.top}%`, height: `${position.height}%`, left: `calc(${left}% + 5px)`, right: `calc(${right}% + 5px)` }}
    >
      <div className="schedule-time">{start?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {end?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
      <h3>{event.matiere || event.text || 'Cours'}</h3>
      {event.isAnnule && <span className="schedule-cancelled">Annulé</span>}
      <div className="schedule-room">{event.salle?.trim() || 'Salle non indiquée'}</div>
      {event.prof?.trim() && <div className="schedule-prof">{event.prof.trim()}</div>}
      {event.groupe?.trim() && <div className="schedule-group">{event.groupe.trim()}</div>}
    </article>
  );
}

function ScheduleWeek({ week, firstWeek, todayKey }) {
  const days = Array.from({ length: 5 }, (_, index) => {
    const day = new Date(week.start);
    day.setDate(day.getDate() + index);
    return day;
  });
  if (firstWeek) {
    const todayIndex = days.findIndex((day) => dateKey(day) === todayKey);
    if (todayIndex > 0) days.push(...days.splice(0, todayIndex));
  }
  return (
    <section className="schedule-week">
      <h2>Semaine du {formatWeek(week.start)}</h2>
      <div className="schedule-grid">
        <div className="schedule-hours schedule-hours--shared" aria-hidden="true">{Array.from({ length: 11 }, (_, hour) => <span className="schedule-hour" key={hour} style={{ top: `${hour * 10}%` }}>{String(hour + 8).padStart(2, '0')}:00</span>)}</div>
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = week.events.filter((event) => event.scheduleDateKey === key).sort((a, b) => parseDate(a.start_date) - parseDate(b.start_date));
          const lanes = [];
          const positioned = dayEvents.map((event) => {
            const start = parseDate(event.start_date);
            const end = parseDate(event.end_date) || start;
            let lane = lanes.findIndex((laneEnd) => laneEnd <= start);
            if (lane === -1) lane = lanes.length;
            lanes[lane] = end;
            return { event, lane };
          });
          const laneCount = Math.max(1, lanes.length);
          return (
            <section className="schedule-day" key={key} style={{ '--print-order': day.getDay() || 7 }}>
              <header><strong>{day.toLocaleDateString('fr-FR', { weekday: 'long' })}</strong><span>{day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></header>
              <div className="schedule-events">
                {positioned.length ? positioned.map(({ event, lane }) => <ScheduleEvent key={`${event.id || event.start_date}-${lane}`} event={event} lane={lane} laneCount={laneCount} />) : <div className="schedule-empty">Aucun cours</div>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default function ScheduleView({ events, hasMore, loading, onLoadMore }) {
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMore || loading || !sentinelRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore();
    }, { rootMargin: '240px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!events.length) return null;
  const weeks = buildWeeks(events);
  const todayKey = dateKey(new Date());
  return (
    <div id="scheduleView">
      {weeks.map((week, index) => <ScheduleWeek key={dateKey(week.start)} week={week} firstWeek={index === 0} todayKey={todayKey} />)}
      {hasMore && <div className="schedule-load-more" ref={sentinelRef}>{loading ? 'Chargement de la semaine suivante...' : 'Faites défiler pour charger la semaine suivante.'}</div>}
    </div>
  );
}