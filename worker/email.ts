import { getSetting, isEnabled } from './settings';
import type { Env } from './types';

export async function sendEmail(env: Env, to: string, subject: string, html: string, text?: string) {
  const enabled = await isEnabled(env, 'resend_enabled');
  if (!enabled) {
    console.log('[email:disabled]', { to, subject, text: text || html.replace(/<[^>]+>/g, ' ') });
    return { id: 'disabled', skipped: true };
  }

  const apiKey = await getSetting(env, 'resend_api_key');
  const from = (await getSetting(env, 'resend_from_email')) || 'WWebConsole <noreply@wwebconsole.com>';
  if (!apiKey) throw new Error('Resend is enabled but API key is not configured');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend error (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function sendOtpEmail(env: Env, to: string, purpose: 'verify' | 'reset', code: string) {
  const isVerify = purpose === 'verify';
  const subject = isVerify ? 'Verify your WWebConsole account' : 'Reset your WWebConsole password';
  const title = isVerify ? 'Email verification' : 'Password reset';
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e111a;color:#fff;border-radius:12px">
      <h2 style="margin:0 0 8px">${title}</h2>
      <p style="color:#9ca3af">Your one-time code is:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:16px 0">${code}</p>
      <p style="color:#9ca3af;font-size:13px">This code expires in 15 minutes. If you did not request this, ignore this email.</p>
    </div>`;
  const text = `${title}\n\nYour code: ${code}\nExpires in 15 minutes.`;
  return sendEmail(env, to, subject, html, text);
}
