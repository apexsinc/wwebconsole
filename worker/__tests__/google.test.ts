/**
 * Google OAuth pure-function tests (Node built-in test runner).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hmacSha256Hex } from '../crypto.ts';
import {
  buildGoogleAuthUrl,
  googleRedirectUri,
  signOAuthState,
  verifyOAuthState,
} from '../google.ts';

describe('googleRedirectUri', () => {
  it('appends callback path without double slashes', () => {
    assert.equal(
      googleRedirectUri('https://wwebconsole.com/'),
      'https://wwebconsole.com/api/auth/google/callback'
    );
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
});
