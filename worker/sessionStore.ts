/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Session persistence helpers — dependency-free so Node unit tests can
 * import them directly (worker files use extensionless imports that plain
 * Node ESM cannot resolve).
 */

export interface SessionDb {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all<T>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
    };
  };
}

/** Max concurrent sessions per user; oldest beyond this are pruned on login. */
export const MAX_SESSIONS_PER_USER = 10;

export async function insertSession(
  db: SessionDb,
  id: string,
  userId: string,
  expires: number,
  now: number
): Promise<void> {
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, expires, now)
    .run();
}

/** Delete oldest sessions beyond the cap. Returns the pruned count. */
export async function pruneSessionsToCap(db: SessionDb, userId: string, max = MAX_SESSIONS_PER_USER): Promise<number> {
  const existing = await db
    .prepare('SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at ASC')
    .bind(userId)
    .all<{ id: string }>();
  const ids = (existing.results || []).map((r) => r.id);
  if (ids.length <= max) return 0;
  const stale = ids.slice(0, ids.length - max);
  const placeholders = stale.map(() => '?').join(',');
  await db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`).bind(...stale).run();
  return stale.length;
}
