import { describe, expect, it } from 'vitest';
import { buildGradesReport, defaultPeriodCode, parseNumber, subjectTrend } from './grades';

const note = (date, valeur, extra = {}) => ({ id: date + valeur, date, valeur, noteSur: '20', coef: '1', codeMatiere: 'MATHS', ...extra });

describe('grades utils', () => {
  it('parses French decimals', () => {
    expect(parseNumber('11,45')).toBe(11.45);
    expect(parseNumber('Abs')).toBeNull();
  });

  it('computes the trend from the latest notes', () => {
    expect(subjectTrend([note('2026-09-01', '10'), note('2026-09-10', '16')])).toBe('up');
    expect(subjectTrend([note('2026-09-01', '10'), note('2026-09-10', '10')])).toBe('stable');
    expect(subjectTrend([note('2026-09-01', '16'), note('2026-09-10', '4')])).toBe('down');
    expect(subjectTrend([note('2026-09-01', '16')])).toBeNull();
  });

  it('computes everything from notes and ignores unreliable API averages', () => {
    const disc = (code, coef) => ({ codeMatiere: code, discipline: code, moyenne: '0', moyenneClasse: '1', coef, rang: 3, effectif: 30 });
    const mk = (periode, dateDebut, dateFin) => ({ codePeriode: periode, periode, dateDebut, dateFin, ensembleMatieres: { moyenneGenerale: '0', moyenneClasse: '0', disciplines: [disc('MATHS', 1), disc('ITA2', 1)] } });
    const grades = {
      periodes: [
        mk('A001', '2026-09-01', '2027-01-29'),
        mk('A002', '2027-01-30', '2027-06-30'),
        { codePeriode: 'A999Z', periode: 'AnnÃ©e', annuel: true, ensembleMatieres: { disciplines: [] } },
      ],
      notes: [
        note('2026-10-01', '10', { codePeriode: 'A001', moyenneClasse: '12' }),
        note('2027-02-01', '12', { codePeriode: 'A002', moyenneClasse: '10' }),
        note('2027-02-10', '16', { codePeriode: 'A002', moyenneClasse: '14' }),
        note('2027-02-10', '6', { codePeriode: 'A002', noteSur: '10', coef: '2', moyenneClasse: '5' }),
      ],
    };
    expect(defaultPeriodCode(grades.periodes, new Date('2027-02-15'))).toBe('A002');
    const report = buildGradesReport(grades, 'A002');
    expect(report.subjects).toHaveLength(1);
    expect(report.subjects[0]).toMatchObject({ code: 'MATHS', previousAverage: 10, trend: 'up' });
    expect(report.subjects[0].average).toBeCloseTo((12 + 16 + 12 * 2) / 4);
    expect(report.subjects[0].classAverage).toBeCloseTo((10 + 14 + 10 * 2) / 4);
    expect(report.general.average).toBeCloseTo(report.subjects[0].average);
    expect(report.general.previousAverage).toBe(10);
    expect(buildGradesReport(grades, 'A001').previousPeriod).toBeNull();
  });
});



