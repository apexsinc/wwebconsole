/**
 * Lightweight in-memory rate limiter for Cloudflare Workers.
 * Complements Cloudflare WAF / Rate Limiting rules (preferred for production).
 * Note: counters are per-isolate and reset on cold start — still useful as a first line of defense.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const MAX_KEYS = 5_000;

function prune(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
  if (buckets.size >= MAX_KEYS) {
    // Drop oldest half if still full
    let i = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++i >= MAX_KEYS / 2) break;
    }
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true };
}

/** Clear buckets (tests only). */
export function __resetRateLimitsForTests() {
  buckets.clear();
}

export const RATE_LIMITS = {
  authLogin: { limit: 10, windowMs: 15 * 60 * 1000 },
  authRegister: { limit: 5, windowMs: 60 * 60 * 1000 },
  authOtp: { limit: 8, windowMs: 15 * 60 * 1000 },
  authForgot: { limit: 5, windowMs: 60 * 60 * 1000 },
  accountSensitive: { limit: 10, windowMs: 15 * 60 * 1000 },
  shareCreate: { limit: 20, windowMs: 60 * 60 * 1000 },
  publicTv: { limit: 60, windowMs: 60 * 1000 },
  adminWrite: { limit: 60, windowMs: 60 * 1000 },
  apiDefault: { limit: 120, windowMs: 60 * 1000 },
} as const;
