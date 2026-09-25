/**
 * Browser-level regression tests for the highest-risk user journeys.
 *
 * This suite deliberately uses playwright-core directly instead of adding a
 * second test runner. Each test gets a fresh browser context, and the context
 * blocks every non-local request. The Google navigation is fulfilled locally
 * after the real /v1/auth/google/start request has been observed, so this file
 * can never complete a real Google sign-in.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const GOOGLE_REDIRECT_URI = 'https://api.wwebconsole.com/v1/auth/google/callback';
const CANONICAL_BASE = 'https://wwebconsole.com';
const GOOGLE_CLIENT_ID = 'ui-regression-test.apps.googleusercontent.com';
const AUTH_CONFIG_RESPONSE = JSON.stringify({
  turnstileEnabled: false,
  turnstileSiteKey: '',
  emailVerificationRequired: false,
  yearlyPriceUsd: 39,
  freeTrialDays: 30,
  googleClientId: GOOGLE_CLIENT_ID,
});

let baseUrl = '';
let viteServer = null;
let browser = null;
let workerGoogleConfigured = false;

async function canReach(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function detectWorkerGoogleSupport() {
  const hostname = new URL(baseUrl).hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return;
  try {
    const response = await fetch(`${baseUrl}/v1/auth/google/start?mode=login&ui_probe=1`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    });
    const location = response.headers.get('location') || '';
    workerGoogleConfigured = /^https:\/\/accounts\.google\.com\//.test(location);
  } catch {
    workerGoogleConfigured = false;
  }
}

async function startServer() {
  if (process.env.UI_TEST_BASE_URL) {
    baseUrl = process.env.UI_TEST_BASE_URL.replace(/\/+$/, '');
    if (!(await canReach(`${baseUrl}/v1/health`))) {
      throw new Error(`UI_TEST_BASE_URL is not serving /v1/health: ${baseUrl}`);
    }
    await detectWorkerGoogleSupport();
    return;
  }

  // Vite is already a project dependency; run its server API in-process so the
  // single test command owns startup and cleanup without a shell wrapper.
  process.env.VITE_API_URL = '';
  const { createServer } = await import('vite');
  viteServer = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
  });
  await viteServer.listen();
  const address = viteServer.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
  await detectWorkerGoogleSupport();
}

async function stopServer() {
  await viteServer?.close();
  viteServer = null;
}

function responseHeader(headers, name) {
  const wanted = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === wanted);
  return entry ? entry[1] : '';
}

function isLocalRequest(requestUrl, localOrigin) {
  return requestUrl.origin === localOrigin;
}

function googleOAuthStubUrl() {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', 'ui-regression-test');
  return url.toString();
}

/**
 * Make every test hermetic. Local requests continue to the Vite/Worker server;
 * Google's script is aborted so the accessible redirect anchor stays visible;
 * Google's OAuth pages are fulfilled with a local stub; all other third-party
 * requests are aborted.
 */
async function isolateContext(context) {
  const localOrigin = new URL(baseUrl).origin;
  const state = { authConfigRequests: 0, externalRequests: [], googleStartFallbacks: 0 };

  await context.route('**/*', async (route) => {
    const request = route.request();
    let requestUrl;
    try {
      requestUrl = new URL(request.url());
    } catch {
      await route.abort();
      return;
    }

    if (isLocalRequest(requestUrl, localOrigin)) {
      if (
        requestUrl.pathname === '/v1/auth/google/start' &&
        request.method() === 'GET' &&
        !workerGoogleConfigured
      ) {
        // A clean CI checkout may not have a Google client ID. Keep the
        // browser test runnable without credentials while still exercising
        // the real trusted click and the exact callback contract below.
        state.googleStartFallbacks += 1;
        const target = googleOAuthStubUrl();
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: `<!doctype html><script>window.location.replace(${JSON.stringify(target)})</script>`,
        });
        return;
      }
      if (requestUrl.pathname === '/v1/auth/config' && request.method() === 'GET') {
        state.authConfigRequests += 1;
        // Keep this browser suite independent of a developer's local D1 seed;
        // the request and cache/coalescing behavior remain real browser work.
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: AUTH_CONFIG_RESPONSE,
        });
        return;
      }
      await route.continue();
      return;
    }

    state.externalRequests.push(requestUrl.href);
    if (requestUrl.hostname === 'accounts.google.com') {
      if (requestUrl.pathname === '/gsi/client') {
        // Force the component's real redirect anchor to be the tested control.
        await route.abort();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><title>Google navigation stub</title>',
      });
      return;
    }

    await route.abort();
  });

  return state;
}

async function withPage(run) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'block',
  });
  const state = await isolateContext(context);
  const page = await context.newPage();
  try {
    return await run(page, state);
  } finally {
    await context.close();
  }
}

async function openPage(page, pathname) {
  return page.goto(`${baseUrl}${pathname}`, {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  });
}

