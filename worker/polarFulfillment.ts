import { prepareYearlySubscriptionActivation } from './billing.ts';
import { newId } from './crypto.ts';
import type { Env } from './types.ts';

export interface PolarFulfillmentIdentifiers {
  checkoutId?: unknown;
  eventId?: unknown;
  orderId?: unknown;
}

export type PolarFulfillmentResult =
  | { kind: 'activated' }
  | { kind: 'already-fulfilled' };

function identifier(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Activates a paid station at most once for the supplied Polar identifiers.
 *
 * D1 batch() is one SQLite transaction. The conditional insert wins before the
 * guarded subscription update, and any SQL error rolls the claim back. A losing
 * concurrent request cannot update the station because its random claim id is
 * absent from the claim table.
 */
export async function fulfillPolarSubscriptionOnce(
  env: Env,
  stationId: string,
  identifiers: PolarFulfillmentIdentifiers
): Promise<PolarFulfillmentResult> {
  const checkoutId = identifier(identifiers.checkoutId);
  const eventId = identifier(identifiers.eventId);
  const orderId = identifier(identifiers.orderId);
  if (!checkoutId && !eventId && !orderId) {
    throw new Error('Polar fulfillment is missing a checkout, event, or order id.');
  }

  const claimId = newId();
  const now = Date.now();
  const activation = await prepareYearlySubscriptionActivation(env, stationId, 'pro', claimId);

  // The claim INSERT must be first. ON CONFLICT covers checkout_id, event_id,
  // and order_id; rowsAffected is the authoritative concurrent-winner check.
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO polar_fulfillment_claims
         (id, checkout_id, event_id, order_id, station_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'claimed', ?)
       ON CONFLICT DO NOTHING`
    ).bind(claimId, checkoutId, eventId, orderId, stationId, now),
    activation.statement,
    env.DB.prepare(
      `UPDATE polar_fulfillment_claims
       SET status = 'fulfilled', fulfilled_at = ?
       WHERE id = ? AND status = 'claimed'`
    ).bind(now, claimId),
  ]);

  if ((results[0]?.meta.changes || 0) !== 1) {
    return { kind: 'already-fulfilled' };
  }

  // The station FK makes a missing station fail the INSERT and roll back the
  // whole batch. If the guarded mutation somehow matched no station, release
  // this attempt so a legitimate retry can fulfill the paid checkout.
  if ((results[1]?.meta.changes || 0) !== 1) {
    await env.DB.prepare('DELETE FROM polar_fulfillment_claims WHERE id = ?').bind(claimId).run();
    throw new Error('Polar subscription activation did not complete.');
  }

  // Never release a claim after the station was activated: even if the status
  // update response is anomalous, retaining the unique claim prevents replay.
  if ((results[2]?.meta.changes || 0) !== 1) {
    throw new Error('Polar fulfillment claim status update did not complete.');
  }

  return { kind: 'activated' };
}
