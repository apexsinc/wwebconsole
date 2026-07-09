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
3. Add **Rate limiting** rules (edge layer; Worker still has app-level limits):

**Free plan (1 rule only):** path starts with `/api/auth/` · 20 req / 10 s / IP · Block  
Dashboard: **Security → WAF → Rate limiting rules**

**Pro+ (script default when `CF_PLAN=pro`):**

| Rule | Match | Limit |
|------|-------|-------|
| Auth login | path `/api/auth/login` | 20 / 60 s / IP |
| Auth register | `/api/auth/register` | 10 / 60 s / IP |
| OTP | verify-email / reset / forgot | 20 / 60 s / IP |
| Public TV | `/api/public/tv/*` | 120 / 60 s / IP |
| Admin API | `admin…/api/admin/*` | 60 / 60 s / IP |

API helper: `npm run waf:rate-limits` (needs token with **Zone → Zone WAF → Edit**).  
If the API returns `request is not authorized`, create the Free rule in the dashboard and/or widen the token.

4. **Turnstile** is enabled via `.env` (`TURNSTILE_ENABLED=1`) + `npm run secrets:push` (Worker secret + D1 flag). Prefer Worker secrets for `TURNSTILE_SECRET_KEY`.

## Cache

- Do **not** cache `/api/*` at the edge (app sets `Cache-Control: no-store`).
- Marketing HTML may use short `max-age` (SEO injection).
- Public TV JSON may use `max-age=30` only.

## Secrets

Keep one local file `.env` (from `.env.example`), then:

```bash
npm run env:sync-dev    # → .dev.vars for local wrangler/vite
npm run secrets:push    # → Worker secrets + D1 Turnstile/Resend flags
```

Secrets pushed: `SESSION_SECRET`, `CREDENTIALS_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` (if set), `ADMIN_EMAIL`, `ADMIN_EMAILS`.

Prefer secrets over D1 `app_settings` for integration keys. Rotate if `.dev.vars` or build artifacts were ever exposed.

`SESSION_SECRET` HMAC-signs the session cookie (`sessionId.signature`). Legacy unsigned UUID cookies still work until users re-login.

## Rate limiting helper

```bash
npm run waf:rate-limits
# or: bash scripts/setup-waf-rate-limits.sh
```

Requires `CLOUDFLARE_API_TOKEN` (+ optional `ZONE_ID`, `CF_PLAN`) in `.env`.  
If unauthorized or Free-plan capped, add the Free rule in the dashboard (see table above).

## Monitoring & alerts

- Worker error rate, CPU time, subrequests
- D1 rows read/written
- Spike in `/api/auth/login` 401s
- Access login failures on admin host

## Staging

- Use a separate Worker / D1 or `workers.dev` with Access if exposed
- Never point production `ADMIN_EMAILS` at shared demo inboxes
