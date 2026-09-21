/**
 * Phase tests: decrypt behavior, admin validation, hostname policy,
 * settings batching, pricing determinism (Node built-in test runner).
 * Run: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { decryptJson, DecryptFailedError, encryptJson } from '../crypto.ts';
import { isAdminHostname } from '../hosts.ts';
import { mergeSettingsValues } from '../settingsMerge.ts';
import { localizeYearlyPrice } from '../pricing.ts';

describe('decryptJson explicit failure', () => {
  it('returns {} when nothing stored (no enc/iv/key)', async () => {
    assert.deepEqual(await decryptJson('ab'.repeat(32), '', ''), {});
    assert.deepEqual(await decryptJson(undefined, 'e', 'i'), {});
  });

  it('round-trips encrypt/decrypt', async () => {
    const key = '0b'.repeat(32);
    const { enc, iv } = await encryptJson(key, { apiToken: 'tok' });
    assert.deepEqual(await decryptJson(key, enc, iv), { apiToken: 'tok' });
  });

  it('throws DecryptFailedError on corrupt data (never silent {})', async () => {
    const key = '0b'.repeat(32);
    await assert.rejects(decryptJson(key, '!!!not-base64!!!', 'AAAAAAAAAAAAAAAA'), DecryptFailedError);
  });

  it('throws on wrong key (rotation scenario)', async () => {
    const { enc, iv } = await encryptJson('0b'.repeat(32), { apiToken: 'tok' });
    await assert.rejects(decryptJson('ff'.repeat(32), enc, iv), DecryptFailedError);
  });
});

describe('admin param validation', () => {
  const uuid = z.string().uuid();
  it('accepts UUIDs, rejects junk ids', () => {
    assert.equal(uuid.safeParse('11111111-1111-4111-8111-111111111111').success, true);
    assert.equal(uuid.safeParse('1 OR 1=1').success, false);
    assert.equal(uuid.safeParse('').success, false);
  });

  const limit = z.coerce.number().int().min(1).max(200).optional();
  const offset = z.coerce.number().int().min(0).max(100000).optional();
  it('pagination clamps limit/offset', () => {
    assert.equal(limit.safeParse('20').data, 20);
    assert.equal(limit.safeParse('9999').success, false);
    assert.equal(offset.safeParse('-1').success, false);
    assert.equal(offset.safeParse(undefined).success, true);
  });
});

describe('isAdminHostname strict policy', () => {
  it('only matches real admin hosts', () => {
    assert.equal(isAdminHostname('admin.wwebconsole.com'), true);
    assert.equal(isAdminHostname('admin.localhost'), true);
    assert.equal(isAdminHostname('admin.evil.com'), false);
    assert.equal(isAdminHostname('admin.wwebconsole.com.evil.com'), false);
    assert.equal(isAdminHostname('wwebconsole.com'), false);
  });
});

describe('mergeSettingsValues (single-query batch semantics)', () => {
  const defaults = { site_name: 'Default', yearly_price_usd: '39', seo_home_title: 'Home' };

  it('prefers db values, falls back to defaults on empty/missing', () => {
    const map = mergeSettingsValues(
      ['site_name', 'yearly_price_usd', 'seo_home_title'],
      new Map([['site_name', 'Custom'], ['yearly_price_usd', '']]),
      {},
      defaults
    );
    assert.equal(map.site_name, 'Custom');
    assert.equal(map.yearly_price_usd, '39');
    assert.equal(map.seo_home_title, 'Home');
  });

  it('prefers Worker secrets over db values', () => {
    const map = mergeSettingsValues(
      ['turnstile_secret_key'],
      new Map([['turnstile_secret_key', 'db-value']]),
      { turnstile_secret_key: 's3cret' },
      defaults
    );
    assert.equal(map.turnstile_secret_key, 's3cret');
  });

  it('dedupes keys and defaults unknown keys to empty', () => {
    const map = mergeSettingsValues(['a', 'a', 'missing'], new Map(), {}, defaults);
    assert.equal(map.missing, '');
    assert.deepEqual(Object.keys(map).sort(), ['a', 'missing']);
  });
});

describe('localizeYearlyPrice determinism', () => {
  it('formats stable across calls (pinned locale)', () => {
    const a = localizeYearlyPrice(39, 'PH');
    const b = localizeYearlyPrice(39, 'PH');
    assert.equal(a.formatted, b.formatted);
    assert.equal(a.currency, 'PHP');
    const us = localizeYearlyPrice(39, 'US');
    assert.equal(us.currency, 'USD');
  });
});

describe('sessionStore cap', () => {
  function fakeDb() {
    const rows: { id: string; user_id: string; created_at: number }[] = [];
    const db = {
      rows,
      prepare(sql: string) {
        return {
          bind: (...args: unknown[]) => ({
            all: async () => {
              if (sql.startsWith('SELECT id FROM sessions')) {
                return { results: rows.filter((r) => r.user_id === args[0]).sort((a, b) => a.created_at - b.created_at).map((r) => ({ id: r.id })) };
              }
              return { results: [] };
            },
            run: async () => {
              if (sql.startsWith('INSERT INTO sessions')) {
                rows.push({ id: args[0] as string, user_id: args[1] as string, created_at: args[3] as number });
              } else if (sql.startsWith('DELETE FROM sessions WHERE id IN')) {
                const gone = new Set(args as string[]);
                for (let i = rows.length - 1; i >= 0; i--) {
                  if (gone.has(rows[i]!.id)) rows.splice(i, 1);
                }
              }
              return {};
            },
            first: async () => null,
          }),
        };
      },
    };
    return db;
  }

  it('keeps newest 10, prunes oldest', async () => {
    const { insertSession, pruneSessionsToCap } = await import('../sessionStore.ts');
    const db = fakeDb();
    for (let i = 0; i < 12; i++) await insertSession(db as any, `s${i}`, 'u1', 999, i);
    assert.equal(await pruneSessionsToCap(db as any, 'u1', 10), 2);
    assert.deepEqual(
      db.rows.map((r) => r.id),
      ['s2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11']
    );
    assert.equal(await pruneSessionsToCap(db as any, 'u1', 10), 0);
  });

  it('does not touch other users', async () => {
    const { insertSession, pruneSessionsToCap } = await import('../sessionStore.ts');
    const db = fakeDb();
    for (let i = 0; i < 11; i++) await insertSession(db as any, `a${i}`, 'u1', 999, i);
    await insertSession(db as any, 'b0', 'u2', 999, 0);
    await pruneSessionsToCap(db as any, 'u1', 10);
    assert.ok(db.rows.some((r) => r.id === 'b0'));
    assert.equal(db.rows.filter((r) => r.user_id === 'u1').length, 10);
  });
});
