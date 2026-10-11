import { getHomeworkDocumentSections, getHomeworkSession } from './homeworkDocuments';

export const HOMEWORK_HISTORY_DAYS = 30;

export function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getHomeworkHistoryDateKeys(referenceDate = new Date()) {
  return Array.from({ length: HOMEWORK_HISTORY_DAYS }, (_, index) => {
    const date = new Date(referenceDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - HOMEWORK_HISTORY_DAYS + index + 1);
    return getDateKey(date);
  });
}

export function isHomeworkDateInLast30Days(dateValue, referenceDate = new Date()) {
  if (typeof dateValue !== 'string' || !dateValue) return false;
  const historyDates = getHomeworkHistoryDateKeys(referenceDate);
  const firstDate = historyDates[0];
  const lastDate = historyDates[historyDates.length - 1];
  return dateValue >= firstDate && dateValue <= lastDate;
}

export function normalizeHomeworkSubject(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
}

export function hasHomeworkSubjectContent(subject) {
  const session = getHomeworkSession(subject);
  const documents = getHomeworkDocumentSections(subject);
  return Boolean(
    subject?.aFaire
      || session?.contenu
      || documents.homework.length > 0
      || documents.session.length > 0,
  );
}

export function getHomeworkSubjectOptions(days) {
  const subjects = new Map();
  (Array.isArray(days) ? days : []).forEach((day) => {
    (day?.matieres || []).forEach((subject) => {
      if (!hasHomeworkSubjectContent(subject)) return;
      const label = String(subject.matiere || '').trim();
      const key = normalizeHomeworkSubject(label);
      if (label && key && !subjects.has(key)) subjects.set(key, label);
    });
  });

  return [...subjects.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' }));
}

export function filterHomeworkDaysBySubject(days, selectedSubject, referenceDate = new Date()) {
  if (!selectedSubject) return days;

  return (Array.isArray(days) ? days : [])
    .filter((day) => isHomeworkDateInLast30Days(day?.date, referenceDate))
    .map((day) => ({
      ...day,
      matieres: (day.matieres || []).filter(
        (subject) => normalizeHomeworkSubject(subject.matiere) === selectedSubject,
      ),
    }))
    .filter((day) => day.loading || day.matieres.length > 0);
}

export function getHomeworkDisplayDays(days, historyDays, selectedSubject, filterOpen) {
  const sourceDays = filterOpen && selectedSubject ? historyDays ?? days : days;
  return filterHomeworkDaysBySubject(sourceDays, filterOpen ? selectedSubject : '');
}
