import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { hashPassword, newId, verifyPassword } from './crypto';
import type { Env, UserRow } from './types';

const SESSION_COOKIE = 'wwc_session';
const SESSION_DAYS = 30;

type AppVars = { user: UserRow };

export async function createSession(c: Context<{ Bindings: Env; Variables: AppVars }>, userId: string) {
  const id = newId();
  const now = Date.now();
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, expires, now)
    .run();
  const isHttps = new URL(c.req.url).protocol === 'https:';
  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'Lax',
    path: '/',
    expires: new Date(expires),
  });
  return id;
}

export async function destroySession(c: Context<{ Bindings: Env; Variables: AppVars }>) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function requireAuth(c: Context<{ Bindings: Env; Variables: AppVars }>, next: Next) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) return c.json({ error: 'Unauthorized' }, 401);

  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  )
    .bind(sid, Date.now())
    .first<UserRow>();

  if (!row) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('user', row);
  await next();
}

export async function optionalAuth(c: Context<{ Bindings: Env; Variables: AppVars }>, next: Next) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) {
    const row = await c.env.DB.prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`
    )
      .bind(sid, Date.now())
      .first<UserRow>();
    if (row) c.set('user', row);
  }
  await next();
}

export async function registerUser(env: Env, email: string, password: string, name: string) {
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
    .bind(email.trim())
    .first();
  if (existing) throw new Error('Email already registered');

  const id = newId();
  const now = Date.now();
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, email.trim().toLowerCase(), passwordHash, name.trim() || email.split('@')[0], now, now)
    .run();

  // Create empty station row for the user
  const stationId = newId();
  await env.DB.prepare(
    `INSERT INTO stations (
      id, user_id, name, cloud_api_version, cloud_did, cloud_station_id, cloud_station_name,
      latitude, longitude, credentials_enc, credentials_iv,
      unit_temp, unit_wind, unit_baro, unit_rain, created_at, updated_at
    ) VALUES (?, ?, ?, 'v2', '', '', '', NULL, NULL, '', '', 'C', 'kmh', 'hPa', 'mm', ?, ?)`
  )
    .bind(stationId, id, 'My Station', now, now)
    .run();

  return { id, email: email.trim().toLowerCase(), name: name.trim() || email.split('@')[0] };
}

export async function loginUser(env: Env, email: string, password: string) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
    .bind(email.trim())
    .first<UserRow>();
  if (!user) throw new Error('Invalid email or password');
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new Error('Invalid email or password');
  return user;
}

export { SESSION_COOKIE };
