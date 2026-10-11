import { describe, expect, it } from 'vitest';
import {
  filterHomeworkDaysBySubject,
  getHomeworkHistoryDateKeys,
  getHomeworkSubjectOptions,
  isHomeworkDateInLast30Days,
} from './homework';

const day = (date, matiere = 'Mathématiques') => ({
  date,
  matieres: [{ matiere, aFaire: { contenu: 'devoir' } }],
});

describe('homework helpers', () => {
  it('builds the inclusive 30-day history range', () => {
    const referenceDate = new Date(2026, 9, 11, 12);
    const dates = getHomeworkHistoryDateKeys(referenceDate);

    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2026-09-12');
    expect(dates[dates.length - 1]).toBe('2026-10-11');
    expect(isHomeworkDateInLast30Days('2026-09-12', referenceDate)).toBe(true);
    expect(isHomeworkDateInLast30Days('2026-09-11', referenceDate)).toBe(false);
    expect(isHomeworkDateInLast30Days('2026-10-12', referenceDate)).toBe(false);
  });

  it('deduplicates and sorts subject options', () => {
    const options = getHomeworkSubjectOptions([
      day('2026-10-10', 'Mathématiques'),
      day('2026-10-09', 'français'),
      day('2026-10-08', 'Mathématiques'),
    ]);

    expect(options).toEqual([
      { key: 'français', label: 'français' },
      { key: 'mathématiques', label: 'Mathématiques' },
    ]);
  });

  it('filters a subject to the last 30 days', () => {
    const filtered = filterHomeworkDaysBySubject([
      day('2026-10-10'),
      day('2026-09-12', 'Français'),
      day('2026-09-11'),
      day('2026-10-10', 'Français'),
    ], 'mathématiques', new Date(2026, 9, 11, 12));

    expect(filtered.map(({ date }) => date)).toEqual(['2026-10-10']);
    expect(filtered[0].matieres[0].matiere).toBe('Mathématiques');
  });
});
