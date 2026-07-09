import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { freeTrialMs } from './billing';
import { hashPassword, newId, parseSessionCookieValue, signSessionCookieValue, verifyPassword, generateOtpCode } from './crypto';
import { isEnabled } from './settings';
import type { Env, UserRow } from './types';

const SESSION_COOKIE = 'wwc_session';
const SESSION_DAYS = 30;

type AppVars = { user: UserRow };

/** Admin allowlist from ADMIN_EMAILS (comma-separated) or legacy ADMIN_EMAIL. */
export function adminEmailAllowlist(env: Env): string[] {
  const raw = [env.ADMIN_EMAILS || '', env.ADMIN_EMAIL || '']
    .join(',')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(raw)];
}

export function isAdminEmail(env: Env, email: string): boolean {
  return adminEmailAllowlist(env).includes(email.trim().toLowerCase());
}

/** Promote allowlisted accounts to admin on login only (never on register). */
export async function ensureAdminRole(env: Env, user: UserRow): Promise<UserRow> {
  if (!isAdminEmail(env, user.email)) return user;
  if (user.role === 'admin' && user.email_verified) return user;

  const now = Date.now();
  const freeUntil = Math.max(user.free_until || 0, now + 10 * 365 * 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    `UPDATE users SET role = 'admin', email_verified = 1, free_until = ?, updated_at = ? WHERE id = ?`
  )
    .bind(freeUntil, now, user.id)
    .run();

  return {
    ...user,
    role: 'admin',
    email_verified: 1,
    free_until: freeUntil,
    updated_at: now,
  };
}

export async function createSession(c: Context<{ Bindings: Env; Variables: AppVars }>, userId: string) {
  // Rotate: drop prior sessions for this user (login / password change)
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

  const id = newId();
  const now = Date.now();
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, expires, now)
    .run();
  const isHttps = new URL(c.req.url).protocol === 'https:';
  const host = new URL(c.req.url).hostname;
  const domain = host.endsWith('wwebconsole.com') ? '.wwebconsole.com' : undefined;
  const isProd = host.endsWith('wwebconsole.com');
  const cookieValue = await signSessionCookieValue(c.env.SESSION_SECRET, id);
  setCookie(c, SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: isProd || isHttps,
    sameSite: 'Lax',
    path: '/',
    domain,
    expires: new Date(expires),
  });
  return id;
}

export async function destroyAllSessionsForUser(env: Env, userId: string) {
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}

export async function purgeExpiredAuthRows(env: Env) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  await env.DB.prepare('DELETE FROM otp_codes WHERE expires_at < ? OR consumed_at IS NOT NULL').bind(now).run();
}

export async function destroySession(c: Context<{ Bindings: Env; Variables: AppVars }>) {
  const raw = getCookie(c, SESSION_COOKIE);
  const sid = await parseSessionCookieValue(c.env.SESSION_SECRET, raw);
  if (sid) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
  }
  const host = new URL(c.req.url).hostname;
  const domain = host.endsWith('wwebconsole.com') ? '.wwebconsole.com' : undefined;
  deleteCookie(c, SESSION_COOKIE, { path: '/', domain });
}

async function loadUserFromSession(env: Env, sid: string): Promise<UserRow | null> {
  return env.DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  )
    .bind(sid, Date.now())
    .first<UserRow>();
}

async function sessionIdFromRequest(c: Context<{ Bindings: Env; Variables: AppVars }>): Promise<string | null> {
  return parseSessionCookieValue(c.env.SESSION_SECRET, getCookie(c, SESSION_COOKIE));
}

export async function requireAuth(c: Context<{ Bindings: Env; Variables: AppVars }>, next: Next) {
  const sid = await sessionIdFromRequest(c);
  if (!sid) return c.json({ error: 'Unauthorized' }, 401);

  const row = await loadUserFromSession(c.env, sid);
  if (!row) {
    await destroySession(c);
    return c.json({ error: 'Unauthorized' }, 401);
  }
  if (row.suspended) return c.json({ error: 'Account suspended' }, 403);

  c.set('user', row);
  await next();
}

