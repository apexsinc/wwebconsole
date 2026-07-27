import { getSetting, isEnabled } from './settings';
import type { Env } from './types';

export async function verifyTurnstile(env: Env, token: string | undefined, ip?: string | null): Promise<void> {
  const enabled = await isEnabled(env, 'turnstile_enabled');
  if (!enabled) return;

  const secret = await getSetting(env, 'turnstile_secret_key');
  if (!secret) throw new Error('Turnstile is enabled but secret key is not configured');
  if (!token) throw new Error('Turnstile verification required');

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
  if (!data.success) {
    throw new Error(`Turnstile failed: ${(data['error-codes'] || []).join(', ') || 'invalid'}`);
  }
}
