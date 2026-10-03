import { useState } from 'react';
import { buildGradesReport, defaultPeriodCode, formatNumber, parseNumber } from '../utils/grades';

const TRENDS = {
  up: { icon: '▲', label: 'En hausse' },
  stable: { icon: '▬', label: 'Stable' },
  down: { icon: '▼', label: 'En baisse' },
};

function formatGrade(note) {
  const value = String(note.valeur ?? '').trim();
  if (!value) return '–';
  const numeric = parseNumber(value);
  const outOf = parseNumber(note.noteSur);
  return numeric !== null && outOf && outOf !== 20 ? `${formatNumber(numeric)}/${outOf}` : value;
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function Trend({ trend }) {
  if (!trend) return null;
  const { icon, label } = TRENDS[trend];
  return <span className={`grade-trend grade-trend--${trend}`} title={label}>{icon} {label}</span>;
}

function Bar({ label, value, kind }) {
  if (value === null) return null;
  return (
    <div className="grade-bar-row">
      <span className="grade-bar-label">{label}</span>
      <span className="grade-bar"><span className={`grade-bar-fill grade-bar-fill--${kind}`} style={{ width: `${Math.max(0, Math.min(100, (value / 20) * 100))}%` }} /></span>
      <strong className="grade-bar-value">{formatNumber(value)}</strong>
    </div>
  );
}

function AverageBox({ title, subtitle, stats, previousLabel, general = false, children }) {
  const diff = stats.average !== null && stats.classAverage !== null ? stats.average - stats.classAverage : null;
  return (
    <section className={`grades-subject${general ? ' grades-subject--general' : ''}`}>
      <header>
        <h2>{title}</h2>
        {subtitle && <span className="grades-average">{subtitle}</span>}
        <Trend trend={stats.trend} />
      </header>
      <div className="grades-compare">
        <Bar label="Élève" value={stats.average} kind="student" />
        <Bar label="Classe" value={stats.classAverage} kind="class" />
        {diff !== null && <div className={`grades-diff${diff < 0 ? ' is-negative' : ''}`}>{diff >= 0 ? '+' : ''}{formatNumber(diff)} par rapport à la classe</div>}
        {previousLabel && stats.previousAverage !== null && (
          <div className="grades-previous">{previousLabel} : <strong>{formatNumber(stats.previousAverage)}</strong></div>
        )}
      </div>
      {children}
    </section>
  );
}

function GradeItem({ note }) {
  const classAverage = parseNumber(note.moyenneClasse);
  return (
    <li className={`grade-item${note.nonSignificatif ? ' is-ignored' : ''}`}>
      <span className="grade-date">{formatDate(note.date)}</span>
      <span className="grade-title">
        {note.devoir || 'Devoir'}
        {note.codeSousMatiere && <small>{note.libelleMatiere}</small>}
        {note.commentaire && <small>{note.commentaire}</small>}
      </span>
      <span className="grade-value">
        {formatGrade(note)}
        {note.coef && parseNumber(note.coef) !== 1 && <small>coef {note.coef}</small>}
        {classAverage !== null && <small>classe {formatNumber(classAverage)}</small>}
      </span>
    </li>
  );
}

export default function GradesView({ grades }) {
  const [selected, setSelected] = useState('');
  if (!grades) return null;

  const periods = grades.periodes;
  const code = periods.some((p) => p.codePeriode === selected) ? selected : defaultPeriodCode(periods);
  const report = buildGradesReport(grades, code);

  return (
    <div id="gradesView">
      {periods.length > 1 && (
        <div className="grades-periods" role="tablist">
          {periods.map((period) => (
            <button
              type="button"
              role="tab"
              key={period.codePeriode}
              aria-selected={period.codePeriode === code}
              className={`grades-period${period.codePeriode === code ? ' is-active' : ''}`}
              onClick={() => setSelected(period.codePeriode)}
            >
              {period.periode}
            </button>
          ))}
        </div>
      )}
      {!report && <div className="grades-empty">Aucune note disponible.</div>}
      {report && (
        <>
          <AverageBox
            general
            title="Moyenne générale"
            subtitle={report.period.periode}
            stats={report.general}
            previousLabel={report.previousPeriod?.periode}
          />
          {report.subjects.length === 0 && <div className="grades-empty">Aucune note pour cette période.</div>}
          {report.subjects.map((subject) => (
            <AverageBox
              key={subject.code}
              title={subject.name}
              stats={subject}
              previousLabel={report.previousPeriod?.periode}
            >
              {subject.notes.length > 0 && <ul>{subject.notes.map((note) => <GradeItem key={note.id} note={note} />)}</ul>}
            </AverageBox>
          ))}
        </>
      )}
    </div>
  );
}