export async function requireAdmin(c: Context<{ Bindings: Env; Variables: AppVars }>, next: Next) {
  const sid = await sessionIdFromRequest(c);
  if (!sid) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadUserFromSession(c.env, sid);
  if (!row) return c.json({ error: 'Unauthorized' }, 401);
  if (row.suspended) return c.json({ error: 'Account suspended' }, 403);
  if (row.role !== 'admin') return c.json({ error: 'Admin only' }, 403);
  c.set('user', row);
  await next();
}

export async function optionalAuth(c: Context<{ Bindings: Env; Variables: AppVars }>, next: Next) {
  const sid = await sessionIdFromRequest(c);
  if (sid) {
    const row = await loadUserFromSession(c.env, sid);
    if (row && !row.suspended) c.set('user', row);
  }
  await next();
}

/**
 * Register outcome used to reduce email enumeration.
 * Callers should return a uniform client response for created vs already-exists.
 */
export type RegisterUserResult = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  freeUntil: number;
  needsVerification: boolean;
};

export type RegisterOutcome =
  | { kind: 'created'; user: RegisterUserResult }
  | { kind: 'exists' }
  | { kind: 'blocked' };

async function registerUserCreated(env: Env, email: string, password: string, name: string): Promise<RegisterUserResult> {
  const normalized = email.trim().toLowerCase();
  const id = newId();
  const now = Date.now();
  const passwordHash = await hashPassword(password);
  const trialMs = await freeTrialMs(env);
  const freeUntil = now + trialMs;
  const resendOn = await isEnabled(env, 'resend_enabled');
  const emailVerified = resendOn ? 0 : 1;
  const role = 'user';

  await env.DB.prepare(
    `INSERT INTO users (
      id, email, password_hash, name, role, suspended, email_verified, free_until, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, '', ?, ?)`
  )
    .bind(
      id,
      normalized,
      passwordHash,
      name.trim() || normalized.split('@')[0],
      role,
      emailVerified,
      freeUntil,
      now,
      now
    )
    .run();

  const stationId = newId();
  await env.DB.prepare(
    `INSERT INTO stations (
      id, user_id, name, cloud_api_version, cloud_did, cloud_station_id, cloud_station_name,
      latitude, longitude, timezone, credentials_enc, credentials_iv,
      unit_temp, unit_wind, unit_baro, unit_rain,
      wl_plan, device_label, subscription_status, subscription_expires_at, poll_interval_sec,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'v2', '', '', '', NULL, NULL, '', '', '', 'C', 'kmh', 'hPa', 'mm',
      'unknown', 'Device 1', 'trial', ?, 900, ?, ?)`
  )
    .bind(stationId, id, 'My Station', freeUntil, now, now)
    .run();

  await env.DB.prepare(
    `INSERT INTO devices (
      id, user_id, station_id, label, wl_plan, subscription_status, subscription_expires_at, poll_interval_sec, created_at, updated_at
    ) VALUES (?, ?, ?, 'Device 1', 'unknown', 'trial', ?, 900, ?, ?)`
  )
    .bind(newId(), id, stationId, freeUntil, now, now)
    .run();

  return {
    id,
    email: normalized,
    name: name.trim() || normalized.split('@')[0],
    role,
    emailVerified: Boolean(emailVerified),
    freeUntil,
    needsVerification: !emailVerified,
  };
}

