import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import {
  cancelAccountDeletion,
  changePassword,
  confirmEmailChange,
  createSession,
  destroySession,
  loginUser,
  markEmailVerified,
  optionalAuth,
  publicUser,
  purgeDeletedAccounts,
  purgeExpiredAuthRows,
  registerUser,
  requestAccountDeletion,
  requestEmailChange,
  requireAdmin,
  requireAuth,
  updatePassword,
} from './auth';
import { sendOtpEmail } from './email';
import {
  activateYearlySubscription,
  hasAccountAccess,
  normalizeWlPlan,
  publicBilling,
  setStationWlPlan,
} from './billing';
import { decryptJson, newId, randomSlug } from './crypto';
import { createAndSendOtp, consumeOtp } from './otp';
import {
  buildRobotsTxt,
  buildSitemapXml,
  getPublicAuthConfig,
  getPublicSiteConfig,
  getSeoForPath,
  injectSeoIntoHtml,
  isEnabled,
  listSettingsForAdmin,
  seoPageFromPath,
  setSetting,
  SITE_SETTING_GROUPS,
} from './settings';
import {
  clientIp,
  corsOriginAllowlist,
  enforceRateLimit,
  isDevEnvironment,
  limitJsonBody,
  safePublicError,
  securityHeaders,
  withSpaSecurityHeaders,
  WRITABLE_SETTING_KEYS,
} from './security';
import { verifyTurnstile } from './turnstile';
import type { Env, ShareLinkRow, StationCredentials, StationRow, UserRow } from './types';
import {
  connectionFromRow,
  getStationForUser,
  parseStoredWeather,
  refreshStation,
  saveCredentials,
  toPublicConfig,
} from './weatherlink';

type AppVars = { user: UserRow };
const app = new Hono<{ Bindings: Env; Variables: AppVars }>();

app.use('*', securityHeaders);
app.use(
  '/api/*',
  cors({
    origin: (origin) => corsOriginAllowlist(origin) || '',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  })
);
app.use('/api/*', limitJsonBody);

app.get('/api/health', (c) => c.json({ ok: true, app: c.env.APP_NAME }));

app.get('/api/auth/config', async (c) => c.json(await getPublicAuthConfig(c.env)));

app.get('/api/public/site', async (c) => c.json(await getPublicSiteConfig(c.env)));

