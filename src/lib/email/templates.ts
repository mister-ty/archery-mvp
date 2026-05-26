import type { Role } from '@prisma/client';
import { INVITABLE_ROLE_LABELS, type InvitableRole } from '@/lib/validation/invitation';
import type { EmailMessage } from './send';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function invitationEmail(opts: {
  to: string;
  role: Role;
  clubName: string;
  link: string;
  expiresInDays: number;
}): EmailMessage {
  const roleLabel =
    INVITABLE_ROLE_LABELS[opts.role as InvitableRole] ?? opts.role;
  const subject = `Te invitan a Archery MVP (${roleLabel} · ${opts.clubName})`;

  const text = [
    `Hola,`,
    ``,
    `Te invitan a unirte a Archery MVP como ${roleLabel} en ${opts.clubName}.`,
    ``,
    `Activa tu cuenta y crea tu contraseña en este link:`,
    opts.link,
    ``,
    `El link es válido por ${opts.expiresInDays} días.`,
    ``,
    `Si no esperabas esta invitación, puedes ignorar este mensaje.`,
    ``,
    `— Archery MVP`
  ].join('\n');

  const safeLink = escapeHtml(opts.link);
  const safeRole = escapeHtml(roleLabel);
  const safeClub = escapeHtml(opts.clubName);
  const html = `<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <h1 style="font-size: 18px; color: #16a34a; margin: 0 0 16px;">Archery MVP</h1>
  <p>Te invitan a unirte como <strong>${safeRole}</strong> en <strong>${safeClub}</strong>.</p>
  <p style="margin: 24px 0;">
    <a href="${safeLink}" style="display: inline-block; background: #16a34a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Activar mi cuenta</a>
  </p>
  <p style="font-size: 12px; color: #6b7280;">O copia este link en tu navegador:<br><span style="word-break: break-all;">${safeLink}</span></p>
  <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">El link expira en ${opts.expiresInDays} días. Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
</body></html>`;

  return { to: opts.to, subject, text, html };
}
