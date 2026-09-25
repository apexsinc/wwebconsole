/**
 * API prefix policy, legacy alias rewrite, single-mount tests, and
 * production-worker integration tests (no D1 bindings required).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { createServer, type ViteDevServer } from 'vite';
import {
  API_PREFIX,
  LEGACY_API_PREFIX,
  apiPath,
  isApiPath,
  rewriteLegacyApiPath,
} from '../../shared/apiPaths.ts';

describe('API path policy', () => {
  it('uses /v1 as canonical and retains /api as a permanent alias', () => {
    assert.equal(API_PREFIX, '/v1');
    assert.equal(LEGACY_API_PREFIX, '/api');
    assert.equal(apiPath('/health'), '/v1/health');
  });

  it('handles empty paths, repeated leading slashes, queries, and trailing slashes', () => {
    assert.equal(apiPath(), '/v1');
    assert.equal(apiPath(''), '/v1');
    assert.equal(apiPath('/'), '/v1/');
    assert.equal(apiPath('///health'), '/v1/health');
    assert.equal(apiPath('/auth/google/start?mode=login&entry=admin'), '/v1/auth/google/start?mode=login&entry=admin');
    assert.equal(apiPath('/health/?refresh=1'), '/v1/health/?refresh=1');
  });

  it('recognizes both API prefixes without matching similarly named paths', () => {
    for (const path of ['/v1', '/v1/health', '/api', '/api/health']) {
      assert.equal(isApiPath(path), true, path);
    }
    for (const path of ['/v10/health', '/apiary/health', '/', '/v2/health']) {
      assert.equal(isApiPath(path), false, path);
    }
  });
});

describe('rewriteLegacyApiPath', () => {
  it('maps legacy paths onto the canonical prefix', () => {
    assert.equal(rewriteLegacyApiPath('/api'), '/v1');
    assert.equal(rewriteLegacyApiPath('/api/health'), '/v1/health');
    assert.equal(rewriteLegacyApiPath('/api/auth/google/callback'), '/v1/auth/google/callback');

    // The real handler passes URL.pathname (not pathname + search) to the
    // rewriter, then changes only pathname on the original URL.
    const rewritten = new URL('https://example.test/api/admin/users?limit=1');
    const canonicalPath = rewriteLegacyApiPath(rewritten.pathname);
    assert.ok(canonicalPath);
    rewritten.pathname = canonicalPath;
    assert.equal(rewritten.toString(), 'https://example.test/v1/admin/users?limit=1');
  });

  it('leaves canonical and non-API paths untouched', () => {
    for (const path of ['/v1/health', '/apiary/health', '/', '/app', '/v2/health']) {
      assert.equal(rewriteLegacyApiPath(path), null, path);
    }
  });
});

/** Mirrors the worker: one mount + pre-routing legacy re-dispatch. */
function buildWorkerLikeApp() {
  const api = new Hono();
  // Enough routes to exercise router selection, as in the real app.
  for (let i = 0; i < 60; i++) api.get(`/route${i}`, (c) => c.json({ i }));
  api.get('/health', (c) => c.json({ ok: true }));
  api.post('/echo', async (c) => c.json({ body: await c.req.json().catch(() => null) }));
  api.all('*', (c) => c.json({ error: 'Not found' }, 404));

  const app = new Hono();
  app.route(API_PREFIX, api);

  const dispatch = (request: Request) => {
    const url = new URL(request.url);
    const canonical = rewriteLegacyApiPath(url.pathname);
    if (canonical) {
      url.pathname = canonical;
      return app.fetch(new Request(url.toString(), request));
    }
    return app.fetch(request);
  };
  return { app, dispatch };
}

