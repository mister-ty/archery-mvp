import { AttendanceToggle } from './AttendanceToggle';
import type { GroupAttendanceRow } from '@/server/actions/attendance';

type Props = {
  rows: GroupAttendanceRow[];
};

export function GroupAttendanceList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No hay deportistas en este grupo.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {rows.map((row) => (
        <li key={row.sessionId} className="p-3 space-y-2">
          <p className="text-sm font-medium">{row.athleteName}</p>
          <AttendanceToggle
            sessionId={row.sessionId}
            initialStatus={row.status}
            initialReason={row.reason}
            athleteLabel={row.athleteName}
            compact
          />
        </li>
      ))}
    </ul>
  );
}
