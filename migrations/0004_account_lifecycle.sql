-- Soft account deletion (15-day grace) + email change support
ALTER TABLE users ADD COLUMN delete_requested_at INTEGER;
ALTER TABLE users ADD COLUMN pending_email TEXT;
ALTER TABLE users ADD COLUMN pending_email_code_hash TEXT;
ALTER TABLE users ADD COLUMN pending_email_expires_at INTEGER;
