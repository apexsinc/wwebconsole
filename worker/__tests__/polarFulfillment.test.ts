import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handlePolarWebhook, verifyAndApplyCheckout } from '../polar.ts';
import { fulfillPolarSubscriptionOnce } from '../polarFulfillment.ts';
import type { Env, UserRow } from '../types.ts';

type ClaimRow = {
  id: string;
  checkout_id: string | null;
  event_id: string | null;
  order_id: string | null;
  station_id: string | null;
  status: 'claimed' | 'fulfilled';
  created_at: number;
  fulfilled_at: number | null;
};

type BoundStatement = {
  sql: string;
  args: unknown[];
  bind: (...args: unknown[]) => BoundStatement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ success: true; results: unknown[]; meta: { changes: number } }>;
};

/** In-memory D1 stand-in that serializes batch() as one rollback-capable transaction. */
function fakeDb() {
  const state = {
    claims: [] as ClaimRow[],
    station: {
      id: 'station-1',
      user_id: 'user-1',
      wl_plan: 'basic',
      subscription_status: 'none',
      subscription_expires_at: null as number | null,
      poll_interval_sec: 900,
      updated_at: 0,
    },
    activationUpdates: 0,
    failNextActivation: false,
  };

  const result = (changes: number) => ({
    success: true as const,
    results: [],
    meta: { changes },
  });

  function statement(sql: string, args: unknown[] = []): BoundStatement {
    const stmt = {
      sql,
      args,
      bind: (...bound: unknown[]) => statement(sql, bound),
      first: async <T>() => {
        if (sql === 'SELECT value FROM app_settings WHERE key = ?') return null;
        if (sql === 'SELECT id FROM stations WHERE id = ? AND user_id = ?') {
          const stationId = args[0];
          const userId = args[1];
          if (state.station.id === stationId && state.station.user_id === userId) {
            return { id: state.station.id } as T;
          }
        }
        return null;
      },
      all: async <T>() => ({ results: [] as T[] }),
      run: async () => executeBatch([stmt])[0]!,
    };
    return stmt;
  }

  function executeBatch(statements: BoundStatement[]) {
    const claimsBefore = structuredClone(state.claims);
    const stationBefore = { ...state.station };
    const activationUpdatesBefore = state.activationUpdates;
    const results: Array<ReturnType<typeof result>> = [];

    try {
      for (const stmt of statements) {
        if (stmt.sql.startsWith('INSERT INTO polar_fulfillment_claims')) {
          const [id, checkoutId, eventId, orderId, stationId, createdAt] = stmt.args;
          if (state.station.id !== stationId) throw new Error('FOREIGN KEY constraint failed');
          const duplicate = state.claims.some(
            (row) =>
              (checkoutId && row.checkout_id === checkoutId) ||
              (eventId && row.event_id === eventId) ||
              (orderId && row.order_id === orderId)
          );
          if (!duplicate) {
            state.claims.push({
              id: id as string,
              checkout_id: checkoutId as string | null,
              event_id: eventId as string | null,
              order_id: orderId as string | null,
              station_id: stationId as string,
              status: 'claimed',
              created_at: createdAt as number,
              fulfilled_at: null,
            });
            results.push(result(1));
          } else {
            results.push(result(0));
          }
        } else if (stmt.sql.startsWith('UPDATE stations SET')) {
          const [expiresAt, poll, updatedAt, stationId, claimId] = stmt.args;
          const ownsClaim = state.claims.some(
            (row) => row.id === claimId && row.status === 'claimed'
          );
          if (!ownsClaim) {
            results.push(result(0));
            continue;
          }
          if (state.failNextActivation) {
            state.failNextActivation = false;
            throw new Error('simulated activation failure');
          }
          if (state.station.id !== stationId) throw new Error('station disappeared during activation');
          state.station.wl_plan = 'pro';
          state.station.subscription_status = 'active';
          state.station.subscription_expires_at = expiresAt as number;
          state.station.poll_interval_sec = poll as number;
          state.station.updated_at = updatedAt as number;
          state.activationUpdates++;
          results.push(result(1));
        } else if (stmt.sql.includes("SET status = 'fulfilled'")) {
          const row = state.claims.find((claim) => claim.id === stmt.args[1]);
          if (row?.status === 'claimed') {
            row.status = 'fulfilled';
            row.fulfilled_at = stmt.args[0] as number;
            results.push(result(1));
          } else {
            results.push(result(0));
          }
        } else if (stmt.sql.startsWith('DELETE FROM polar_fulfillment_claims')) {
          const index = state.claims.findIndex((claim) => claim.id === stmt.args[0]);
          if (index >= 0) state.claims.splice(index, 1);
          results.push(result(index >= 0 ? 1 : 0));
        } else {
          throw new Error(`Unsupported fake D1 SQL: ${stmt.sql}`);
        }
      }
      return results;
    } catch (error) {
      state.claims = claimsBefore;
      Object.assign(state.station, stationBefore);
      state.activationUpdates = activationUpdatesBefore;
      throw error;
    }
  }

  const db = {
    state,
    prepare: (sql: string) => statement(sql),
    batch: async (statements: BoundStatement[]) => executeBatch(statements),
  };
  return db;
}

