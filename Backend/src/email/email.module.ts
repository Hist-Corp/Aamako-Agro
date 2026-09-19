import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ResendEmailProvider } from './resend.provider';
import { LogEmailProvider } from './log.provider';

/**
 * Global email module — import once via `AppModule`, inject `EmailService`
 * anywhere (`constructor(private email: EmailService)`).
 *
 * Provider selection is 100% environment-based (no code changes needed):
 *   - `RESEND_API_KEY` set    → real delivery via the Resend HTTP API.
 *   - `RESEND_API_KEY` unset  → `LogEmailProvider`: the message (incl. the
 *     reset URL) is logged to stdout so the full forgot/reset flow can be
 *     exercised in dev without any email account.
 *
 * To enable Resend later, ONLY set env vars (see `Backend/.env.example`):
 *   RESEND_API_KEY="re_..."
 *   RESEND_FROM_EMAIL="no-reply@aamakoagro.com"   (must be a verified sender/domain in Resend)
 *   RESEND_FROM_NAME="Aama ko Agro"               (optional display name)
 *   EMAIL_REPLY_TO="support@aamakoagro.com"       (optional)
 */
@Global()
@Module({
  providers: [
    ResendEmailProvider,
    LogEmailProvider,
    {
      provide: EmailService,
      useFactory: (resend: ResendEmailProvider, log: LogEmailProvider) => {
        const apiKey = (process.env.RESEND_API_KEY ?? '').trim();
        if (apiKey) {
          // eslint-disable-next-line no-console
          console.log('[email] provider=resend');
          return new EmailService(resend);
        }
        // eslint-disable-next-line no-console
        console.log('[email] provider=log (set RESEND_API_KEY to send real email via Resend)');
        return new EmailService(log);
      },
      inject: [ResendEmailProvider, LogEmailProvider],
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
