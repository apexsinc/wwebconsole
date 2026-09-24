/**
 * API URL path policy shared by the Worker and the browser client.
 *
 * Keep the version prefix here rather than repeating it throughout route and
 * fetch definitions. The legacy prefix is intentionally served alongside
 * the canonical prefix so existing clients and integrations keep working.
 */
export const API_PREFIX = '/v1';
export const LEGACY_API_PREFIX = '/api';

/** Every prefix served by the API application, in canonical-first order. */
export const API_ROUTE_PREFIXES = [API_PREFIX, LEGACY_API_PREFIX] as const;

/** Build a canonical API path from a path relative to the API prefix. */
export function apiPath(path = ''): string {
  const normalized = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `${API_PREFIX}${normalized}`;
}

/** True for both the canonical API prefix and its permanent legacy alias. */
export function isApiPath(pathname: string): boolean {
  return API_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Map a legacy `/api` request path onto the canonical `/v1` path.
 *
 * The legacy prefix is served by REWRITING to the canonical prefix rather than
 * by mounting the same route table twice. A single mount keeps exactly one copy
 * of every route in the parent router, which is what makes matching
 * deterministic; the duplicate mount intermittently fell through to the JSON
 * catch-all and returned 404 for real routes.
 *
 * Returns null when the path is not a legacy API path.
 */
export function rewriteLegacyApiPath(pathname: string): string | null {
  if (pathname === LEGACY_API_PREFIX) return API_PREFIX;
  if (pathname.startsWith(`${LEGACY_API_PREFIX}/`)) {
    return `${API_PREFIX}${pathname.slice(LEGACY_API_PREFIX.length)}`;
  }
  return null;
}
