import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, SendEmailOptions } from './email.service';

/**
 * Resend provider — real delivery via the Resend HTTP API.
 *
 * ENABLEMENT (env-only, no code changes — see `Backend/.env.example`):
 *   1. Create an API key at https://resend.com/api-keys
 *   2. Verify your sender domain at https://resend.com/domains
 *      (or use `onboarding@resend.dev` for smoke tests only)
 *   3. Set in the backend environment / Render dashboard:
 *        RESEND_API_KEY="re_..."
 *        RESEND_FROM_EMAIL="no-reply@aamakoagro.com"   (verified domain)
 *        RESEND_FROM_NAME="Aama ko Agro"               (optional display name)
 *        EMAIL_REPLY_TO="support@aamakoagro.com"       (optional)
 *   4. Restart the API. Startup logs `[email] provider=resend`.
 *
 * Why `fetch` and not the `resend` npm package? The API is a single
 * `POST /emails` call — `fetch` (Node 18+ global) avoids a dependency while
 * keeping the exact same wire behaviour. If you later need templates,
 * webhooks, or batch send, swap this file's internals for the SDK; the
 * `EmailProvider` contract (and all callers) stay untouched.
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);

  async send(options: SendEmailOptions): Promise<void> {
    const apiKey = (process.env.RESEND_API_KEY ?? '').trim();
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set — cannot send via Resend');
    }
    const fromEmail = (process.env.RESEND_FROM_EMAIL ?? '').trim();
    if (!fromEmail) {
      throw new Error('RESEND_FROM_EMAIL is not set — configure your verified Resend sender first');
    }
    // Optional display name → "Aama ko Agro <no-reply@aamakoagro.com>".
    const fromName = (process.env.RESEND_FROM_NAME ?? '').trim();
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    const replyTo = (process.env.EMAIL_REPLY_TO ?? '').trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        text: options.text,
        ...(options.html ? { html: options.html } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(options.tags?.length ? { tags: options.tags } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Resend send failed: HTTP ${res.status} ${body.slice(0, 500)}`);
      throw new Error('Unable to send email right now. Please try again later.');
    }
  }
}
