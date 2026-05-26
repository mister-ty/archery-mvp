import { z } from 'zod';

export const COMPETITION_TYPES = [
  'INDOOR_18M',
  'OUTDOOR_70M',
  'OUTDOOR_50M',
  'FIELD',
  'CLOUT',
  'THREE_D',
  'OTHER'
] as const;

export type CompetitionTypeCode = (typeof COMPETITION_TYPES)[number];

export const COMPETITION_TYPE_LABELS: Record<CompetitionTypeCode, string> = {
  INDOOR_18M: 'Indoor 18m',
  OUTDOOR_70M: 'Outdoor 70m',
  OUTDOOR_50M: 'Outdoor 50m',
  FIELD: 'Field',
  CLOUT: 'Clout',
  THREE_D: '3D',
  OTHER: 'Otro'
};

export const competitionCreateSchema = z.object({
  athleteId: z.string().cuid(),
  name: z.string().trim().min(1, 'Nombre requerido').max(120),
  date: z.coerce
    .date()
    .max(new Date(Date.now() + 24 * 60 * 60 * 1000), 'La fecha no puede ser futura')
    .refine((d) => d.getFullYear() >= 1990, 'Fecha fuera de rango'),
  type: z.enum(COMPETITION_TYPES),
  location: z.string().trim().max(120).optional().nullable(),
  totalScore: z
    .number()
    .int()
    .min(0, 'No puede ser negativo')
    .max(2000, 'Demasiado alto, revisa el dato'),
  rank: z.number().int().min(1).max(10000).optional().nullable(),
  xCount: z.number().int().min(0).max(720).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

export const competitionUpdateSchema = competitionCreateSchema.partial().extend({
  id: z.string().cuid()
});

export type CompetitionCreateInput = z.infer<typeof competitionCreateSchema>;
export type CompetitionUpdateInput = z.infer<typeof competitionUpdateSchema>;
