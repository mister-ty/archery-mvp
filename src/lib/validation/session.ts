import { z } from 'zod';

const SESSION_TYPES = ['TECHNICAL', 'SERIES', 'COMPETITION_SIM', 'WARMUP'] as const;
const WEATHER = ['CALM', 'MODERATE', 'STRONG'] as const;

// Distancias válidas en metros — múltiplos típicos de tiro con arco.
// 18 indoor, 30/50/60/70/90 outdoor. Permitimos 10..90 para flexibilidad técnica.
const distanceSchema = z
  .number()
  .int()
  .min(5, 'Distancia mínima 5m')
  .max(90, 'Distancia máxima 90m');

export const sessionCreateSchema = z
  .object({
    athleteIds: z
      .array(z.string().cuid())
      .min(1, 'Selecciona al menos un deportista'),
    date: z.coerce
      .date()
      .max(new Date(Date.now() + 60_000), 'La sesión no puede ser futura'),
    type: z.enum(SESSION_TYPES),
    indoor: z.boolean().default(false),
    weather: z.enum(WEATHER).optional().nullable(),
    weatherNotes: z.string().max(300).optional().nullable(),
    distances: z
      .array(distanceSchema)
      .min(1, 'Define al menos una distancia')
      .max(6, 'Máximo 6 distancias por sesión')
  })
  .refine(
    (data) => new Set(data.distances).size === data.distances.length,
    { message: 'No repitas la misma distancia', path: ['distances'] }
  );

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
