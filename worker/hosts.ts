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
