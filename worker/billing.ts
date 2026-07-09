import { getSetting } from './settings';
import type { Env, StationRow, SubscriptionStatus, UserRow, WlPlan } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

export function normalizeWlPlan(raw?: string | null): WlPlan {
  const v = (raw || '').toLowerCase();
  if (v.includes('pro') || v.includes('premier') || v.includes('advantage')) return 'pro';
  if (v.includes('basic') || v.includes('standard') || v === 'free') return 'basic';
  return 'unknown';
}

export async function getPollIntervalSec(env: Env, wlPlan: WlPlan): Promise<number> {
  const basic = Number(await getSetting(env, 'poll_basic_sec')) || 900;
  const pro = Number(await getSetting(env, 'poll_pro_sec')) || 120;
  return wlPlan === 'pro' ? pro : basic;
}

export function isUserSuspended(user: UserRow): boolean {
  return Boolean(user.suspended);
}

export function hasAccountAccess(user: UserRow, station?: StationRow | null): { ok: boolean; reason?: string; status: SubscriptionStatus } {
  if (isUserSuspended(user)) return { ok: false, reason: 'Account suspended', status: 'none' };

  const now = Date.now();
  if (user.free_until && user.free_until > now) {
    return { ok: true, status: 'trial' };
  }

  const subStatus = (station?.subscription_status || 'none') as SubscriptionStatus;
  const expires = station?.subscription_expires_at || 0;
  if (subStatus === 'active' && expires > now) {
    const plan = normalizeWlPlan(station?.wl_plan);
    if (plan !== 'pro') {
      return {
        ok: false,
        reason: 'Paid plans require a WeatherLink Pro subscription on the device',
        status: 'active',
      };
    }
    return { ok: true, status: 'active' };
  }

  return {
    ok: false,
    reason: 'Free trial ended. Activate a yearly subscription per device (WeatherLink Pro required).',
    status: expires > 0 ? 'expired' : 'none',
  };
}

export async function activateYearlySubscription(env: Env, stationId: string, wlPlan: WlPlan = 'pro') {
  if (wlPlan !== 'pro') {
    throw new Error('Yearly paid access requires WeatherLink Pro on this device');
  }
  const now = Date.now();
  const poll = await getPollIntervalSec(env, 'pro');
  await env.DB.prepare(
    `UPDATE stations SET
      wl_plan = 'pro',
      subscription_status = 'active',
      subscription_expires_at = ?,
      poll_interval_sec = ?,
      updated_at = ?
     WHERE id = ?`
  )
    .bind(now + YEAR_MS, poll, now, stationId)
    .run();
}

export async function setStationWlPlan(env: Env, stationId: string, wlPlan: WlPlan) {
  const poll = await getPollIntervalSec(env, wlPlan);
  await env.DB.prepare(
    `UPDATE stations SET wl_plan = ?, poll_interval_sec = ?, updated_at = ? WHERE id = ?`
  )
    .bind(wlPlan, poll, Date.now(), stationId)
    .run();
}

export async function syncPollInterval(env: Env, station: StationRow) {
  const plan = normalizeWlPlan(station.wl_plan);
  const poll = await getPollIntervalSec(env, plan);
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
    pollIntervalSec: station?.poll_interval_sec ?? 900,
    deviceLabel: station?.device_label || station?.name || 'Device 1',
  };
}

export async function freeTrialMs(env: Env): Promise<number> {
  const days = Number(await getSetting(env, 'free_trial_days')) || 30;
  return days * DAY_MS;
}
