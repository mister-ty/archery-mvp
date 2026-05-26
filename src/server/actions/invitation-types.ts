import type { Role } from '@prisma/client';

export type PendingInvitation = {
  id: string;
  email: string;
  role: Role;
  clubName: string;
  expiresAt: Date;
  createdAt: Date;
  expired: boolean;
};

export type InvitationLookup = {
  id: string;
  email: string;
  role: Role;
  clubName: string;
  expiresAt: Date;
};
