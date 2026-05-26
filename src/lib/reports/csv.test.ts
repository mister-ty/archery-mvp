import { describe, it, expect } from 'vitest';
import { csvEscape, csvRow, athleteReportToCsv } from './csv';
import type { AthleteReport } from './athlete-report-data';

describe('csvEscape', () => {
  it('returns plain strings unchanged', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(42)).toBe('42');
  });

  it('returns empty string for null/undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes values containing commas', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });

  it('quotes values containing newlines', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('escapes embedded double quotes', () => {
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
  });

  it('handles values that are only quotes', () => {
    expect(csvEscape('"')).toBe('""""');
  });
});

describe('csvRow', () => {
  it('joins cells with commas', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('escapes individual cells', () => {
    expect(csvRow(['a,b', 'c"d', 'e'])).toBe('"a,b","c""d",e');
  });

  it('handles mixed types', () => {
    expect(csvRow(['name', 42, true, null])).toBe('name,42,true,');
  });
});

function buildReport(overrides: Partial<AthleteReport> = {}): AthleteReport {
  return {
    athlete: {
      id: 'a1',
      firstName: 'Sofía',
      lastName: 'Ramírez',
      documentId: '12345',
      bowModality: 'Recurvo',
      category: 'Mayor',
      clubName: 'Club, Demo',
      coachName: 'Carlos Mendoza'
    },
    periodFrom: new Date('2025-01-01T00:00:00Z'),
    periodTo: new Date('2025-12-31T00:00:00Z'),
    sessions: [],
    observations: [],
    totals: {
      sessionCount: 0,
      arrowsCount: 0,
      xCount: 0,
      totalScore: 0,
      avgPerArrow: null
    },
    ...overrides
  };
}

describe('athleteReportToCsv', () => {
  it('starts with UTF-8 BOM for Excel compatibility', () => {
    const csv = athleteReportToCsv(buildReport());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('includes the standard header row', () => {
    const csv = athleteReportToCsv(buildReport());
    expect(csv).toContain(
      'Fecha,Tipo,Indoor,Distancia (m),Flechas,Total,Promedio,Xs'
    );
  });

  it('escapes club names containing commas in summary lines', () => {
    const csv = athleteReportToCsv(buildReport());
    expect(csv).toContain('"Club, Demo"');
  });

  it('renders one row per session distance', () => {
    const csv = athleteReportToCsv(
      buildReport({
        sessions: [
          {
            sessionId: 's1',
            date: new Date('2025-06-15T10:00:00Z'),
            type: 'TECHNICAL',
            indoor: true,
            distance: 18,
            arrowsCount: 36,
            xCount: 3,
            total: 320,
            avg: 8.89
          },
          {
            sessionId: 's1',
            date: new Date('2025-06-15T10:00:00Z'),
            type: 'TECHNICAL',
            indoor: true,
            distance: 25,
            arrowsCount: 36,
            xCount: 1,
            total: 290,
            avg: 8.06
          }
        ],
        totals: {
          sessionCount: 1,
          arrowsCount: 72,
          xCount: 4,
          totalScore: 610,
          avgPerArrow: 8.47
        }
      })
    );
    expect(csv).toContain('2025-06-15,Técnica,Sí,18,36,320,8.89,3');
    expect(csv).toContain('2025-06-15,Técnica,Sí,25,36,290,8.06,1');
  });

  it('uses CRLF line endings (RFC 4180)', () => {
    const csv = athleteReportToCsv(buildReport());
    expect(csv).toContain('\r\n');
  });

  it('emits empty cell when avg is null', () => {
    const csv = athleteReportToCsv(
      buildReport({
        sessions: [
          {
            sessionId: 's1',
            date: new Date('2025-06-15T10:00:00Z'),
            type: 'WARMUP',
            indoor: false,
            distance: 70,
            arrowsCount: 6,
            xCount: 0,
            total: 0,
            avg: null
          }
        ]
      })
    );
    expect(csv).toContain('2025-06-15,Calentamiento,No,70,6,0,,0');
  });
});
