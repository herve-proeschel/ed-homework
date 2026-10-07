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

function AverageBox({ title, subtitle, stats, previousLabel, general = false, back = null, children }) {
  const diff = stats.average !== null && stats.classAverage !== null ? stats.average - stats.classAverage : null;
  return (
    <section className={`grades-subject${general ? ' grades-subject--general' : ''}${back ? ' is-flipped' : ''}`}>
      <div className="grades-flip">
      <div className="grades-face grades-face--front">
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
      </div>
      <div className="grades-face grades-face--back" aria-hidden={!back}>{back}</div>
      </div>
    </section>
  );
}

const LEVELS = { 1: 'Non atteint', 2: 'Partiellement atteint', 3: 'Atteint', 4: 'Dépassé' };

function ProgramBack({ note, onClose }) {
  return (
    <div className="grade-back" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}>
      <header>
        <h2>{note.devoir || 'Devoir'}</h2>
        <span className="grades-average">Note : {formatGrade(note)}</span>
      </header>
      <ul>
        {note.elementsProgramme.map((el) => {
          const level = Math.max(0, Math.min(4, parseInt(el.valeur, 10) || 0));
          return (
            <li key={el.idElemProg} className="program-item">
              <span className="program-label">
                {el.descriptif}
                {el.libelleCompetence && <small>{el.libelleCompetence}</small>}
              </span>
              <span className={`program-level program-level--${level}`} title={LEVELS[level] || ''}>
                {[1, 2, 3, 4].map((n) => <i key={n} className={n <= level ? 'is-on' : ''} />)}
                <strong>{level}/4</strong>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GradeItem({ note, onFlip }) {
  const classAverage = parseNumber(note.moyenneClasse);
  const hasProgram = Array.isArray(note.elementsProgramme) && note.elementsProgramme.length > 0;
  const flipProps = hasProgram
    ? { onClick: onFlip, onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && onFlip(), role: 'button', tabIndex: 0 }
    : {};
  return (
    <li className={`grade-item${note.nonSignificatif ? ' is-ignored' : ''}${hasProgram ? ' has-program' : ''}`} {...flipProps}>
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
  const [flippedId, setFlippedId] = useState(null);
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
              onClick={() => { setSelected(period.codePeriode); setFlippedId(null); }}
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
          {report.subjects.map((subject) => {
            const flipped = subject.notes.find((n) => n.id === flippedId);
            return (
              <AverageBox
                key={subject.code}
                title={subject.name}
                stats={subject}
                previousLabel={report.previousPeriod?.periode}
                back={flipped ? <ProgramBack note={flipped} onClose={() => setFlippedId(null)} /> : null}
              >
                {subject.notes.length > 0 && <ul>{subject.notes.map((note) => <GradeItem key={note.id} note={note} onFlip={() => setFlippedId(note.id)} />)}</ul>}
              </AverageBox>
            );
          })}
        </>
      )}
    </div>
  );
}
