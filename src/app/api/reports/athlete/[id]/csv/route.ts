import { NextResponse } from 'next/server';
import { getAthleteReport } from '@/lib/reports/athlete-report-data';
import { athleteReportToCsv } from '@/lib/reports/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const result = await getAthleteReport(params.id);
  if (!result.ok) {
    const status =
      result.error.kind === 'unauthenticated'
        ? 401
        : result.error.kind === 'not-found'
          ? 404
          : 403;
    return NextResponse.json({ error: result.error.kind }, { status });
  }

  const csv = athleteReportToCsv(result.data);
  const filename = `reporte-${slugify(
    `${result.data.athlete.firstName}-${result.data.athlete.lastName}`
  )}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}
