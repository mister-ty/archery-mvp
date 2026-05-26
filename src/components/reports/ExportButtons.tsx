import { Download, FileText } from 'lucide-react';

type Props = {
  athleteId: string;
  hasData?: boolean;
};

export function ExportButtons({ athleteId, hasData = true }: Props) {
  if (!hasData) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Aún no hay datos para exportar.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`/api/reports/athlete/${athleteId}/csv`}
        className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition"
        download
      >
        <Download className="h-3.5 w-3.5" />
        CSV
      </a>
      <a
        href={`/api/reports/athlete/${athleteId}/pdf`}
        className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FileText className="h-3.5 w-3.5" />
        PDF
      </a>
    </div>
  );
}
