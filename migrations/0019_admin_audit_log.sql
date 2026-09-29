-- Audit trail for privileged actions.
--
-- Previously there was no record of who performed an admin action, which made
-- real incidents (for example a Pro subscription appearing with no matching
-- payment) impossible to investigate after the fact. Every privileged mutation
-- is now recorded with the acting admin, the target, and a JSON detail blob.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target_user_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at
  ON admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_action
  ON admin_audit_log(action);
