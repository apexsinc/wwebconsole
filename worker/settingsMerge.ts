/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure settings-merge helper — dependency-free so Node unit tests can
 * import it directly (worker files use extensionless imports that plain
 * Node ESM cannot resolve).
 */

export function mergeSettingsValues(
  keys: string[],
  found: Map<string, string>,
  secrets: Record<string, string>,
  defaults: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of new Set(keys)) {
    if (secrets[key] !== undefined) {
      out[key] = secrets[key];
      continue;
    }
    const v = found.get(key);
    out[key] = v != null && v !== '' ? v : defaults[key] ?? '';
  }
  return out;
}