function envFor(db: ReturnType<typeof fakeDb>): Env {
  return {
    DB: db as any,
    POLAR_ACCESS_TOKEN: 'test-token',
  } as Env;
}

const user = {
  id: 'user-1',
  email: 'buyer@example.com',
} as UserRow;

describe('Polar paid fulfillment idempotency', () => {
  it('first claim succeeds and activation runs', async () => {
    const db = fakeDb();
    const result = await fulfillPolarSubscriptionOnce(envFor(db), 'station-1', {
      checkoutId: 'checkout-1',
    });

    assert.deepEqual(result, { kind: 'activated' });
    assert.equal(db.state.activationUpdates, 1);
    assert.equal(db.state.station.subscription_status, 'active');
    assert.equal(db.state.claims[0]?.status, 'fulfilled');
  });

  it('a second claim for the same checkout does not activate again', async () => {
    const db = fakeDb();
    const env = envFor(db);
    await fulfillPolarSubscriptionOnce(env, 'station-1', { checkoutId: 'checkout-1' });
    const replay = await fulfillPolarSubscriptionOnce(env, 'station-1', { checkoutId: 'checkout-1' });

    assert.deepEqual(replay, { kind: 'already-fulfilled' });
    assert.equal(db.state.activationUpdates, 1);
    assert.equal(db.state.claims.length, 1);
  });

  it('concurrent duplicate claims activate exactly once', async () => {
    const db = fakeDb();
    const env = envFor(db);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        fulfillPolarSubscriptionOnce(env, 'station-1', { checkoutId: 'checkout-1' })
      )
    );

    assert.equal(results.filter((result) => result.kind === 'activated').length, 1);
    assert.equal(results.filter((result) => result.kind === 'already-fulfilled').length, 7);
    assert.equal(db.state.activationUpdates, 1);
    assert.equal(db.state.claims.length, 1);
  });

  it('a failed activation rolls back its claim so a legitimate retry can fulfill', async () => {
    const db = fakeDb();
    const env = envFor(db);
    db.state.failNextActivation = true;

    await assert.rejects(
      fulfillPolarSubscriptionOnce(env, 'station-1', { checkoutId: 'checkout-1' }),
      /simulated activation failure/
    );
    assert.equal(db.state.claims.length, 0);
    assert.equal(db.state.activationUpdates, 0);

    const retry = await fulfillPolarSubscriptionOnce(env, 'station-1', { checkoutId: 'checkout-1' });
    assert.deepEqual(retry, { kind: 'activated' });
    assert.equal(db.state.activationUpdates, 1);
  });

  it('webhook replay of the same event id does not re-activate', async () => {
    const db = fakeDb();
    const env = envFor(db);
    const event = {
      type: 'checkout.updated',
      data: {
        id: 'checkout-1',
        status: 'succeeded',
        metadata: { stationId: 'station-1' },
      },
    };

    const first = await handlePolarWebhook(env, event, 'delivery-1');
    const replay = await handlePolarWebhook(env, event, 'delivery-1');

    assert.equal(first.action, 'activated');
    assert.equal(replay.action, 'already_fulfilled');
    assert.equal(db.state.activationUpdates, 1);
  });

  it('webhook checkout guard blocks a different delivery for the same checkout', async () => {
    const db = fakeDb();
    const env = envFor(db);
    const event = {
      type: 'checkout.updated',
      data: {
        id: 'checkout-1',
        status: 'succeeded',
        metadata: { stationId: 'station-1' },
      },
    };

    await handlePolarWebhook(env, event, 'delivery-1');
    const duplicate = await handlePolarWebhook(env, event, 'delivery-2');

    assert.equal(duplicate.action, 'already_fulfilled');
    assert.equal(db.state.activationUpdates, 1);
  });

  it('repeat checkout verification returns a success-shaped already-processed result', async () => {
    const db = fakeDb();
    const env = envFor(db);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: 'checkout-1',
          status: 'succeeded',
          customer_email: user.email,
          metadata: { userId: user.id, stationId: 'station-1', userEmail: user.email },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    try {
      const first = await verifyAndApplyCheckout(env, 'checkout-1', user);
      const repeat = await verifyAndApplyCheckout(env, 'checkout-1', user);

      assert.equal(first.ok, true);
      assert.equal(first.alreadyProcessed, false);
      assert.equal(repeat.ok, true);
      assert.equal(repeat.alreadyProcessed, true);
      assert.match(repeat.message, /already processed/i);
      assert.equal(db.state.activationUpdates, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
