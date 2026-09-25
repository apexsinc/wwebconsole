/**
 * Google OAuth pure-function tests (Node built-in test runner).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hmacSha256Hex, verifyStandardWebhookSignature } from '../crypto.ts';
import { isAllowedCoverHost } from '../blog.ts';
import { adminBaseUrl } from '../hosts.ts';
import {
  buildGoogleAuthUrl,
  classifyGoogleOAuthError,
  classifyGoogleRedirectProbe,
  exchangeGoogleCode,
  googleRedirectUri,
  GoogleOAuthError,
  GOOGLE_REDIRECT_URI_CHECK_INTERVAL_MS,
  parseGoogleRedirectUriCheckState,
  serializeGoogleRedirectUriCheckState,
  shouldRunGoogleRedirectCheck,
  signOAuthState,
  verifyOAuthState,
} from '../google.ts';

describe('googleRedirectUri', () => {
  it('uses the canonical /v1 callback registered in Google Cloud', () => {
    // Google matches redirect_uri exactly, so this exact string must stay in
    // sync with the Authorized redirect URIs in the Google Cloud console.
    assert.equal(
      googleRedirectUri('https://api.wwebconsole.com'),
      'https://api.wwebconsole.com/v1/auth/google/callback'
    );
  });
  it('appends callback path without double slashes', () => {
    assert.equal(
      googleRedirectUri('https://wwebconsole.com/'),
      'https://wwebconsole.com/v1/auth/google/callback'
    );
  });
  it('never emits the legacy /api prefix', () => {
    assert.ok(!googleRedirectUri('https://api.wwebconsole.com').includes('/api/'));
  });
});

describe('buildGoogleAuthUrl', () => {
  it('includes required OAuth params', () => {
    const url = new URL(
      buildGoogleAuthUrl({ clientId: 'cid', redirectUri: 'https://x/cb', state: 'st' })
    );
    assert.equal(url.hostname, 'accounts.google.com');
    assert.equal(url.searchParams.get('client_id'), 'cid');
    assert.equal(url.searchParams.get('redirect_uri'), 'https://x/cb');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('state'), 'st');
    assert.ok((url.searchParams.get('scope') || '').includes('openid'));
    assert.ok((url.searchParams.get('scope') || '').includes('email'));
  });
});

describe('Google OAuth token error classification', () => {
  it('maps redirect mismatches and invalid grants to stable typed codes', () => {
    assert.equal(
      classifyGoogleOAuthError('{"error":"redirect_uri_mismatch","error_description":"bad redirect"}'),
      'google_redirect_mismatch'
    );
    assert.equal(
      classifyGoogleOAuthError('{"error":"invalid_grant","error_description":"expired code"}'),
      'google_invalid_grant'
    );
  });

  it('uses the generic code for malformed, non-JSON, empty, and unknown bodies', () => {
    for (const body of [
      '{not json',
      '<html>gateway error</html>',
      '',
      '   ',
      '{}',
      '{"error":"some_future_google_error"}',
    ]) {
      assert.equal(classifyGoogleOAuthError(body), 'google_oauth_error', body);
    }
  });
});

describe('Google OAuth token exchange failures', () => {
  it('throws a typed, generic-message failure for a Google error response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response('{"error":"redirect_uri_mismatch","error_description":"not registered"}', {
        status: 400,
      });
    try {
      await assert.rejects(
        exchangeGoogleCode('client-id', 'not-a-secret', 'not-an-auth-code', 'https://api.example/callback'),
        (err: unknown) => {
          assert.ok(err instanceof GoogleOAuthError);
          assert.equal(err.code, 'google_redirect_mismatch');
          assert.equal(err.status, 400);
          assert.equal(err.message, 'Google authorization failed. Please try again.');
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Google redirect URI probe classification', () => {
  it('recognizes the observed sign-in and OAuth-error redirect shapes', () => {
    assert.equal(
      classifyGoogleRedirectProbe(
        302,
        'https://accounts.google.com/v3/signin/identifier?client_id=cid&redirect_uri=https%3A%2F%2Fapi.example%2Fv1%2Fcallback'
      ),
      'ok'
    );
    assert.equal(
      classifyGoogleRedirectProbe(
        302,
        'https://accounts.google.com/signin/oauth/error?authError=opaque-error'
      ),
      'mismatch'
    );
  });

  it('treats non-redirects and unknown Google paths as inconclusive', () => {
    assert.equal(classifyGoogleRedirectProbe(200, 'https://accounts.google.com/signin'), 'probe_failed');
    assert.equal(classifyGoogleRedirectProbe(302, null), 'probe_failed');
    assert.equal(classifyGoogleRedirectProbe(302, 'https://accounts.google.com/other'), 'probe_failed');
  });
});

describe('Google redirect URI check interval and persisted state', () => {
  it('runs for missing, due, invalid, and future timestamps but not within the interval', () => {
    const now = 1_800_000_000_000;
    assert.equal(shouldRunGoogleRedirectCheck(null, now), true);
    assert.equal(shouldRunGoogleRedirectCheck(now, now), false);
    assert.equal(
      shouldRunGoogleRedirectCheck(now - GOOGLE_REDIRECT_URI_CHECK_INTERVAL_MS + 1, now),
      false
    );
    assert.equal(shouldRunGoogleRedirectCheck(now - GOOGLE_REDIRECT_URI_CHECK_INTERVAL_MS, now), true);
    assert.equal(shouldRunGoogleRedirectCheck(now + 1, now), true);
    assert.equal(shouldRunGoogleRedirectCheck(Number.NaN, now), true);
  });

  it('round-trips the secret-free status value and rejects malformed values', () => {
    const state = {
      checkedAt: 1_800_000_000_000,
      status: 'mismatch' as const,
      expectedRedirectUri: 'https://api.example/v1/auth/google/callback',
      httpStatus: 302,
    };
    assert.deepEqual(
      parseGoogleRedirectUriCheckState(serializeGoogleRedirectUriCheckState(state)),
      state
    );
    assert.equal(parseGoogleRedirectUriCheckState(''), null);
    assert.equal(parseGoogleRedirectUriCheckState('{bad'), null);
    assert.equal(parseGoogleRedirectUriCheckState('{"checkedAt":"not-a-number"}'), null);
  });
});

describe('oauth state round-trip', () => {
  it('signs and verifies, rejects tampering and expiry', async () => {
    const good = await signOAuthState('secret', hmacSha256Hex, {
      nonce: 'n1',
      mode: 'register',
      next: '/app',
      exp: Date.now() + 600_000,
    });
    const v = await verifyOAuthState('secret', hmacSha256Hex, good);
    assert.equal(v?.nonce, 'n1');
    assert.equal(v?.mode, 'register');
    assert.equal(v?.next, '/app');
    // States sealed before adminEntry existed default to main-portal entry.
    assert.equal(v?.adminEntry, false);

    // Tampered payload
    const [b64, sig] = good.split('.');
    assert.equal(await verifyOAuthState('secret', hmacSha256Hex, `${b64}x.${sig}`), null);
    // Wrong secret
    assert.equal(await verifyOAuthState('other', hmacSha256Hex, good), null);
    // Open-redirect next is sanitized
    const evil = await signOAuthState('secret', hmacSha256Hex, {
      nonce: 'n2',
      mode: 'login',
      next: '//evil.com',
      exp: Date.now() + 600_000,
    });
    assert.equal((await verifyOAuthState('secret', hmacSha256Hex, evil))?.next, '/app');
    // Expired
    const old = await signOAuthState('secret', hmacSha256Hex, {
      nonce: 'n3',
      mode: 'login',
      next: '/app',
      exp: Date.now() - 1000,
    });
    assert.equal(await verifyOAuthState('secret', hmacSha256Hex, old), null);
  });

  it('round-trips the sealed admin-entry flag', async () => {
    const admin = await signOAuthState('secret', hmacSha256Hex, {
      nonce: 'a1',
      mode: 'login',
      next: '/app',
      exp: Date.now() + 600_000,
      adminEntry: true,
    });
    assert.equal((await verifyOAuthState('secret', hmacSha256Hex, admin))?.adminEntry, true);
    const main = await signOAuthState('secret', hmacSha256Hex, {
      nonce: 'a2',
      mode: 'login',
      next: '/app',
      exp: Date.now() + 600_000,
      adminEntry: false,
    });
    assert.equal((await verifyOAuthState('secret', hmacSha256Hex, main))?.adminEntry, false);
  });
});

describe('adminBaseUrl', () => {
  it('maps the apex app URL to the admin portal, never user input', () => {
    assert.equal(adminBaseUrl('https://wwebconsole.com'), 'https://admin.wwebconsole.com');
    assert.equal(adminBaseUrl('https://www.wwebconsole.com'), 'https://admin.wwebconsole.com');
    assert.equal(adminBaseUrl('http://localhost:5173'), 'http://admin.localhost:5173');
    // Unknown environments fall back to the app URL itself (no open redirect).
    assert.equal(adminBaseUrl('https://preview.example.workers.dev'), 'https://preview.example.workers.dev');
  });
});

describe('verifyStandardWebhookSignature', () => {
  async function sign(secretB64: string, id: string, ts: string, body: string) {
    const bin = atob(secretB64);
    const key = await crypto.subtle.importKey(
      'raw', Uint8Array.from(bin, (c) => c.charCodeAt(0)),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
    const bytes = new Uint8Array(sig);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }

  it('accepts a valid signature, rejects tampering/expiry', async () => {
    const raw = btoa('testsecret1234567890123456789012');
    const id = 'msg_1', body = '{"type":"order.created"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await sign(raw, id, ts, body);
    const base = { secret: raw, webhookId: id, timestamp: ts, rawBody: body };
    assert.equal(await verifyStandardWebhookSignature({ ...base, signatureHeader: `v1,${sig}` }), true);
    // whsec_ prefix tolerated
    assert.equal(await verifyStandardWebhookSignature({ ...base, secret: `whsec_${raw}`, signatureHeader: `v1,${sig}` }), true);
    // tampered body
    assert.equal(await verifyStandardWebhookSignature({ ...base, rawBody: '{"type":"evil"}', signatureHeader: `v1,${sig}` }), false);
    // stale timestamp
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const oldSig = await sign(raw, id, old, body);
    assert.equal(await verifyStandardWebhookSignature({ ...base, timestamp: old, signatureHeader: `v1,${oldSig}` }), false);
    // missing parts
    assert.equal(await verifyStandardWebhookSignature({ ...base, signatureHeader: '' }), false);
  });
});

describe('isAllowedCoverHost', () => {
  it('allows only image CDN hosts over https', () => {
    assert.equal(isAllowedCoverHost('https://pixabay.com/get/abc.jpg'), true);
    assert.equal(isAllowedCoverHost('https://cdn.pixabay.com/photo/a.jpg'), true);
    assert.equal(isAllowedCoverHost('https://images.unsplash.com/x?w=1'), true);
    assert.equal(isAllowedCoverHost('http://cdn.pixabay.com/a.jpg'), false);
    assert.equal(isAllowedCoverHost('https://evil.com/a.jpg'), false);
    assert.equal(isAllowedCoverHost('https://pixabay.com.evil.com/a.jpg'), false);
    assert.equal(isAllowedCoverHost('not a url'), false);
  });
});