async function waitForGoogleRedirect(page, expectedMode) {
  const startRequestPromise = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/v1/auth/google/start',
    { timeout: 10_000 },
  );
  const googleRequestPromise = page.waitForRequest(
    (request) => {
      const url = new URL(request.url());
      return url.hostname === 'accounts.google.com' && url.pathname === '/o/oauth2/v2/auth';
    },
    { timeout: 10_000 },
  );

  // This is intentionally a real trusted locator click, not element.click()
  // through page.evaluate. The regression only reproduces for trusted input.
  const googleLink = page.getByRole('link', { name: 'Continue with Google' });
  await googleLink.waitFor({ state: 'visible' });
  // Let the explicit request/URL assertions below own navigation waiting; the
  // click itself still dispatches Playwright's trusted input event.
  await googleLink.click({ noWaitAfter: true });

  const [startResult, googleResult] = await Promise.allSettled([
    startRequestPromise,
    googleRequestPromise,
  ]);
  if (startResult.status === 'rejected') throw startResult.reason;
  if (googleResult.status === 'rejected') throw googleResult.reason;
  const startRequest = startResult.value;
  const googleRequest = googleResult.value;
  const startUrl = new URL(startRequest.url());
  const googleUrl = new URL(googleRequest.url());

  assert.equal(startRequest.method(), 'GET');
  assert.equal(startUrl.origin, baseUrl);
  assert.equal(startUrl.pathname, '/v1/auth/google/start');
  assert.equal(startUrl.searchParams.get('mode'), expectedMode);
  assert.equal(googleUrl.hostname, 'accounts.google.com');
  assert.equal(googleUrl.pathname, '/o/oauth2/v2/auth');
  assert.equal(googleUrl.searchParams.get('redirect_uri'), GOOGLE_REDIRECT_URI);

  await page.waitForURL((url) => url.hostname === 'accounts.google.com', {
    waitUntil: 'commit',
    timeout: 10_000,
  });
  assert.equal(new URL(page.url()).hostname, 'accounts.google.com');
}

before(async () => {
  await startServer();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await stopServer();
});

describe('browser regression coverage', () => {
  for (const [pathname, mode] of [
    ['/login', 'login'],
    ['/register', 'register'],
  ]) {
    it(`keeps the ${mode} Google control a real navigable link`, async () => {
      await withPage(async (page) => {
        await openPage(page, pathname);
        await waitForGoogleRedirect(page, mode);
      });
    });
  }

  it('coalesces auth config requests on load and across rapid SPA navigations', async () => {
    await withPage(async (page, state) => {
      const configResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/v1/auth/config',
        { timeout: 10_000 },
      );
      await openPage(page, '/login');
      await configResponse;
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
      assert.equal(state.authConfigRequests, 1, 'one /login load should make one config request');

      await page.getByRole('link', { name: 'Create account' }).click();
      await page.waitForURL((url) => url.pathname === '/register');
      await page.getByRole('heading', { name: 'Create account' }).waitFor();

      await page.getByRole('link', { name: 'Sign in' }).click();
      await page.waitForURL((url) => url.pathname === '/login');
      await page.getByRole('heading', { name: 'Sign in' }).waitFor();
      await page.waitForLoadState('networkidle', { timeout: 10_000 });

      assert.equal(state.authConfigRequests, 1, 'rapid client-side navigations should reuse the five-minute cache');
    });
  });

  it('serves noindex self-canonical private pages with X-Robots-Tag', async () => {
    for (const pathname of ['/login', '/app']) {
      await withPage(async (page) => {
        const response = await openPage(page, pathname);
        assert.ok(response, `expected an HTTP response for ${pathname}`);
        assert.equal(response.status(), 200, pathname);

        const headers = response.headers();
        assert.match(responseHeader(headers, 'x-robots-tag'), /noindex/i, `${pathname} response header`);
        const html = await response.text();
        const robots = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i)?.[1] || '';
        const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || '';
        assert.match(robots, /noindex/i, `${pathname} response meta`);
        assert.equal(canonical, `${CANONICAL_BASE}${pathname}`, `${pathname} self-canonical`);
        assert.notEqual(canonical, `${CANONICAL_BASE}/`, `${pathname} must not canonicalize to the homepage`);
      });
    }
  });

  it('keeps /v1 and /api health equivalent and unknown API paths JSON 404s', async () => {
    await withPage(async (page) => {
      const healthBodies = [];
      for (const prefix of ['/v1', '/api']) {
        const response = await openPage(page, `${prefix}/health`);
        assert.ok(response, `expected health response for ${prefix}`);
        assert.equal(response.status(), 200, prefix);
        assert.match(responseHeader(response.headers(), 'content-type'), /application\/json/i, prefix);
        healthBodies.push(JSON.parse(await response.text()));
      }
      assert.deepEqual(healthBodies[0], healthBodies[1]);

      for (const prefix of ['/v1', '/api']) {
        const response = await openPage(page, `${prefix}/__ui_test_unknown__`);
        assert.ok(response, `expected missing API response for ${prefix}`);
        assert.equal(response.status(), 404, prefix);
        assert.match(responseHeader(response.headers(), 'content-type'), /application\/json/i, prefix);
        assert.deepEqual(JSON.parse(await response.text()), { error: 'Not found' });
      }
    });
  });
});
