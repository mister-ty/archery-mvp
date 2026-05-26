import { z } from 'zod';

const DOMINANT_HAND = ['RIGHT', 'LEFT'] as const;

export const athleteCreateSchema = z.object({
  firstName: z.string().trim().min(1, 'Nombre requerido').max(80),
  lastName: z.string().trim().min(1, 'Apellido requerido').max(80),
  documentId: z
    .string()
    .trim()
    .min(4, 'Documento muy corto')
    .max(30, 'Documento muy largo'),
  birthDate: z.coerce
    .date()
    .max(new Date(), 'La fecha de nacimiento no puede ser futura')
    .refine(
      (d) => d.getFullYear() >= 1920,
      'Fecha de nacimiento fuera de rango'
    ),
  dominantHand: z.enum(DOMINANT_HAND),
  bowModalityId: z.string().cuid('Modalidad de arco inválida'),
  categoryId: z.string().cuid('Categoría inválida'),
  clubId: z.string().cuid('Club inválido'),
  coachId: z.string().cuid().optional().nullable()
});

export const athleteUpdateSchema = athleteCreateSchema.partial().extend({
  id: z.string().cuid(),
  active: z.boolean().optional()
});

export type AthleteCreateInput = z.infer<typeof athleteCreateSchema>;
export type AthleteUpdateInput = z.infer<typeof athleteUpdateSchema>;