app.get('/robots.txt', async (c) => {
  const body = await buildRobotsTxt(c.env);
  return c.text(body, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
});

app.get('/sitemap.xml', async (c) => {
  const body = await buildSitemapXml(c.env);
  return c.text(body, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
});

function isAdminHostname(hostname: string): boolean {
  return hostname === 'admin.wwebconsole.com' || hostname.startsWith('admin.') || hostname === 'admin.localhost';
}

// ---------- Auth ----------
app.post('/api/auth/register', async (c) => {
  // Admin subdomain is invite/allowlist only — never create accounts here
  if (isAdminHostname(new URL(c.req.url).hostname)) {
    return c.json({ error: 'Registration is not available on the admin site. Use wwebconsole.com.' }, 403);
  }
  const limited = enforceRateLimit(c, 'authRegister');
  if (limited) return limited;

  const body = z
    .object({
      email: z.string().email().max(254),
      password: z.string().min(8).max(128),
      name: z.string().max(80).optional(),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    const outcome = await registerUser(c.env, body.data.email, body.data.password, body.data.name || '');
    const normalizedEmail = body.data.email.trim().toLowerCase();

    // Uniform non-revealing response for exists / blocked (anti-enumeration)
    if (outcome.kind !== 'created') {
      return c.json({
        ok: true,
        email: normalizedEmail,
        message:
          'If this email can be registered, check your inbox for next steps. If you already have an account, sign in.',
      });
    }

    const user = outcome.user;
    if (user.needsVerification) {
      await createAndSendOtp(c.env, user.email, 'verify');
      return c.json({
        needsVerification: true,
        email: user.email,
        message: 'Check your email for a verification code',
      });
    }
    await createSession(c, user.id);
    const full = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
    return c.json({ user: publicUser(full!), needsVerification: false });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Registration failed') }, 400);
  }
});

app.post('/api/auth/verify-email', async (c) => {
  const limited = enforceRateLimit(c, 'authOtp');
  if (limited) return limited;

  const body = z
    .object({
      email: z.string().email().max(254),
      code: z.string().min(4).max(12),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    await consumeOtp(c.env, body.data.email, 'verify', body.data.code);
    await markEmailVerified(c.env, body.data.email);
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
      .bind(body.data.email.trim())
      .first<UserRow>();
    if (!user) return c.json({ error: 'Invalid or expired code' }, 400);
    await createSession(c, user.id);
    return c.json({ user: publicUser(user) });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Verification failed') }, 400);
  }
});

app.post('/api/auth/resend-verification', async (c) => {
  const limited = enforceRateLimit(c, 'authForgot');
  if (limited) return limited;
  const body = z
    .object({
      email: z.string().email().max(254),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
      .bind(body.data.email.trim())
      .first<UserRow>();
    if (!user) return c.json({ ok: true }); // don't leak
    if (user.email_verified) return c.json({ ok: true, alreadyVerified: true });
    await createAndSendOtp(c.env, user.email, 'verify');
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Failed to send code') }, 400);
  }
});

app.post('/api/auth/login', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const body = z
    .object({
      email: z.string().email().max(254),
      password: z.string().min(1).max(128),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(raw);
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  const limited = enforceRateLimit(c, 'authLogin', body.data.email.toLowerCase());
  if (limited) return limited;

  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    const user = await loginUser(c.env, body.data.email, body.data.password);
    await createSession(c, user.id);
    return c.json({ user: publicUser(user) });
  } catch (err: any) {
    const status = err.code === 'EMAIL_NOT_VERIFIED' ? 403 : 401;
    return c.json(
      { error: safePublicError(err, 'Login failed'), code: err.code },
      status
    );
  }
});

app.post('/api/auth/forgot-password', async (c) => {
  const limited = enforceRateLimit(c, 'authForgot');
  if (limited) return limited;
  const body = z
    .object({
      email: z.string().email().max(254),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ? COLLATE NOCASE')
      .bind(body.data.email.trim())
      .first<{ id: string; email: string }>();
    if (user) await createAndSendOtp(c.env, user.email, 'reset');
    return c.json({ ok: true, message: 'If that email exists, a reset code was sent' });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Request failed') }, 400);
  }
});

app.post('/api/auth/reset-password', async (c) => {
  const limited = enforceRateLimit(c, 'authOtp');
  if (limited) return limited;
  const body = z
    .object({
      email: z.string().email().max(254),
      code: z.string().min(4).max(12),
      password: z.string().min(8).max(128),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    await consumeOtp(c.env, body.data.email, 'reset', body.data.code);
    await updatePassword(c.env, body.data.email, body.data.password);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Reset failed') }, 400);
  }
});

app.post('/api/auth/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

app.get('/api/auth/me', optionalAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null, billing: null });
  const station = await getStationForUser(c.env, user.id);
  return c.json({ user: publicUser(user), billing: publicBilling(user, station) });
});

// ---------- Account settings ----------
app.post('/api/account/password', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'accountSensitive', c.get('user').id);
  if (limited) return limited;
  const body = z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(8).max(128),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    await changePassword(c.env, c.get('user').id, body.data.currentPassword, body.data.newPassword);
    await createSession(c, c.get('user').id);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Password change failed') }, 400);
  }
});

app.post('/api/account/email/request', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'accountSensitive', c.get('user').id);
  if (limited) return limited;
  const body = z.object({ email: z.string().email().max(254) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    const { email, code } = await requestEmailChange(c.env, c.get('user').id, body.data.email);
    const resendOn = await isEnabled(c.env, 'resend_enabled');
    if (resendOn) {
      await sendOtpEmail(c.env, email, 'verify', code);
      return c.json({ ok: true, needsVerification: true, email });
    }
    // Only expose OTP in explicit local/dev environments — never in production
    if (isDevEnvironment(c.env, c.req.url)) {
      return c.json({ ok: true, needsVerification: true, email, devCode: code });
    }
    return c.json({
      ok: true,
      needsVerification: true,
      email,
      error: 'Email delivery is not configured. Contact support.',
    }, 503);
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Email change failed') }, 400);
  }
});

app.post('/api/account/email/confirm', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'authOtp', c.get('user').id);
  if (limited) return limited;
  const body = z.object({ code: z.string().min(4).max(12) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    const result = await confirmEmailChange(c.env, c.get('user').id, body.data.code);
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.get('user').id).first<UserRow>();
    return c.json({ ok: true, user: publicUser(user!), email: result.email });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Confirmation failed') }, 400);
  }
});

