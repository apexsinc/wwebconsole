-- Shorten default free trial from 60 to 30 days (1 month).
-- Only flips untouched defaults; admin-customized values are preserved.
UPDATE app_settings SET value = '30', updated_at = strftime('%s','now') * 1000
WHERE key = 'free_trial_days' AND value = '60';
