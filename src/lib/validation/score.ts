import { z } from 'zod';

/**
 * Single arrow value. Special encoding:
 *  - "X" => score 10, isX true (tie-breaker)
 *  - "M" => score 0, isMiss true
 *  - 0..10 => numeric score
 */
export const arrowValueSchema = z.union([
  z.literal('X'),
  z.literal('M'),
  z.number().int().min(0).max(10)
]);
export type ArrowValue = z.infer<typeof arrowValueSchema>;

export const arrowInputSchema = z.object({
  endNumber: z.number().int().min(1).max(20),
  arrowNumber: z.number().int().min(1).max(6),
  value: arrowValueSchema
});
export type ArrowInput = z.infer<typeof arrowInputSchema>;

export const scoreSetSaveSchema = z
  .object({
    sessionId: z.string().cuid(),
    distance: z.number().int().min(5).max(90),
    endsCount: z.number().int().min(1).max(20),
    arrowsPerEnd: z.number().int().min(3).max(6),
    arrows: z.array(arrowInputSchema).min(1)
  })
  .superRefine((data, ctx) => {
    // Validate no duplicates and arrows respect (endsCount × arrowsPerEnd)
    const seen = new Set<string>();
    for (const a of data.arrows) {
      const key = `${a.endNumber}:${a.arrowNumber}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Flecha duplicada en end ${a.endNumber} #${a.arrowNumber}`,
          path: ['arrows']
        });
      }
      seen.add(key);
      if (a.endNumber > data.endsCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `End ${a.endNumber} excede el máximo configurado (${data.endsCount})`,
          path: ['arrows']
        });
      }
      if (a.arrowNumber > data.arrowsPerEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Flecha ${a.arrowNumber} excede flechas por end (${data.arrowsPerEnd})`,
          path: ['arrows']
        });
      }
    }
  });

export type ScoreSetSaveInput = z.infer<typeof scoreSetSaveSchema>;

/**
 * Decode an ArrowValue into the persistence shape.
 */
export function decodeArrowValue(v: ArrowValue): {
  score: number;
  isX: boolean;
  isMiss: boolean;
} {
  if (v === 'X') return { score: 10, isX: true, isMiss: false };
  if (v === 'M') return { score: 0, isX: false, isMiss: true };
  return { score: v, isX: false, isMiss: false };
}