app.post('/api/account/delete', requireAuth, async (c) => {
  const body = z.object({ confirm: z.literal('DELETE') }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'Type DELETE to confirm' }, 400);
  const user = c.get('user');
  if (user.role === 'admin') return c.json({ error: 'Admin accounts cannot be self-deleted' }, 400);
  const result = await requestAccountDeletion(c.env, user.id);
  const fresh = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
  return c.json({ ok: true, ...result, user: publicUser(fresh!) });
});

app.post('/api/account/delete/cancel', requireAuth, async (c) => {
  await cancelAccountDeletion(c.env, c.get('user').id);
  const fresh = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.get('user').id).first<UserRow>();
  return c.json({ ok: true, user: publicUser(fresh!) });
});

async function assertAccess(c: { env: Env; json: Function; get: Function }) {
  const user = c.get('user') as UserRow;
  const station = await getStationForUser(c.env, user.id);
  const access = hasAccountAccess(user, station);
  if (!access.ok) {
    return { blocked: true as const, response: c.json({ error: access.reason, code: 'ACCESS_DENIED', billing: publicBilling(user, station) }, 402) };
  }
  return { blocked: false as const, station, user };
}

// ---------- Station / weather ----------
app.get('/api/station', requireAuth, async (c) => {
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const { station, user } = gate;
  if (!station) return c.json({ error: 'Station not found' }, 404);
  const creds = await decryptJson<StationCredentials>(
    c.env.CREDENTIALS_KEY,
    station.credentials_enc,
    station.credentials_iv
  );
  const weather = parseStoredWeather(station);
  return c.json({
    weather,
    connection: connectionFromRow(station, weather, station.last_error),
    config: toPublicConfig(station, creds),
    stationId: station.id,
    billing: publicBilling(user, station),
  });
});

