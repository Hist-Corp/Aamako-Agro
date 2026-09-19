import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, SendEmailOptions } from './email.service';

/**
 * Dev/test provider (default while `RESEND_API_KEY` is unset).
 *
 * The response contract is identical to production (`{ success: true }`
 * without revealing whether the address exists), so switching to Resend
 * changes nothing about the API behaviour.
 *
 * LOG HYGIENE: in development the full message (including the reset URL) is
 * printed so the forgot/reset flow is testable with zero email config. In
 * production the reset token is ALWAYS redacted from logs and a CRITICAL
 * warning is emitted instead — tokens never belong in server logs.
 */
@Injectable()
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';
  private readonly logger = new Logger(LogEmailProvider.name);

  async send(options: SendEmailOptions): Promise<void> {
    const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
    this.logger.log(
      `[email:log] to=${options.to} subject=${JSON.stringify(options.subject)}`,
    );
    if (!isProduction) {
      // Dev-only convenience: full body incl. the reset link (token visible).
      this.logger.log(options.text);
      return;
    }
    // Production fallback (RESEND_API_KEY missing!): redact reset tokens.
    const redacted = options.text.replace(
      /([?&]token=)[A-Za-z0-9_-]+/g,
      '$1<redacted>',
    );
    this.logger.warn(redacted);
    this.logger.error(
      'CRITICAL: no email provider configured (set RESEND_API_KEY + RESEND_FROM_EMAIL) — password-reset emails are NOT being delivered!',
    );
  }
}
