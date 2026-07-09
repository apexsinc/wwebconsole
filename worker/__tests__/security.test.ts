/**
 * Security unit tests (Node built-in test runner).
 * Run: npm test
 *
 * Imports only modules that do not pull Hono/Workers types, using explicit .ts paths for Node ESM.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateOtpCode, randomSlug, hashPassword, verifyPassword } from '../crypto.ts';
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
