/**
 * Email transport.
 *
 * Strategy:
 *  - If `RESEND_API_KEY` is set: send the email via Resend.
 *  - Otherwise: log it to the server console with the link visible,
 *    so local dev and CI work without external dependencies.
 *
 * The contract is one async function that NEVER throws — callers do not
 * have to retry on transient errors. Failures are logged and surfaced
 * in the returned object so the calling action can decide what to tell
 * the user. We never block the invitation creation on email delivery.
 */

import { Resend } from 'resend';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendResult =
  | { ok: true; provider: 'resend' | 'console'; id?: string }
  | { ok: false; provider: 'resend' | 'console'; error: string };

let cachedClient: Resend | null = null;

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cachedClient ??= new Resend(key);
  return cachedClient;
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const client = getResendClient();

  if (!client) {
    // Dev/test path — log the message so the operator can copy the link.
    console.log(
      `[email:console] to=${msg.to} subject=${JSON.stringify(msg.subject)}`
    );
    console.log(`[email:console] body:\n${msg.text}`);
    return { ok: true, provider: 'console' };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@archery.local';

  try {
    const { data, error } = await client.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html
    });
    if (error) {
      console.error('[email:resend] send failed', error);
      return { ok: false, provider: 'resend', error: error.message };
    }
    return { ok: true, provider: 'resend', id: data?.id };
  } catch (err) {
    console.error('[email:resend] threw', err);
    return {
      ok: false,
      provider: 'resend',
      error: err instanceof Error ? err.message : 'Unknown email error'
    };
  }
}
