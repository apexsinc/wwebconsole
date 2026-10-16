import { getSetting } from './settings.ts';
import type { Env, StationRow, SubscriptionStatus, UserRow, WlPlan } from './types.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

export function normalizeWlPlan(raw?: string | null): WlPlan {
  const v = (raw || '').toLowerCase();
  if (v.includes('pro') || v.includes('premier') || v.includes('advantage')) return 'pro';
  if (v.includes('basic') || v.includes('standard') || v === 'free') return 'basic';
  return 'unknown';
}

export async function getPollIntervalSec(env: Env, wlPlan: WlPlan, apiVersion: string = 'v2'): Promise<number> {
  if (apiVersion === 'v1') {
    const basicV1 = Number(await getSetting(env, 'poll_basic_sec')) || 60;
    return Math.max(30, basicV1);
  }
  // Davis WeatherLink Cloud V2 data publishing permissions (https://weatherlink.github.io/v2-api/data-permissions):
  // Pro: 5-minute archive records (300s)
  // Basic: 15-minute archive records (900s)
  return wlPlan === 'basic' ? 900 : 300;
}

export function isUserSuspended(user: UserRow): boolean {
  return Boolean(user.suspended);
}

export function hasAccountAccess(user: UserRow, station?: StationRow | null): { ok: boolean; reason?: string; status: SubscriptionStatus } {
  if (isUserSuspended(user)) return { ok: false, reason: 'Account suspended', status: 'none' };

  // Admins always have access in production, staging, and local
  if ((user.role || '') === 'admin') {
    return { ok: true, status: (station?.subscription_status as SubscriptionStatus) || 'active' };
  }

  const now = Date.now();

  // A paid (or admin-comped) Pro subscription always takes precedence over
  // the free trial, even if the trial window hasn't lapsed yet — otherwise
  // upgrading a still-in-trial user has no visible effect until their trial
  // naturally expires.
  const subStatus = (station?.subscription_status || 'none') as SubscriptionStatus;
  const expires = station?.subscription_expires_at || 0;
  const hasActivePro = subStatus === 'active' && expires > now && normalizeWlPlan(station?.wl_plan) === 'pro';
  if (hasActivePro) {
    return { ok: true, status: 'active' };
  }

  if (user.free_until && user.free_until > now) {
    return { ok: true, status: 'trial' };
  }

  if (subStatus === 'active' && expires > now) {
    return {
      ok: false,
      reason: 'Paid plans require a WeatherLink Pro subscription on the device',
      status: 'active',
    };
  }

  return {
    ok: false,
    reason: 'Free trial ended. Activate a yearly subscription per device (WeatherLink Pro required).',
    status: expires > 0 ? 'expired' : 'none',
  };
}

export async function prepareYearlySubscriptionActivation(
  env: Env,
  stationId: string,
  wlPlan: WlPlan = 'pro',
  fulfillmentClaimId?: string
) {
  if (wlPlan !== 'pro') {
    throw new Error('Yearly paid access requires WeatherLink Pro on this device');
  }
  const now = Date.now();
  const poll = await getPollIntervalSec(env, 'pro');
  const claimGuard = fulfillmentClaimId
    ? `AND EXISTS (
         SELECT 1 FROM polar_fulfillment_claims
         WHERE id = ? AND status = 'claimed'
       )`
    : '';
  const values: unknown[] = [now + YEAR_MS, poll, now, stationId];
  if (fulfillmentClaimId) values.push(fulfillmentClaimId);
  return {
    statement: env.DB.prepare(
      `UPDATE stations SET
        wl_plan = 'pro',
        subscription_status = 'active',
        subscription_expires_at = ?,
        poll_interval_sec = ?,
        updated_at = ?
       WHERE id = ? ${claimGuard}`
    ).bind(...values),
  };
}

export async function activateYearlySubscription(env: Env, stationId: string, wlPlan: WlPlan = 'pro') {
  const { statement } = await prepareYearlySubscriptionActivation(env, stationId, wlPlan);
  await statement.run();
}

export async function setStationWlPlan(env: Env, stationId: string, wlPlan: WlPlan, apiVersion: string = 'v2') {
  const poll = await getPollIntervalSec(env, wlPlan, apiVersion);
  await env.DB.prepare(
    `UPDATE stations SET wl_plan = ?, poll_interval_sec = ?, updated_at = ? WHERE id = ?`
  )
    .bind(wlPlan, poll, Date.now(), stationId)
    .run();
}

export async function syncPollInterval(env: Env, station: StationRow) {
  const plan = normalizeWlPlan(station.wl_plan);
  const poll = await getPollIntervalSec(env, plan, station.cloud_api_version);
  if ((station.poll_interval_sec || 0) !== poll) {
    await env.DB.prepare('UPDATE stations SET poll_interval_sec = ?, updated_at = ? WHERE id = ?')
      .bind(poll, Date.now(), station.id)
      .run();
    station.poll_interval_sec = poll;
  }
  return poll;
}

export function publicBilling(user: UserRow, station?: StationRow | null) {
  const access = hasAccountAccess(user, station);
  const isV2 = station?.cloud_api_version !== 'v1';
  const plan = normalizeWlPlan(station?.wl_plan);
  const liveTargetSec = isV2 ? (plan === 'basic' ? 900 : 300) : 60;
  const pollSec = station?.poll_interval_sec || liveTargetSec;
  return {
    role: user.role || 'user',
    suspended: Boolean(user.suspended),
    emailVerified: Boolean(user.email_verified),
    freeUntil: user.free_until,
    accessOk: access.ok,
    accessReason: access.reason || null,
    subscriptionStatus: access.status,
    wlPlan: station?.wl_plan || 'unknown',
    subscriptionExpiresAt: station?.subscription_expires_at ?? null,
    pollIntervalSec: pollSec,
    deviceLabel: station?.device_label || station?.name || 'Device 1',
  };
}

export async function freeTrialMs(env: Env): Promise<number> {
  const days = Number(await getSetting(env, 'free_trial_days')) || 30;
  return days * DAY_MS;
}
