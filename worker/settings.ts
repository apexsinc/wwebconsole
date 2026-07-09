import type { Env } from './types';

const SECRET_KEYS = new Set(['turnstile_secret_key', 'resend_api_key']);

export async function getSetting(env: Env, key: string): Promise<string> {
  // Workers secrets take precedence for sensitive keys
  if (key === 'turnstile_secret_key' && env.TURNSTILE_SECRET_KEY) return env.TURNSTILE_SECRET_KEY;
  if (key === 'resend_api_key' && env.RESEND_API_KEY) return env.RESEND_API_KEY;

  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? '';
}

export async function getSettingsMap(env: Env, keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of keys) out[key] = await getSetting(env, key);
  return out;
}

export async function setSetting(env: Env, key: string, value: string) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(key, value, now)
    .run();
}

export async function listSettingsForAdmin(env: Env) {
  const { results } = await env.DB.prepare('SELECT key, value, updated_at FROM app_settings ORDER BY key').all<{
    key: string;
    value: string;
    updated_at: number;
  }>();

  return (results || []).map((r) => ({
    key: r.key,
    value: SECRET_KEYS.has(r.key) ? (r.value ? '••••••••' : '') : r.value,
    hasValue: Boolean(r.value) || (r.key === 'turnstile_secret_key' && Boolean(env.TURNSTILE_SECRET_KEY)) || (r.key === 'resend_api_key' && Boolean(env.RESEND_API_KEY)),
    secret: SECRET_KEYS.has(r.key),
    updated_at: r.updated_at,
  }));
}

export async function isEnabled(env: Env, flagKey: string): Promise<boolean> {
  const v = await getSetting(env, flagKey);
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

export async function getPublicAuthConfig(env: Env) {
  const [turnstileEnabled, siteKey, resendEnabled, yearlyPrice, freeDays] = await Promise.all([
    isEnabled(env, 'turnstile_enabled'),
    getSetting(env, 'turnstile_site_key'),
    isEnabled(env, 'resend_enabled'),
    getSetting(env, 'yearly_price_usd'),
    getSetting(env, 'free_trial_days'),
  ]);
  return {
    turnstileEnabled: turnstileEnabled && Boolean(siteKey),
    turnstileSiteKey: turnstileEnabled ? siteKey : '',
    emailVerificationRequired: resendEnabled,
    yearlyPriceUsd: Number(yearlyPrice) || 49,
    freeTrialDays: Number(freeDays) || 30,
  };
}
