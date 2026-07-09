import { hashPassword, newId, verifyPassword } from './crypto';
import { sendOtpEmail } from './email';
import type { Env } from './types';

const OTP_TTL_MS = 15 * 60 * 1000;

export async function createAndSendOtp(env: Env, email: string, purpose: 'verify' | 'reset') {
  const normalized = email.trim().toLowerCase();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hashPassword(code);
  const now = Date.now();
  const id = newId();

  // Invalidate previous unused codes for same purpose
  await env.DB.prepare(
    `UPDATE otp_codes SET consumed_at = ? WHERE email = ? COLLATE NOCASE AND purpose = ? AND consumed_at IS NULL`
  )
    .bind(now, normalized, purpose)
    .run();

  await env.DB.prepare(
    `INSERT INTO otp_codes (id, email, purpose, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, normalized, purpose, codeHash, now + OTP_TTL_MS, now)
    .run();

  await sendOtpEmail(env, normalized, purpose, code);
  return { id, expiresAt: now + OTP_TTL_MS };
}

export async function consumeOtp(env: Env, email: string, purpose: 'verify' | 'reset', code: string) {
  const normalized = email.trim().toLowerCase();
  const row = await env.DB.prepare(
    `SELECT * FROM otp_codes
     WHERE email = ? COLLATE NOCASE AND purpose = ? AND consumed_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`
  )
    .bind(normalized, purpose, Date.now())
    .first<{ id: string; code_hash: string }>();

  if (!row) throw new Error('Invalid or expired code');
  const ok = await verifyPassword(code.trim(), row.code_hash);
  if (!ok) throw new Error('Invalid or expired code');

  await env.DB.prepare('UPDATE otp_codes SET consumed_at = ? WHERE id = ?').bind(Date.now(), row.id).run();
}
