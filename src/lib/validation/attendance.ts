import { z } from 'zod';

const ATTENDANCE_STATUS = ['PRESENT', 'ABSENT', 'JUSTIFIED', 'LATE'] as const;

export const attendanceUpdateSchema = z
  .object({
    sessionId: z.string().cuid(),
    status: z.enum(ATTENDANCE_STATUS),
    reason: z
      .string()
      .trim()
      .max(500, 'El motivo no puede exceder 500 caracteres')
      .optional()
      .nullable()
  })
  .refine(
    (v) => {
      if (v.status === 'PRESENT') return true;
      return !v.reason || v.reason.length === 0 || v.reason.trim().length > 0;
    },
    { message: 'Motivo inválido', path: ['reason'] }
  );

export type AttendanceUpdateInput = z.infer<typeof attendanceUpdateSchema>;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];
export const ATTENDANCE_STATUSES = ATTENDANCE_STATUS;

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  JUSTIFIED: 'Justificado',
  LATE: 'Tarde'
};
