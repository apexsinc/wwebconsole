import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import {
  createSession,
  destroySession,
  loginUser,
  optionalAuth,
  registerUser,
  requireAuth,
} from './auth';
import { decryptJson, newId, randomSlug } from './crypto';
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

app.use('/api/*', cors({ origin: (origin) => origin || '*', credentials: true }));

app.get('/api/health', (c) => c.json({ ok: true, app: c.env.APP_NAME }));

// ---------- Auth ----------
app.post('/api/auth/register', async (c) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      name: z.string().max(80).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'Invalid input', details: body.error.flatten() }, 400);

  try {
    const user = await registerUser(c.env, body.data.email, body.data.password, body.data.name || '');
    await createSession(c, user.id);
    return c.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    return c.json({ error: err.message || 'Registration failed' }, 400);
  }
});

app.post('/api/auth/login', async (c) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  try {
    const user = await loginUser(c.env, body.data.email, body.data.password);
    await createSession(c, user.id);
    return c.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    return c.json({ error: err.message || 'Login failed' }, 401);
  }
});

app.post('/api/auth/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

app.get('/api/auth/me', optionalAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null });
  return c.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// ---------- Station / weather ----------
app.get('/api/station', requireAuth, async (c) => {
  const user = c.get('user');
  const station = await getStationForUser(c.env, user.id);
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
  });
});

app.patch('/api/station', requireAuth, async (c) => {
  const user = c.get('user');
  const station = await getStationForUser(c.env, user.id);
  if (!station) return c.json({ error: 'Station not found' }, 404);

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
    .safeParse(await c.req.json());

  if (!body.success) return c.json({ error: 'Invalid input', details: body.error.flatten() }, 400);
  const d = body.data;
  const now = Date.now();

  const existingCreds = await decryptJson<StationCredentials>(
    c.env.CREDENTIALS_KEY,
    station.credentials_enc,
    station.credentials_iv
  );
  const { enc, iv } = await saveCredentials(c.env, existingCreds, {
    password: d.cloudPassword,
    apiToken: d.cloudApiToken,
    apiSecret: d.cloudApiSecret,
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

  const updated = await getStationForUser(c.env, user.id);
  if (!updated) return c.json({ error: 'Station not found' }, 404);

  // Kick an immediate refresh when credentials/config change
  const result = await refreshStation(c.env, updated);
  const fresh = await getStationForUser(c.env, user.id);
  const creds = await decryptJson<StationCredentials>(
    c.env.CREDENTIALS_KEY,
    fresh!.credentials_enc,
    fresh!.credentials_iv
  );

  return c.json({
    weather: result.weather,
    connection: connectionFromRow(fresh!, result.weather, result.error),
    config: toPublicConfig(fresh!, creds),
    stationId: fresh!.id,
  });
});

app.get('/api/weather/current', requireAuth, async (c) => {
  const user = c.get('user');
  let station = await getStationForUser(c.env, user.id);
  if (!station) return c.json({ error: 'Station not found' }, 404);

  const force = c.req.query('refresh') === '1';
  const stale = !station.last_http_at || Date.now() - station.last_http_at > 60_000;
  if (force || stale) {
    await refreshStation(c.env, station);
    station = (await getStationForUser(c.env, user.id))!;
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
  });
});

// ---------- Share links (TV broadcast) ----------
app.get('/api/share', requireAuth, async (c) => {
  const user = c.get('user');
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
  const user = c.get('user');
  const station = await getStationForUser(c.env, user.id);
  if (!station) return c.json({ error: 'Station not found' }, 404);

  const body = z
    .object({
      label: z.string().max(80).optional(),
      slug: z
        .string()
        .min(4)
        .max(32)
        .regex(/^[a-z0-9-]+$/i)
        .optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));

  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  const slug = (body.data.slug || randomSlug(10)).toLowerCase();
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
  const user = c.get('user');
  await c.env.DB.prepare('DELETE FROM share_links WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), user.id)
    .run();
  return c.json({ ok: true });
});

app.get('/api/public/tv/:slug', async (c) => {
  const slug = c.req.param('slug');
  const link = await c.env.DB.prepare(
    'SELECT * FROM share_links WHERE slug = ? COLLATE NOCASE AND enabled = 1'
  )
    .bind(slug)
    .first<ShareLinkRow>();
  if (!link) return c.json({ error: 'Display not found' }, 404);

  let station = await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?')
    .bind(link.station_id)
    .first<StationRow>();
  if (!station) return c.json({ error: 'Station not found' }, 404);

  const stale = !station.last_http_at || Date.now() - station.last_http_at > 90_000;
  if (stale) {
    await refreshStation(c.env, station);
    station = (await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?')
      .bind(link.station_id)
      .first<StationRow>())!;
  }

  const weather = parseStoredWeather(station);
  const publicConfig = {
    unitTemp: station.unit_temp,
    unitWind: station.unit_wind,
    unitBaro: station.unit_baro,
    unitRain: station.unit_rain,
    stationName: station.name || station.cloud_station_name,
    cloudStationName: station.cloud_station_name,
  };

  return c.json({
    weather,
    connection: connectionFromRow(station, weather, station.last_error),
    config: publicConfig,
    label: link.label,
  });
});

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(pollAllStations(env));
  },
};

async function pollAllStations(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT s.* FROM stations s
     WHERE s.credentials_enc != ''
     ORDER BY s.last_http_at ASC NULLS FIRST
     LIMIT 50`
  ).all<StationRow>();

  for (const station of results || []) {
    try {
      await refreshStation(env, station);
    } catch (err) {
      console.error('Cron refresh failed', station.id, err);
    }
  }
}
