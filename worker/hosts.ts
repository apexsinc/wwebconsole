/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hostname policy shared by the worker and unit tests.
 */

/** Strict exact-match admin host check — never trust attacker subdomains like admin.evil.com. */
export function isAdminHostname(hostname: string): boolean {
  const h = (hostname || '').toLowerCase();
  return h === 'admin.wwebconsole.com' || h === 'admin.localhost' || h.endsWith('.admin.wwebconsole.com');
}

/**
 * Admin-portal base URL derived from the trusted APP_URL env var (never from
 * user input, so OAuth error/success redirects cannot become open redirects).
 * Unknown environments fall back to the main app (today's behavior).
 */
export function adminBaseUrl(appUrl: string): string {
  try {
    const u = new URL(appUrl);
    const host = u.hostname.toLowerCase();
    if (host === 'wwebconsole.com' || host === 'www.wwebconsole.com') return 'https://admin.wwebconsole.com';
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
      return `${u.protocol}//admin.localhost${u.port ? `:${u.port}` : ''}`;
    }
    return appUrl.replace(/\/+$/, '');
  } catch {
    return appUrl;
  }
}
