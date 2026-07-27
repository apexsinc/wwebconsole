# Incident response (WWebConsole)

## Severity

| Level | Examples |
|-------|----------|
| Sev-1 | Credential dump, admin takeover, mass account access |
| Sev-2 | Auth bypass, OTP brute-force in progress, D1 integrity issue |
| Sev-3 | Abuse / scraping, single-account compromise, misconfig |
| Sev-4 | Informational / hardening debt |

## First 30 minutes

1. **Contain**
   - Suspend affected users in admin UI
   - Rotate `SESSION_SECRET` / `CREDENTIALS_KEY` if session or credential crypto may be compromised (forces re-login; re-encrypt credentials if key rotated)
   - Disable Turnstile/Resend only if they are the abuse vector (usually keep them on)
   - Tighten Cloudflare Rate Limiting / WAF if under attack
2. **Preserve evidence**
   - Note CF-Ray IDs, timestamps, IPs (`cf-connecting-ip`)
   - Export relevant D1 rows (users, sessions, otp_codes, share_links) before purge
3. **Communicate**
   - Notify ops owners on allowlisted admin emails
   - Do not post secrets in chat/tickets

## Credential compromise

1. `wrangler secret put CREDENTIALS_KEY` with a new 32-byte hex key
2. Users must re-enter WeatherLink credentials (old ciphertext cannot be decrypted)
3. Invalidate sessions: delete from `sessions` or rotate `SESSION_SECRET` and clear cookies via Access/session expiry
4. Review `app_settings` for tampered Turnstile/Resend values

## Account takeover

1. Suspend user
2. Force password reset after restore
3. Delete all `sessions` for that `user_id`
4. Rotate share-link slugs (delete + recreate)

## D1 recovery

1. Use Cloudflare D1 time-travel / backup if enabled on the plan
2. Re-apply migrations only forward; never edit applied migration files in place
3. After restore, re-run Access OTP check and smoke-test auth + TV

## Post-incident

- Write a short timeline in this folder or internal ops notes
- File follow-ups in `SECURITY_AUDIT.md` checklist
- Rotate any tokens pasted in chat (GitHub PAT, CF API tokens)
