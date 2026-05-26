import { z } from 'zod';

const SESSION_TYPES = ['TECHNICAL', 'SERIES', 'COMPETITION_SIM', 'WARMUP'] as const;
const TEMPLATE_KEYS = ['wa70', 'indoor18', 'cmp50', 'tech30'] as const;

const scoreSetSchema = z.object({
  distance: z.number().int().min(5).max(90),
  endsCount: z.number().int().min(1).max(20),
  arrowsPerEnd: z.number().int().min(1).max(12)
});

// Note: we use z.union (not discriminatedUnion) because the custom
// branch needs a .refine() for "no duplicate distances", and zod's
// discriminatedUnion rejects ZodEffects branches.
export const athleteSelfSessionSchema = z.union([
  z.object({
    mode: z.literal('template'),
    templateKey: z.enum(TEMPLATE_KEYS)
  }),
  z
    .object({
      mode: z.literal('custom'),
      type: z.enum(SESSION_TYPES),
      indoor: z.boolean().default(false),
      scoreSets: z
        .array(scoreSetSchema)
        .min(1, 'Define al menos una distancia')
        .max(6, 'Máximo 6 distancias por sesión')
    })
    .refine(
      (data) =>
        new Set(data.scoreSets.map((s) => s.distance)).size ===
        data.scoreSets.length,
      { message: 'No repitas la misma distancia', path: ['scoreSets'] }
    )
]);

export type AthleteSelfSessionInput = z.infer<typeof athleteSelfSessionSchema>;
