/**
 * API prefix policy, legacy alias rewrite, and single-mount tests
 * (no D1 bindings required).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
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
    assert.equal(rewriteLegacyApiPath('/api/admin/users?limit=1'), '/v1/admin/users?limit=1');
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
