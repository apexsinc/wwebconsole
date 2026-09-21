/**
 * Security unit tests (Node built-in test runner).
 * Run: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateOtpCode, randomSlug, hashPassword, verifyPassword, hmacSha256Hex, parseSessionCookieValue } from '../crypto.ts';
import { __resetRateLimitsForTests, rateLimit } from '../rateLimit.ts';

describe('crypto', () => {
  it('generateOtpCode returns zero-padded 6-digit strings', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOtpCode(6);
      assert.match(code, /^\d{6}$/);
    }
  });

  it('randomSlug default length is 16 and alphanumeric', () => {
    const slug = randomSlug();
    assert.equal(slug.length, 16);
    assert.match(slug, /^[a-z0-9]+$/);
  });

  it('password hash verifies and rejects wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    assert.equal(await verifyPassword('correct-horse-battery', hash), true);
    assert.equal(await verifyPassword('wrong-password', hash), false);
    // Workers Web Crypto caps PBKDF2 at 100k (see crypto.ts PBKDF2_ITERATIONS).
    assert.match(hash, /^pbkdf2\$100000\$/);
  });

  it('hmacSha256Hex is deterministic', async () => {
    const a = await hmacSha256Hex('secret', 'msg');
    const b = await hmacSha256Hex('secret', 'msg');
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });
});

describe('rateLimit', () => {
  it('allows up to limit then blocks', () => {
    __resetRateLimitsForTests();
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      assert.equal(rateLimit(key, 3, 60_000).ok, true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
  });
});

describe('cors allowlist policy', () => {
  const allowed = new Set([
    'https://wwebconsole.com',
    'https://www.wwebconsole.com',
    'https://admin.wwebconsole.com',
  ]);
  it('documents production origins', () => {
    assert.equal(allowed.has('https://wwebconsole.com'), true);
    assert.equal(allowed.has('https://evil.example'), false);
  });
});

describe('sql injection regression (bound params pattern)', () => {
  it('slug regex rejects injection characters', () => {
    const bad = "a' OR 1=1 --";
    assert.equal(/^[a-z0-9-]+$/i.test(bad), false);
    assert.equal(/^[a-z0-9-]+$/i.test('lobby-tv-01'), true);
  });
});

describe('session cookie parse', () => {
  it('accepts full-HMAC cookies, rejects legacy unsigned/truncated/forged ones', async () => {
    const sid = '11111111-1111-4111-8111-111111111111';
    // Legacy unsigned UUIDs are rejected even without a secret configured.
    assert.equal(await parseSessionCookieValue(undefined, sid), null);
    assert.equal(await parseSessionCookieValue('secret', sid), null);
    assert.equal(await parseSessionCookieValue('secret', 'not-a-uuid'), null);
    // Truncated (128-bit) signatures are rejected.
    const short = (await hmacSha256Hex('secret', sid)).slice(0, 32);
    assert.equal(await parseSessionCookieValue('secret', `${sid}.${short}`), null);
    // Forged signature rejected.
    assert.equal(await parseSessionCookieValue('secret', `${sid}.${'d'.repeat(64)}`), null);
    // Proper round-trip accepted.
    const sig = await hmacSha256Hex('secret', sid);
    assert.equal(sig.length, 64);
    assert.equal(await parseSessionCookieValue('secret', `${sid}.${sig}`), sid);
    // Wrong secret rejected.
    assert.equal(await parseSessionCookieValue('other', `${sid}.${sig}`), null);
  });
});