app.patch('/api/station', requireAuth, async (c) => {
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const { station: existingStation, user } = gate;
  if (!existingStation) return c.json({ error: 'Station not found' }, 404);
  const station = existingStation;

  const body = z
    .object({
      name: z.string().max(80).optional(),
      cloudApiVersion: z.enum(['v1', 'v2']).optional(),
      cloudDid: z.string().max(64).optional(),
      cloudStationId: z.string().max(64).optional(),
      cloudStationName: z.string().max(120).optional(),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      unitTemp: z.enum(['F', 'C']).optional(),
      unitWind: z.enum(['mph', 'kmh', 'kts', 'ms']).optional(),
      unitBaro: z.enum(['inHg', 'hPa', 'mmHg', 'mb']).optional(),
      unitRain: z.enum(['in', 'mm']).optional(),
      cloudPassword: z.string().max(200).optional(),
      cloudApiToken: z.string().max(200).optional(),
      cloudApiSecret: z.string().max(200).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));

  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  const d = body.data;
  const now = Date.now();
  const nextVersion = d.cloudApiVersion || (station.cloud_api_version === 'v1' ? 'v1' : 'v2');

  // Enforce exclusive credential sets: v1 XOR v2
  if (nextVersion === 'v1' && d.cloudApiSecret) {
    return c.json({ error: 'API V1 does not use an API Secret. Switch to V2 or clear the secret.' }, 400);
  }
  if (nextVersion === 'v2' && d.cloudPassword && !d.cloudApiToken && !d.cloudApiSecret) {
    // password alone on v2 is optional hybrid — ok
  }

  const existingCreds = await decryptJson<StationCredentials>(
    c.env.CREDENTIALS_KEY,
    station.credentials_enc,
    station.credentials_iv
  );
  const { enc, iv } = await saveCredentials(c.env, existingCreds, {
    password: d.cloudPassword,
    apiToken: d.cloudApiToken,
    apiSecret: nextVersion === 'v1' ? '' : d.cloudApiSecret,
    apiVersion: nextVersion,
  });

  await c.env.DB.prepare(
    `UPDATE stations SET
      name = COALESCE(?, name),
      cloud_api_version = COALESCE(?, cloud_api_version),
      cloud_did = COALESCE(?, cloud_did),
      cloud_station_id = COALESCE(?, cloud_station_id),
      cloud_station_name = COALESCE(?, cloud_station_name),
      latitude = CASE WHEN ? THEN ? ELSE latitude END,
      longitude = CASE WHEN ? THEN ? ELSE longitude END,
      credentials_enc = ?,
      credentials_iv = ?,
      unit_temp = COALESCE(?, unit_temp),
      unit_wind = COALESCE(?, unit_wind),
      unit_baro = COALESCE(?, unit_baro),
      unit_rain = COALESCE(?, unit_rain),
      updated_at = ?
     WHERE id = ?`
  )
    .bind(
      d.name ?? null,
      d.cloudApiVersion ?? null,
      d.cloudDid ?? null,
      d.cloudStationId ?? null,
      d.cloudStationName ?? null,
      d.latitude !== undefined ? 1 : 0,
      d.latitude ?? null,
      d.longitude !== undefined ? 1 : 0,
      d.longitude ?? null,
      enc,
      iv,
      d.unitTemp ?? null,
      d.unitWind ?? null,
      d.unitBaro ?? null,
      d.unitRain ?? null,
      now,
      station.id
    )
    .run();

  // wlPlan is admin/subscription-controlled only — not user-writable

  let updated = await getStationForUser(c.env, user.id);
  if (!updated) return c.json({ error: 'Station not found' }, 404);

  const result = await refreshStation(c.env, updated);
  updated = (await getStationForUser(c.env, user.id))!;
  const creds = await decryptJson<StationCredentials>(
    c.env.CREDENTIALS_KEY,
    updated.credentials_enc,
    updated.credentials_iv
  );

  return c.json({
    weather: result.weather,
    connection: connectionFromRow(updated, result.weather, result.error),
    config: toPublicConfig(updated, creds),
    stationId: updated.id,
    billing: publicBilling(user, updated),
  });
});

app.get('/api/weather/current', requireAuth, async (c) => {
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  let station = gate.station;
  if (!station) return c.json({ error: 'Station not found' }, 404);

  const force = c.req.query('refresh') === '1';
  const pollMs = (station.poll_interval_sec || 900) * 1000;
  const stale = !station.last_http_at || Date.now() - station.last_http_at > pollMs;
  if (force || stale) {
    await refreshStation(c.env, station);
    station = (await getStationForUser(c.env, gate.user.id))!;
  }

  const creds = await decryptJson<StationCredentials>(
    c.env.CREDENTIALS_KEY,
    station.credentials_enc,
    station.credentials_iv
  );
  const weather = parseStoredWeather(station);
  return c.json({
    weather,
    connection: connectionFromRow(station, weather, station.last_error),
    config: toPublicConfig(station, creds),
    stationId: station.id,
    billing: publicBilling(gate.user, station),
  });
});

