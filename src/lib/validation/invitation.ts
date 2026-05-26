import { z } from 'zod';

export const INVITABLE_ROLES = ['ATHLETE', 'COACH', 'CLUB_ADMIN'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const INVITABLE_ROLE_LABELS: Record<InvitableRole, string> = {
  ATHLETE: 'Deportista',
  COACH: 'Coach',
  CLUB_ADMIN: 'Administrador del club'
};

export const invitationCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email inválido')
    .max(120),
  role: z.enum(INVITABLE_ROLES),
  clubId: z.string().cuid('Club inválido')
});

export const invitationAcceptSchema = z
  .object({
    token: z.string().min(16, 'Token inválido'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(72, 'Máximo 72 caracteres'),
    passwordConfirm: z.string(),
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional()
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm']
  });

export const coachOnboardingSchema = z.object({
  firstName: z.string().trim().min(1, 'Nombre requerido').max(80),
  lastName: z.string().trim().min(1, 'Apellido requerido').max(80)
});

export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;
export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>;
export type CoachOnboardingInput = z.infer<typeof coachOnboardingSchema>;
