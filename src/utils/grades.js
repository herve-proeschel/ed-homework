const TREND_THRESHOLD = 0.25;

export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '–';
  return (Math.round(value * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

// Note ramenée sur 20 ; null si non numérique (absent, dispensé...) ou non significative
export function normalizedNote(note) {
  if (note.nonSignificatif) return null;
  const value = parseNumber(note.valeur);
  const outOf = parseNumber(note.noteSur) || 20;
  if (value === null || outOf <= 0) return null;
  return (value / outOf) * 20;
}

export function weightedAverage(notes) {
  let total = 0;
  let weights = 0;
  notes.forEach((note) => {
    const value = normalizedNote(note);
    if (value === null) return;
    const coef = parseNumber(note.coef);
    const weight = coef === null ? 1 : coef;
    if (weight <= 0) return;
    total += value * weight;
    weights += weight;
  });
  return weights ? total / weights : null;
}

export function trendFromDelta(delta) {
  if (delta === null) return null;
  if (delta > TREND_THRESHOLD) return 'up';
  if (delta < -TREND_THRESHOLD) return 'down';
  return 'stable';
}

// Compare la moyenne avec et sans les notes de la date la plus récente
export function subjectTrend(notes) {
  const dated = notes.filter((note) => normalizedNote(note) !== null && note.date);
  if (dated.length < 2) return null;
  const lastDate = dated.reduce((max, note) => (note.date > max ? note.date : max), '');
  const before = weightedAverage(dated.filter((note) => note.date < lastDate));
  const all = weightedAverage(dated);
  if (before === null || all === null) return null;
  return trendFromDelta(all - before);
}

export function generalTrend(subjects) {
  let before = 0;
  let all = 0;
  let weights = 0;
  subjects.forEach(({ notes, coef }) => {
    const dated = notes.filter((note) => normalizedNote(note) !== null && note.date);
    if (dated.length < 2 || !(coef > 0)) return;
    const lastDate = dated.reduce((max, note) => (note.date > max ? note.date : max), '');
    const avgBefore = weightedAverage(dated.filter((note) => note.date < lastDate));
    const avgAll = weightedAverage(dated);
    if (avgBefore === null || avgAll === null) return;
    before += avgBefore * coef;
    all += avgAll * coef;
    weights += coef;
  });
  return weights ? trendFromDelta((all - before) / weights) : null;
}

export function isRealPeriod(period) {
  return !period.annuel;
}

export function defaultPeriodCode(periods, today = new Date()) {
  if (!periods.length) return '';
  const day = today.toISOString().slice(0, 10);
  const real = periods.filter(isRealPeriod);
  const pool = real.length ? real : periods;
  const current = pool.find((p) => p.dateDebut <= day && day <= p.dateFin);
  return (current || pool[pool.length - 1]).codePeriode;
}

export function previousPeriod(periods, code) {
  const real = periods.filter(isRealPeriod);
  const index = real.findIndex((p) => p.codePeriode === code);
  return index > 0 ? real[index - 1] : null;
}

function mainDisciplines(period) {
  return (period?.ensembleMatieres?.disciplines || []).filter((d) => !d.groupeMatiere && !d.sousMatiere);
}


// Moyenne de classe reconstituée avec les moyennes de classe de chaque devoir
export function classWeightedAverage(notes) {
  return weightedAverage(
    notes
      .filter((note) => parseNumber(note.moyenneClasse) !== null)
      .map((note) => ({ ...note, valeur: note.moyenneClasse })),
  );
}

function combine(subjects, key) {
  let total = 0;
  let weights = 0;
  subjects.forEach((subject) => {
    if (subject[key] === null || !(subject.coef > 0)) return;
    total += subject[key] * subject.coef;
    weights += subject.coef;
  });
  return weights ? total / weights : null;
}

function buildSubjects(period, periodNotes) {
  return mainDisciplines(period).map((discipline) => {
    const notes = periodNotes
      .filter((n) => n.codeMatiere === discipline.codeMatiere)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return {
      code: discipline.codeMatiere,
      name: discipline.discipline,
      coef: discipline.coef,
      average: weightedAverage(notes),
      classAverage: classWeightedAverage(notes),
      trend: subjectTrend(notes),
      notes,
    };
  });
}

function notesOfPeriod(grades, period) {
  return period.annuel ? grades.notes : grades.notes.filter((n) => n.codePeriode === period.codePeriode);
}

export function buildGradesReport(grades, periodCode) {
  const period = grades.periodes.find((p) => p.codePeriode === periodCode);
  if (!period) return null;
  const previous = period.annuel ? null : previousPeriod(grades.periodes, periodCode);

  const allSubjects = buildSubjects(period, notesOfPeriod(grades, period));
  const previousSubjects = previous ? buildSubjects(previous, notesOfPeriod(grades, previous)) : [];
  const previousByCode = new Map(previousSubjects.map((s) => [s.code, s]));

  const subjects = allSubjects
    .filter((subject) => subject.notes.length)
    .map((subject) => ({ ...subject, previousAverage: previousByCode.get(subject.code)?.average ?? null }));

  return {
    period,
    previousPeriod: previous,
    general: {
      average: combine(allSubjects, 'average'),
      classAverage: combine(allSubjects, 'classAverage'),
      previousAverage: previous ? combine(previousSubjects, 'average') : null,
      trend: generalTrend(subjects),
    },
    subjects,
  };
}

