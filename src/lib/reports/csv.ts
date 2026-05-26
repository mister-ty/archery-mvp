import type { AthleteReport } from './athlete-report-data';

const UTF8_BOM = '﻿';

/**
 * RFC 4180 compliant escape:
 *  - If the value contains a comma, double quote, or newline,
 *    wrap it in double quotes and double any existing quotes.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(',');
}

function fmtDate(d: Date): string {
  // ISO with local timezone offset stripped — use UTC date portion for
  // consistency across exports.
  return d.toISOString().slice(0, 10);
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  TECHNICAL: 'Técnica',
  SERIES: 'Series',
  COMPETITION_SIM: 'Sim. Competición',
  WARMUP: 'Calentamiento'
};

export function athleteReportToCsv(report: AthleteReport): string {
  const header = [
    'Fecha',
    'Tipo',
    'Indoor',
    'Distancia (m)',
    'Flechas',
    'Total',
    'Promedio',
    'Xs'
  ];

  const rows = report.sessions.map((s) =>
    csvRow([
      fmtDate(s.date),
      SESSION_TYPE_LABEL[s.type] ?? s.type,
      s.indoor ? 'Sí' : 'No',
      s.distance,
      s.arrowsCount,
      s.total,
      s.avg !== null ? s.avg.toFixed(2) : '',
      s.xCount
    ])
  );

  // Summary lines at the bottom — prefixed with # so they are easy to
  // identify and ignore programatically while still being visible in Excel.
  const summary: string[] = [
    '',
    csvRow([`# Deportista`, `${report.athlete.firstName} ${report.athlete.lastName}`]),
    csvRow([`# Documento`, report.athlete.documentId]),
    csvRow([`# Modalidad`, report.athlete.bowModality]),
    csvRow([`# Categoría`, report.athlete.category]),
    csvRow([`# Club`, report.athlete.clubName]),
    csvRow([`# Sesiones`, report.totals.sessionCount]),
    csvRow([`# Total flechas válidas`, report.totals.arrowsCount]),
    csvRow([`# Total puntos`, report.totals.totalScore]),
    csvRow([
      `# Promedio por flecha`,
      report.totals.avgPerArrow !== null
        ? report.totals.avgPerArrow.toFixed(2)
        : ''
    ]),
    csvRow([`# Total X`, report.totals.xCount])
  ];

  const body = [csvRow(header), ...rows, ...summary].join('\r\n');
  return UTF8_BOM + body;
}