app.post('/api/billing/activate', requireAuth, async (c) => {
  // Manual/admin-assisted activation until payment provider is wired
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json(
      {
        error: 'Yearly checkout coming soon. Contact support or an admin to activate after payment.',
        code: 'CHECKOUT_PENDING',
      },
      501
    );
  }
  const body = z
    .object({
      stationId: z.string().optional(),
      wlPlan: z.enum(['pro']).default('pro'),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  const station =
    (body.data.stationId
      ? await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?').bind(body.data.stationId).first<StationRow>()
      : await getStationForUser(c.env, user.id)) || null;
  if (!station) return c.json({ error: 'Station not found' }, 404);

  try {
    await activateYearlySubscription(c.env, station.id, 'pro');
    const updated = await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?').bind(station.id).first<StationRow>();
    const owner = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(station.user_id).first<UserRow>();
    return c.json({ ok: true, billing: publicBilling(owner!, updated) });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ---------- Share links ----------
app.get('/api/share', requireAuth, async (c) => {
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const user = gate.user;
  const links = await c.env.DB.prepare(
    'SELECT id, slug, label, enabled, created_at, updated_at FROM share_links WHERE user_id = ? ORDER BY created_at DESC'
  )
    .bind(user.id)
    .all<Pick<ShareLinkRow, 'id' | 'slug' | 'label' | 'enabled' | 'created_at' | 'updated_at'>>();

  const base = c.env.APP_URL.replace(/\/$/, '');
  return c.json({
    links: (links.results || []).map((l) => ({
      ...l,
      enabled: Boolean(l.enabled),
      url: `${base}/tv/${l.slug}`,
    })),
  });
});

app.post('/api/share', requireAuth, async (c) => {
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const { user, station } = gate;
  if (!station) return c.json({ error: 'Station not found' }, 404);

  const limited = enforceRateLimit(c, 'shareCreate', user.id);
  if (limited) return limited;

  const body = z
    .object({
      label: z.string().max(80).optional(),
      slug: z
        .string()
        .min(12)
        .max(32)
        .regex(/^[a-z0-9-]+$/i)
        .optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));

  if (!body.success) return c.json({ error: 'Invalid input (custom slug must be 12–32 chars)' }, 400);

  // Cap share links per user
  const countRow = await c.env.DB.prepare('SELECT COUNT(*) as c FROM share_links WHERE user_id = ?')
    .bind(user.id)
    .first<{ c: number }>();
  if ((countRow?.c || 0) >= 25) return c.json({ error: 'Share link limit reached' }, 400);

  const slug = (body.data.slug || randomSlug(16)).toLowerCase();
  const existing = await c.env.DB.prepare('SELECT id FROM share_links WHERE slug = ? COLLATE NOCASE')
    .bind(slug)
    .first();
  if (existing) return c.json({ error: 'Slug already taken' }, 409);

  const id = newId();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO share_links (id, station_id, user_id, slug, label, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, station.id, user.id, slug, body.data.label || 'TV Display', now, now)
    .run();

  const base = c.env.APP_URL.replace(/\/$/, '');
  return c.json({
    link: { id, slug, label: body.data.label || 'TV Display', enabled: true, url: `${base}/tv/${slug}` },
  });
});

app.delete('/api/share/:id', requireAuth, async (c) => {
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const user = c.get('user');
  const id = z.string().uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: 'Invalid id' }, 400);
  await c.env.DB.prepare('DELETE FROM share_links WHERE id = ? AND user_id = ?')
    .bind(id.data, user.id)
    .run();
  return c.json({ ok: true });
});

app.get('/api/public/tv/:slug', async (c) => {
  const slugParse = z
    .string()
    .min(4)
    .max(32)
    .regex(/^[a-z0-9-]+$/i)
    .safeParse(c.req.param('slug'));
  if (!slugParse.success) return c.json({ error: 'Display not found' }, 404);

  const limited = enforceRateLimit(c, 'publicTv', slugParse.data.toLowerCase());
  if (limited) return limited;

  const link = await c.env.DB.prepare(
    'SELECT * FROM share_links WHERE slug = ? COLLATE NOCASE AND enabled = 1'
  )
    .bind(slugParse.data)
    .first<ShareLinkRow>();
  if (!link) return c.json({ error: 'Display not found' }, 404);

  const owner = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(link.user_id).first<UserRow>();
  const station = await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?')
    .bind(link.station_id)
    .first<StationRow>();
  if (!owner || !station) return c.json({ error: 'Display not found' }, 404);
  if (owner.suspended) return c.json({ error: 'Display unavailable' }, 403);

  const access = hasAccountAccess(owner, station);
  if (!access.ok) return c.json({ error: 'Display unavailable', code: 'ACCESS_DENIED' }, 402);

  // Public endpoint serves cached weather only — never triggers WeatherLink refresh (abuse amplification)
  const weather = parseStoredWeather(station);
  return c.json(
    {
      weather,
      connection: {
        status: weather ? 'online' : 'offline',
        lastUdpReceived: null,
        lastHttpReceived: station.last_http_at,
        errorMessage: null,
      },
      config: {
        unitTemp: station.unit_temp,
        unitWind: station.unit_wind,
        unitBaro: station.unit_baro,
        unitRain: station.unit_rain,
        stationName: station.name || station.cloud_station_name,
        cloudStationName: station.cloud_station_name,
      },
      label: link.label,
    },
    { status: 200, headers: { 'Cache-Control': 'public, max-age=30' } }
  );
});

// ---------- Admin ----------
app.get('/api/admin/overview', requireAdmin, async (c) => {
  const users = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  const suspended = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE suspended = 1').first<{ c: number }>();
  const activePaid = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM stations WHERE subscription_status = 'active' AND subscription_expires_at > ?`
  )
    .bind(Date.now())
    .first<{ c: number }>();
  return c.json({
    users: users?.c || 0,
    suspended: suspended?.c || 0,
    activePaidDevices: activePaid?.c || 0,
  });
});

app.get('/api/admin/users', requireAdmin, async (c) => {
  const qParse = z.string().max(120).optional().safeParse(c.req.query('q') || undefined);
  const q = (qParse.success ? qParse.data : '')?.trim() || '';
  const limit = 100;
  let rows: UserRow[] = [];
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const res = await c.env.DB.prepare(
      `SELECT * FROM users WHERE email LIKE ? COLLATE NOCASE OR name LIKE ? COLLATE NOCASE ORDER BY created_at DESC LIMIT ?`
    )
      .bind(like, like, limit)
      .all<UserRow>();
    rows = res.results || [];
  } else {
    const res = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?').bind(limit).all<UserRow>();
    rows = res.results || [];
  }

  const out = [];
  for (const u of rows) {
    const station = await getStationForUser(c.env, u.id);
    out.push({ ...publicUser(u), billing: publicBilling(u, station), stationId: station?.id || null });
  }
  return c.json({ users: out });
});

app.patch('/api/admin/users/:id', requireAdmin, async (c) => {
  const body = z
    .object({
      suspended: z.boolean().optional(),
      role: z.enum(['user', 'admin']).optional(),
      notes: z.string().max(500).optional(),
      freeUntil: z.number().nullable().optional(),
      emailVerified: z.boolean().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  const d = body.data;
  const id = c.req.param('id');
  const now = Date.now();

  await c.env.DB.prepare(
    `UPDATE users SET
      suspended = COALESCE(?, suspended),
      role = COALESCE(?, role),
      notes = COALESCE(?, notes),
      free_until = CASE WHEN ? THEN ? ELSE free_until END,
      email_verified = COALESCE(?, email_verified),
      updated_at = ?
     WHERE id = ?`
  )
    .bind(
      d.suspended === undefined ? null : d.suspended ? 1 : 0,
      d.role ?? null,
      d.notes ?? null,
      d.freeUntil !== undefined ? 1 : 0,
      d.freeUntil ?? null,
      d.emailVerified === undefined ? null : d.emailVerified ? 1 : 0,
      now,
      id
    )
    .run();

  if (d.suspended) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  if (!user) return c.json({ error: 'Not found' }, 404);
  const station = await getStationForUser(c.env, id);
  return c.json({ user: publicUser(user), billing: publicBilling(user, station) });
});

app.post('/api/admin/users/:id/activate-device', requireAdmin, async (c) => {
  const body = z
    .object({
      years: z.number().int().min(1).max(5).default(1),
      wlPlan: z.enum(['basic', 'pro']).default('pro'),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  const station = await getStationForUser(c.env, c.req.param('id'));
  if (!station) return c.json({ error: 'Station not found' }, 404);
  if (body.data.wlPlan !== 'pro') {
    return c.json({ error: 'Paid yearly activation requires WeatherLink Pro' }, 400);
  }

  await setStationWlPlan(c.env, station.id, 'pro');
  await activateYearlySubscription(c.env, station.id, 'pro');
  if (body.data.years > 1) {
    const extra = (body.data.years - 1) * 365 * 24 * 60 * 60 * 1000;
    await c.env.DB.prepare(
      `UPDATE stations SET subscription_expires_at = subscription_expires_at + ?, updated_at = ? WHERE id = ?`
    )
      .bind(extra, Date.now(), station.id)
      .run();
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.req.param('id')).first<UserRow>();
  const updated = await getStationForUser(c.env, c.req.param('id'));
  return c.json({ ok: true, billing: publicBilling(user!, updated) });
});

app.get('/api/admin/settings', requireAdmin, async (c) => {
  return c.json({ settings: await listSettingsForAdmin(c.env), groups: SITE_SETTING_GROUPS });
});

app.put('/api/admin/settings', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const body = z
    .object({
      settings: z.record(z.string().max(80), z.string().max(50_000)),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  for (const [key, value] of Object.entries(body.data.settings)) {
    if (!WRITABLE_SETTING_KEYS.has(key)) continue;
    if (value === '••••••••') continue; // keep existing secret
    await setSetting(c.env, key, value);
  }
  return c.json({ settings: await listSettingsForAdmin(c.env), groups: SITE_SETTING_GROUPS });
});

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') {
      return app.fetch(request, env, ctx);
    }

    const assetRes = await env.ASSETS.fetch(request);
    const accept = request.headers.get('Accept') || '';
    const isHtmlNav =
      request.method === 'GET' &&
      (accept.includes('text/html') || url.pathname === '/' || seoPageFromPath(url.pathname));

    if (isHtmlNav && assetRes.ok) {
      const seo = await getSeoForPath(env, url.pathname);
      if (seo) {
        const html = await assetRes.text();
        const injected = injectSeoIntoHtml(html, seo);
        return withSpaSecurityHeaders(
          new Response(injected, {
            status: assetRes.status,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60',
            },
          })
        );
      }
      return withSpaSecurityHeaders(assetRes);
    }

    if (assetRes.headers.get('Content-Type')?.includes('text/html')) {
      return withSpaSecurityHeaders(assetRes);
    }

    return assetRes;
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await purgeDeletedAccounts(env);
        await purgeExpiredAuthRows(env);
        await pollAllStations(env);
      })()
    );
  },
};

async function pollAllStations(env: Env) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT s.* FROM stations s
     JOIN users u ON u.id = s.user_id
     WHERE s.credentials_enc != ''
       AND u.suspended = 0
       AND (
         (u.free_until IS NOT NULL AND u.free_until > ?)
         OR (s.subscription_status = 'active' AND s.subscription_expires_at > ?)
       )
     ORDER BY s.last_http_at ASC NULLS FIRST
     LIMIT 80`
  )
    .bind(now, now)
    .all<StationRow>();

  for (const station of results || []) {
    try {
      const interval = (station.poll_interval_sec || 900) * 1000;
      if (station.last_http_at && now - station.last_http_at < interval - 15_000) continue;
      // Basic plan hard-cap: never poll faster than 15 minutes
      if (normalizeWlPlan(station.wl_plan) === 'basic' && station.last_http_at && now - station.last_http_at < 900_000 - 15_000) {
        continue;
      }
      await refreshStation(env, station);
    } catch (err) {
      console.error('Cron refresh failed', station.id, err);
    }
  }
}