describe('API alias via pre-routing rewrite (single mount)', () => {
  it('serves canonical and legacy paths from one route table', async () => {
    const { dispatch } = buildWorkerLikeApp();
    for (const prefix of [API_PREFIX, LEGACY_API_PREFIX]) {
      const health = await dispatch(new Request(`https://example.test${prefix}/health`));
      assert.equal(health.status, 200, prefix);
      assert.deepEqual(await health.json(), { ok: true });

      const missing = await dispatch(new Request(`https://example.test${prefix}/nope`));
      assert.equal(missing.status, 404, prefix);
      assert.deepEqual(await missing.json(), { error: 'Not found' });
    }
  });

  it('resolves every route deterministically on repeated requests', async () => {
    const { dispatch } = buildWorkerLikeApp();
    // Regression guard: the duplicate-mount implementation intermittently fell
    // through to the catch-all and returned 404 for valid routes in production.
    for (let n = 0; n < 300; n++) {
      const prefix = n % 2 ? API_PREFIX : LEGACY_API_PREFIX;
      const res = await dispatch(new Request(`https://example.test${prefix}/route42`));
      assert.equal(res.status, 200, `iteration ${n} on ${prefix}`);
      assert.deepEqual(await res.json(), { i: 42 });
    }
  });

  it('preserves the request body through the legacy rewrite', async () => {
    const { dispatch } = buildWorkerLikeApp();
    const res = await dispatch(
      new Request(`https://example.test${LEGACY_API_PREFIX}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hello: 'world' }),
      })
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { body: { hello: 'world' } });
  });
});

/**
 * Exercise the real default export rather than only the stand-in above. Vite's
 * SSR loader resolves the Worker's extensionless TypeScript imports without
 * requiring a build artifact or a live D1 binding.
 */
describe('production worker legacy re-dispatch', () => {
  type WorkerModule = {
    default: {
      fetch(request: Request, env: any, ctx: any): Promise<Response>;
    };
  };

  const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
  let vite: ViteDevServer | undefined;
  let worker!: WorkerModule['default'];
  let assetFetches = 0;

  const env = {
    APP_NAME: 'API path test',
    APP_URL: 'https://wwebconsole.com',
    API_URL: 'https://api.wwebconsole.com',
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    ASSETS: {
      fetch: async () => {
        assetFetches += 1;
        return new Response('<html>SPA shell</html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    },
  } as any;
  const executionContext = {
    waitUntil() {},
    passThroughOnException() {},
  } as any;

  before(async () => {
    vite = await createServer({
      root: projectRoot,
      configFile: false,
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
    });
    const loaded = (await vite.ssrLoadModule('/worker/index.ts')) as WorkerModule;
    worker = loaded.default;
  });

  after(async () => {
    await vite?.close();
  });

  function dispatch(url: string, init?: RequestInit): Promise<Response> {
    return worker.fetch(new Request(url, init), env, executionContext);
  }

  it('serves the real health route, strict API headers, and JSON catch-all through both prefixes', async () => {
    for (const prefix of [API_PREFIX, LEGACY_API_PREFIX]) {
      const before = assetFetches;
      const health = await dispatch(`https://api.wwebconsole.com${prefix}/health?probe=1`);
      assert.equal(health.status, 200, prefix);
      assert.deepEqual(await health.json(), { ok: true, app: 'API path test' });
      assert.equal(health.headers.get('Cache-Control'), 'no-store');
      assert.match(health.headers.get('Content-Security-Policy') || '', /default-src 'none'/);

      const head = await dispatch(`https://api.wwebconsole.com${prefix}/health`, { method: 'HEAD' });
      assert.equal(head.status, 200, `${prefix} HEAD`);
      assert.match(head.headers.get('Content-Type') || '', /^application\/json/);
      assert.equal(await head.text(), '');

      for (const path of ['', '/missing']) {
        const missing = await dispatch(`https://api.wwebconsole.com${prefix}${path}`);
        assert.equal(missing.status, 404, `${prefix}${path}`);
        assert.match(missing.headers.get('Content-Type') || '', /^application\/json/);
        assert.deepEqual(await missing.json(), { error: 'Not found' });
      }
      assert.equal(assetFetches, before, `${prefix} must never fall through to SPA assets`);
    }
  });

  it('answers allowed CORS preflights through both prefixes', async () => {
    for (const prefix of [API_PREFIX, LEGACY_API_PREFIX]) {
      const res = await dispatch(`https://api.wwebconsole.com${prefix}/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://wwebconsole.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      assert.equal(res.status, 204, prefix);
      assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://wwebconsole.com');
      assert.equal(res.headers.get('Access-Control-Allow-Credentials'), 'true');
      assert.match(res.headers.get('Access-Control-Allow-Methods') || '', /POST/);
      assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
    }
  });

  it('preserves POST bodies and applies the JSON body limit to both prefixes', async () => {
    const validShape = JSON.stringify({ credential: 'x'.repeat(20), nonce: '12345678', mode: 'login' });
    for (const prefix of [API_PREFIX, LEGACY_API_PREFIX]) {
      const res = await dispatch(`https://api.wwebconsole.com${prefix}/auth/google/credential`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: validShape,
      });
      assert.equal(res.status, 400, prefix);
      // A lost body would parse as `{}` and return "Invalid input" instead.
      assert.equal((await res.json() as { error: string }).error, 'Google sign-in failed. Please try again.');

      const oversizedBody = 'x'.repeat(64 * 1024 + 1);
      const oversized = await dispatch(`https://api.wwebconsole.com${prefix}/auth/google/credential`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(new TextEncoder().encode(oversizedBody).byteLength),
        },
        body: oversizedBody,
      });
      assert.equal(oversized.status, 413, prefix);
      assert.deepEqual(await oversized.json(), { error: 'Request body too large' });
    }
  });

  it('uses one rate-limit bucket across canonical and legacy aliases', async () => {
    const rateLimit = await vite!.ssrLoadModule('/worker/rateLimit.ts');
    rateLimit.__resetRateLimitsForTests();
    const statement = {
      bind() {
        return this;
      },
      first: async () => null,
    };
    const limitedEnv = { ...env, DB: { prepare: () => statement } } as any;

    for (let n = 0; n < 11; n++) {
      const prefix = n % 2 ? LEGACY_API_PREFIX : API_PREFIX;
      const res = await worker.fetch(
        new Request(`https://api.wwebconsole.com${prefix}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '198.51.100.42',
          },
          body: JSON.stringify({ email: 'shared-bucket@example.com', password: 'x' }),
        }),
        limitedEnv,
        executionContext
      );
      assert.equal(res.status, n < 10 ? 401 : 429, `request ${n + 1} via ${prefix}`);
    }
  });

  it('preserves query parameters and route redirects, with the registered legacy Google callback', async () => {
    for (const prefix of [API_PREFIX, LEGACY_API_PREFIX]) {
      const res = await dispatch(
        `https://api.wwebconsole.com${prefix}/auth/google/start?mode=register&entry=admin`
      );
      assert.equal(res.status, 302, prefix);
      const location = new URL(res.headers.get('Location') || '');
      assert.equal(location.hostname, 'accounts.google.com');
      assert.equal(
        location.searchParams.get('redirect_uri'),
        'https://api.wwebconsole.com/v1/auth/google/callback'
      );

      const state = location.searchParams.get('state') || '';
      const encodedPayload = state.split('.')[0] || '';
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
        mode: string;
        adminEntry: boolean;
      };
      assert.equal(payload.mode, 'register');
      assert.equal(payload.adminEntry, true);
    }
  });

  it('keeps API paths off the SPA on every production host and canonicalizes www first', async () => {
    for (const host of ['wwebconsole.com', 'admin.wwebconsole.com', 'api.wwebconsole.com']) {
      for (const prefix of [API_PREFIX, LEGACY_API_PREFIX]) {
        const before = assetFetches;
        const res = await dispatch(`https://${host}${prefix}/health`);
        assert.equal(res.status, 200, `${host}${prefix}`);
        assert.equal(assetFetches, before, `${host}${prefix} must not touch assets`);
      }
    }

    for (const prefix of [API_PREFIX, LEGACY_API_PREFIX]) {
      const res = await dispatch(`https://www.wwebconsole.com${prefix}/health?from=www`);
      assert.equal(res.status, 301, prefix);
      assert.equal(
        res.headers.get('Location'),
        `https://wwebconsole.com${prefix}/health?from=www`
      );
    }

    const before = assetFetches;
    const missing = await dispatch('https://api.wwebconsole.com/not-an-api-path');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('Content-Type') || '', /^application\/json/);
    assert.deepEqual(await missing.json(), { error: 'Not found' });
    assert.equal(assetFetches, before, 'API-only host 404 must not serve the SPA shell');
  });

  it('keeps robots, private-route SEO, and the earlier CSP allowlist fixes intact', async () => {
    const statement = {
      bind() {
        return this;
      },
      all: async () => ({ results: [] }),
      first: async () => null,
      run: async () => ({}),
    };
    const settings = await vite!.ssrLoadModule('/worker/settings.ts');
    const security = await vite!.ssrLoadModule('/worker/security.ts');
    const dbEnv = { DB: { prepare: () => statement } } as any;

    const robots = await settings.buildRobotsTxt(dbEnv, 'wwebconsole.com');
    for (const expected of [
      'Disallow: /v1/',
      'Disallow: /api/',
      'Disallow: /app',
      'Disallow: /account',
      'Disallow: /admin',
      'Disallow: /tv/',
    ]) {
      assert.match(robots, new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    }

    assert.equal(settings.isNoIndexPath('/app'), true);
    assert.equal(settings.isKnownIndexableRoute('/features'), true);
    assert.equal(settings.isKnownIndexableRoute('/featurez'), false);
    assert.equal(
      settings.seoForNoIndexPath('/app', { base: 'https://wwebconsole.com' }).canonical,
      'https://wwebconsole.com/app'
    );
    assert.match(security.SPA_CONTENT_SECURITY_POLICY, /https:\/\/static\.cloudflareinsights\.com/);
    assert.match(security.SPA_CONTENT_SECURITY_POLICY, /https:\/\/accounts\.google\.com/);
  });
});
