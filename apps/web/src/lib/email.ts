import 'server-only';

import { DEFAULT_LOCALE, loadMessages, type Locale } from '@sports/i18n';
import { createTranslator } from 'next-intl';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';

interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const smtpHost = process.env.SMTP_HOST?.trim();
const from = process.env.EMAIL_FROM?.trim() || 'Pitchside <no-reply@localhost>';

const transport = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } }
        : {}),
    })
  : null;

export const OUTBOX_DIR = path.join(process.cwd(), 'data', 'outbox');

/**
 * Sends through SMTP when it is configured. Without SMTP, development builds write the
 * message to data/outbox and log it, so sign-up can be tested with no mail account.
 * Production refuses to pretend: an unverifiable sign-up must fail loudly.
 */
async function deliver(email: OutgoingEmail): Promise<void> {
  if (transport) {
    await transport.sendMail({ from, ...email });
    return;
  }
  if (process.env.NODE_ENV === 'production' && process.env.EMAIL_DEV_OUTBOX !== 'true') {
    throw new Error(
      'Email is not configured: set SMTP_HOST (and SMTP_USER / SMTP_PASS / EMAIL_FROM).',
    );
  }
  await mkdir(OUTBOX_DIR, { recursive: true });
  const safeTo = email.to.replace(/[^a-z0-9@._-]/gi, '_');
  const file = path.join(OUTBOX_DIR, `${Date.now()}-${safeTo}.txt`);
  await writeFile(file, `To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`, 'utf8');
  console.info(`[email] SMTP not configured. Message for ${email.to} written to ${file}`);
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendVerificationEmail(options: {
  to: string;
  name: string;
  url: string;
  locale?: Locale;
}): Promise<void> {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const t = createTranslator({ locale, messages: await loadMessages(locale), namespace: 'email' });
  const name = options.name || options.to;
  const text = [t('verifyText', { name }), '', options.url, '', t('verifyIgnore')].join('\n');

  // Square corners, one accent, Archivo with safe fallbacks: the same system as the site.
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f3f2f2;color:#201e1d;font-family:Archivo,Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;text-align:left">
<tr><td style="font-size:18px;font-weight:800;padding-bottom:16px;border-bottom:2px solid #a6a5a4"><span style="display:inline-block;width:12px;height:12px;background:#ec3013;margin-right:10px"></span>Pitchside</td></tr>
<tr><td style="padding:28px 0 8px;font-size:28px;font-weight:800;letter-spacing:-0.02em">${escapeHtml(t('verifyHeading'))}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;padding-bottom:24px">${escapeHtml(t('verifyText', { name }))}</td></tr>
<tr><td style="padding-bottom:28px"><a href="${escapeHtml(options.url)}" style="display:inline-block;background:#ec3013;color:#f3f2f2;font-weight:800;font-size:14px;text-decoration:none;padding:12px 20px">${escapeHtml(t('verifyButton'))}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#605d5d;border-top:1px solid #a6a5a4;padding-top:16px">${escapeHtml(t('verifyFallback'))}<br><a href="${escapeHtml(options.url)}" style="color:#ae1800;word-break:break-all">${escapeHtml(options.url)}</a><br><br>${escapeHtml(t('verifyIgnore'))}</td></tr>
</table></td></tr></table></body></html>`;

  await deliver({ to: options.to, subject: t('verifySubject'), text, html });
}
