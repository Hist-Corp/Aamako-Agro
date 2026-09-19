/**
 * Email provider abstraction.
 *
 * `AuthService` (password reset) and any future sender (order confirmations,
 * wholesale updates…) depend ONLY on `EmailService.send()`. Adding or
 * swapping a real ESP (Resend today, SES/SMTP tomorrow) means adding one
 * `EmailProvider` implementation + wiring it in `email.module.ts` — the
 * password-reset logic never changes.
 */

export interface SendEmailOptions {
  /** Recipient, e.g. `ram@example.com`. */
  to: string;
  /** Subject line. */
  subject: string;
  /** Plain-text body (always provided — the accessibility-safe fallback). */
  text: string;
  /** Optional HTML body. Providers fall back to `text` when omitted. */
  html?: string;
  /** Optional tags for ESP-side analytics (ignored by the log provider). */
  tags?: { name: string; value: string }[];
}

export interface EmailProvider {
  /** Stable name for startup logging (`resend`, `log`, …). */
  readonly name: string;
  send(options: SendEmailOptions): Promise<void>;
}

/**
 * Thin façade over the configured provider. AuthService injects THIS class,
 * never a concrete provider, so enabling Resend is an env-only change.
 */
export class EmailService {
  constructor(private readonly provider: EmailProvider) {}

  get providerName(): string {
    return this.provider.name;
  }

  send(options: SendEmailOptions): Promise<void> {
    return this.provider.send(options);
  }

  /**
   * Password-reset message builder shared by every provider. Keeps the
   * reset-link format, expiry copy, and plain-text fallback in ONE place so
   * the Resend/log templates can never drift apart.
   */
  passwordResetEmail(params: {
    to: string;
    resetUrl: string;
    expiresMinutes: number;
  }): Promise<void> {
    const { to, resetUrl, expiresMinutes } = params;
    const subject = 'Reset your Aama ko Agro password';
    const url = escapeHtml(resetUrl);
    const text = [
      'You requested a password reset for your Aama ko Agro account.',
      '',
      'Click the link below to choose a new password:',
      resetUrl,
      '',
      `This link expires in ${expiresMinutes} minutes and can be used only once.`,
      '',
      "If you did not request a password reset, you can safely ignore this email — your password will not change.",
    ].join('\n');
    // Branded storefront template. Inline styles + table layout only — email
    // clients (Gmail/Outlook/Apple) strip <style> blocks and CSS classes.
    const html = [
      '<div style="margin:0;padding:24px 12px;background:#f4f3ee;font-family:Arial,Helvetica,sans-serif;">',
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e1d8;border-radius:12px;overflow:hidden;">',
      `<tr><td style="background:#1d2b22;padding:26px 32px;text-align:center;">`,
      `<span style="color:#f5f2ea;font-size:19px;letter-spacing:3px;font-weight:bold;">AAMA KO AGRO</span><br>`,
      `<span style="color:#9fb2a4;font-size:11px;letter-spacing:2px;">REAL FOOD, KEPT HONEST &middot; MADE IN NEPAL</span>`,
      `</td></tr>`,
      `<tr><td style="padding:32px;">`,
      `<h1 style="margin:0 0 12px;font-size:20px;color:#1d2b22;">Reset your password</h1>`,
      `<p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#3d3d3d;">We received a request to reset the password for your Aama ko Agro account. Click the button below to choose a new password.</p>`,
      `<p style="margin:0 0 24px;text-align:center;"><a href="${url}" style="display:inline-block;background:#2e5e3f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 36px;border-radius:8px;">Reset Password</a></p>`,
      `<p style="margin:0 0 6px;font-size:13px;color:#6b6b6b;">Button not working? Copy this link into your browser:</p>`,
      `<p style="margin:0 0 22px;font-size:12px;word-break:break-all;"><a href="${url}" style="color:#2e5e3f;">${url}</a></p>`,
      `<p style="margin:0 0 16px;font-size:13px;color:#9a5b00;font-weight:bold;">&#9201; This link expires in ${expiresMinutes} minutes and can be used only once.</p>`,
      `<p style="margin:0;font-size:13px;color:#6b6b6b;line-height:20px;">Didn&rsquo;t request a password reset? You can safely ignore this email &mdash; your password will not change.</p>`,
      `</td></tr>`,
      `<tr><td style="padding:16px 32px;background:#f9f8f3;border-top:1px solid #e3e1d8;">`,
      `<p style="margin:0;font-size:11px;color:#9a9a92;text-align:center;">Aama ko Agro &middot; DFTQC-compliant facility &middot; Automated message &mdash; replies are not monitored.</p>`,
      `</td></tr>`,
      `</table></div>`,
    ].join('');
    return this.send({ to, subject, text, html, tags: [{ name: 'type', value: 'password-reset' }] });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