export async function registerUser(env: Env, email: string, password: string, name: string) {
  const normalized = email.trim().toLowerCase();

  // Allowlisted admin emails cannot self-register (prevents squatting).
  if (isAdminEmail(env, normalized)) {
    return { kind: 'blocked' as const };
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
    .bind(normalized)
    .first();
  if (existing) return { kind: 'exists' as const };

  const user = await registerUserCreated(env, normalized, password, name);
  return { kind: 'created' as const, user };
}

export async function loginUser(env: Env, email: string, password: string) {
  let user = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
    .bind(email.trim())
    .first<UserRow>();
  if (!user) throw new Error('Invalid email or password');
  if (user.suspended) throw new Error('Account suspended. Contact support.');
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new Error('Invalid email or password');

  // Auto-promote allowlisted admins on every login (prod + local/staging)
  user = await ensureAdminRole(env, user);

  const resendOn = await isEnabled(env, 'resend_enabled');
  if (resendOn && !user.email_verified && user.role !== 'admin') {
    const err = new Error('Email not verified');
    (err as any).code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }
  return user;
}

export async function markEmailVerified(env: Env, email: string) {
  await env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE email = ? COLLATE NOCASE')
    .bind(Date.now(), email.trim().toLowerCase())
    .run();
}

export async function updatePassword(env: Env, email: string, password: string) {
  const hash = await hashPassword(password);
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
    .bind(email.trim().toLowerCase())
    .first<{ id: string }>();
  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ? COLLATE NOCASE')
    .bind(hash, Date.now(), email.trim().toLowerCase())
    .run();
  if (user) await destroyAllSessionsForUser(env, user.id);
}

export function publicUser(user: UserRow) {
  const deleteRequestedAt = user.delete_requested_at ?? null;
  const deleteEffectiveAt = deleteRequestedAt ? deleteRequestedAt + 15 * 24 * 60 * 60 * 1000 : null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
    emailVerified: Boolean(user.email_verified),
    suspended: Boolean(user.suspended),
    freeUntil: user.free_until,
    deleteRequestedAt,
    deleteEffectiveAt,
    pendingEmail: user.pending_email || null,
  };
}

export async function changePassword(env: Env, userId: string, currentPassword: string, newPassword: string) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!user) throw new Error('User not found');
  const ok = await verifyPassword(currentPassword, user.password_hash);
  if (!ok) throw new Error('Current password is incorrect');
  const hash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(hash, Date.now(), userId)
    .run();
  await destroyAllSessionsForUser(env, userId);
}

export async function requestEmailChange(env: Env, userId: string, newEmail: string) {
  const normalized = newEmail.trim().toLowerCase();
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
    .bind(normalized)
    .first();
  if (existing) throw new Error('Email already in use');

  const code = generateOtpCode(6);
  const codeHash = await hashPassword(code);
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE users SET pending_email = ?, pending_email_code_hash = ?, pending_email_expires_at = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(normalized, codeHash, now + 15 * 60 * 1000, now, userId)
    .run();
  return { email: normalized, code };
}

export async function confirmEmailChange(env: Env, userId: string, code: string) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!user?.pending_email || !user.pending_email_code_hash) throw new Error('No pending email change');
  if (!user.pending_email_expires_at || user.pending_email_expires_at < Date.now()) {
    throw new Error('Email change code expired');
  }
  const ok = await verifyPassword(code.trim(), user.pending_email_code_hash);
  if (!ok) throw new Error('Invalid verification code');

  const taken = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?')
    .bind(user.pending_email, userId)
    .first();
  if (taken) throw new Error('Email already in use');

  const now = Date.now();
  await env.DB.prepare(
    `UPDATE users SET email = ?, email_verified = 1, pending_email = NULL, pending_email_code_hash = NULL,
     pending_email_expires_at = NULL, updated_at = ? WHERE id = ?`
  )
    .bind(user.pending_email, now, userId)
    .run();

  return { email: user.pending_email };
}

export async function requestAccountDeletion(env: Env, userId: string) {
  const now = Date.now();
  await env.DB.prepare('UPDATE users SET delete_requested_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, userId)
    .run();
  return { deleteRequestedAt: now, deleteEffectiveAt: now + 15 * 24 * 60 * 60 * 1000 };
}

export async function cancelAccountDeletion(env: Env, userId: string) {
  await env.DB.prepare('UPDATE users SET delete_requested_at = NULL, updated_at = ? WHERE id = ?')
    .bind(Date.now(), userId)
    .run();
}

/** Permanently remove accounts past the 15-day grace period. */
export async function purgeDeletedAccounts(env: Env) {
  const cutoff = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const { results } = await env.DB.prepare(
    `SELECT id FROM users WHERE delete_requested_at IS NOT NULL AND delete_requested_at <= ? LIMIT 50`
  )
    .bind(cutoff)
    .all<{ id: string }>();

  for (const row of results || []) {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.id).run();
    await env.DB.prepare('DELETE FROM share_links WHERE user_id = ?').bind(row.id).run();
    await env.DB.prepare('DELETE FROM devices WHERE user_id = ?').bind(row.id).run();
    await env.DB.prepare('DELETE FROM stations WHERE user_id = ?').bind(row.id).run();
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(row.id).run();
  }
  return (results || []).length;
}

export { SESSION_COOKIE };
