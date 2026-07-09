# Cloudflare hardening (WWebConsole)

Manual dashboard actions that complement app-level controls.

## Already in code

- Allowlist CORS for credentialed API calls
- Security headers on API responses
- App-level rate limits on auth / OTP / share / public TV
- CSPRNG OTPs + attempt lockout
- Session rotation on login / password change
- Public TV serves **cached** weather only (no WeatherLink refresh)
- Admin host: Cloudflare Access OTP + no registration
- Settings key allowlist for admin writes

## Zero Trust / Access

- Keep **WWebConsole Admin** Access app on `admin.wwebconsole.com`
- Identity: One-time PIN only
- Allowlist: ops emails only (no shared demo addresses)
- Session duration: 24h (or shorter)

## WAF & bot

1. Enable **WAF Managed Rules** (Cloudflare Free/Pro as available).
2. Enable **Bot Fight Mode** (or Super Bot Fight Mode on Pro+).
3. Add **Rate limiting** rules (prefer these over Worker-only limits):

| Rule | Match | Limit |
|------|-------|-------|
| Auth login | `admin.wwebconsole.com` + `wwebconsole.com` path `/api/auth/login` | 10 / 15 min / IP |
| Auth register | `/api/auth/register` | 5 / hour / IP |
| OTP | `/api/auth/verify-email`, `/api/auth/reset-password` | 10 / 15 min / IP |
| Public TV | `/api/public/tv/*` | 60 / min / IP |
| Admin API | `admin.wwebconsole.com/api/admin/*` | 60 / min / IP |

4. Enable **Turnstile** in admin Integrations for production (`turnstile_enabled=1`). Prefer Worker secrets for `TURNSTILE_SECRET_KEY`.

## Cache

- Do **not** cache `/api/*` at the edge (app sets `Cache-Control: no-store`).
- Marketing HTML may use short `max-age` (SEO injection).
- Public TV JSON may use `max-age=30` only.

## Secrets

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put CREDENTIALS_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
```

Prefer secrets over D1 `app_settings` for integration keys. Rotate if `.dev.vars` or build artifacts were ever exposed.

## Monitoring & alerts

- Worker error rate, CPU time, subrequests
- D1 rows read/written
- Spike in `/api/auth/login` 401s
- Access login failures on admin host

## Staging

- Use a separate Worker / D1 or `workers.dev` with Access if exposed
- Never point production `ADMIN_EMAILS` at shared demo inboxes
