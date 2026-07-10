/** Password hashing (PBKDF2-SHA256) + AES-GCM for WeatherLink credentials */

/** New password hashes use this iteration count. verifyPassword still accepts older hashes. */
const PBKDF2_ITERATIONS = 310_000;

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function b64decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64encode(salt)}$${b64encode(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = b64decode(parts[2]!);
  const expected = b64decode(parts[3]!);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

async function importAesKey(hexKey: string | undefined): Promise<CryptoKey> {
  if (!hexKey) {
    throw new Error('CREDENTIALS_KEY is missing from environment variables');
  }
  const clean = hexKey.replace(/[^0-9a-f]/gi, '');
  if (clean.length < 64) {
    throw new Error('CREDENTIALS_KEY must be a 32-byte hex string (64 chars)');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptJson(keyHex: string | undefined, data: unknown): Promise<{ enc: string; iv: string }> {
  const key = await importAesKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { enc: b64encode(ciphertext), iv: b64encode(iv) };
}

export async function decryptJson<T>(keyHex: string | undefined, enc: string, iv: string): Promise<T> {
  if (!enc || !iv || !keyHex) return {} as T;
  try {
    const key = await importAesKey(keyHex);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64decode(iv) },
      key,
      b64decode(enc)
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch (err) {
    console.error('decryptJson failed:', err);
    return {} as T;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function randomSlug(length = 16): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

/** Cryptographically secure 6-digit OTP (000000–999999). */
export function generateOtpCode(digits = 6): string {
  const max = 10 ** digits;
  // Rejection sampling to avoid modulo bias
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let n = 0;
  do {
    crypto.getRandomValues(buf);
    n = buf[0]!;
  } while (n >= limit);
  return String(n % max).padStart(digits, '0');
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signSessionCookieValue(secret: string | undefined, sessionId: string): Promise<string> {
  if (!secret) return sessionId;
  const sig = (await hmacSha256Hex(secret, sessionId)).slice(0, 32);
  return `${sessionId}.${sig}`;
}

/** Verify HMAC-signed cookie; accept legacy unsigned UUIDs during rollout. */
export async function parseSessionCookieValue(
  secret: string | undefined,
  raw: string | undefined
): Promise<string | null> {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length === 1) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
      return raw;
    }
    return null;
  }
  if (parts.length !== 2) return null;
  const [sessionId, sig] = parts;
  if (!sessionId || !sig || !secret) return null;
  const expected = (await hmacSha256Hex(secret, sessionId)).slice(0, 32);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? sessionId : null;
}
