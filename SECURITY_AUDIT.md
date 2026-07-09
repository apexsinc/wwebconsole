# WWebConsole Security Audit

**Date:** 2026-07-09  
**Scope:** Full repository (`worker/`, `src/`, `migrations/`, Wrangler config)  
**Stack:** Vite + React 19, Hono on Cloudflare Workers, D1, Zod, React Query, Zustand, React Router

---

## Executive summary

WWebConsole has a solid baseline (PBKDF2 passwords, AES-GCM WeatherLink credentials, httpOnly sessions, prepared statements, Cloudflare Access OTP on admin). The audit found **no Critical** remote unauthenticated RCE/SQLi, but several **High** issues around OTP entropy, missing rate limits, admin email squatting, `devCode` leakage, and permissive CORS.

**This pass implements** app-level hardening (rate limits, CSPRNG OTPs, CORS allowlist, security headers, session rotation, public TV cache-only, wlPlan lock, settings allowlist, admin register block, docs, Dependabot, tests). Remaining items require **Cloudflare dashboard** WAF/rate-limit rules and secret rotation discipline.

---

## Threat model

| Actor | Goals |
|-------|--------|
| Anonymous internet | Spam signup, brute OTP/login, scrape TV links, DDoS Workers/D1 |
| Authenticated user | Escalate to Pro polling, steal other users’ stations, abuse share links |
| Compromised admin | Tamper settings, dump users, inject marketing XSS |
| Supply-chain | Malicious npm package, leaked build secrets |

**Assets:** session cookies, WeatherLink API secrets (encrypted), admin role, D1 customer data, Resend/Turnstile secrets.

---

## Attack surface map

| Surface | Entry |
|---------|--------|
| Public marketing | `/`, SEO pages, `/api/public/site` |
| Auth | `/api/auth/*` on main host |
| Console | `/app`, `/api/station`, `/api/weather/*`, `/api/share` |
| Public TV | `/tv/:slug`, `/api/public/tv/:slug` |
| Admin | `admin.wwebconsole.com` (Access OTP) + `/api/admin/*` |
| Cron | `*/2 * * * *` WeatherLink poll |

---

## Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| H1 | High | OTP via `Math.random()` | **Fixed** — `generateOtpCode()` CSPRNG |
| H2 | High | No rate limits on auth/OTP | **Fixed** — Worker rate limiter + dashboard docs |
| H3 | High | Admin allowlist squatting on register | **Fixed** — block allowlisted emails on register; promote on login only |
| H4 | High | `devCode` returned when Resend off | **Fixed** — only in local/dev |
| M1 | Medium | CORS reflects any Origin + credentials | **Fixed** — allowlist |
| M2 | Medium | User-writable `wlPlan: pro` | **Fixed** — removed from PATCH + UI |
| M3 | Medium | Public TV triggers WeatherLink refresh | **Fixed** — cache only |
| M4 | Medium | Short share slugs (min 4) | **Fixed** — default 16, custom min 12 |
| M5 | Medium | No session rotation on login/password change | **Fixed** |
| M6 | Medium | Admin settings arbitrary keys | **Fixed** — allowlist |
| M7 | Medium | Email enumeration | **Partial** — generic OTP errors; register still distinct |
| M8 | Medium | Public TV leaked `last_error` | **Fixed** — sanitized connection |
| M9 | Medium | Extra admin emails in wrangler vars | **Improved** — removed demo/contact from allowlist |
| L1 | Low | Unused `SESSION_SECRET` | Open — sessions are DB UUIDs |
| L2 | Low | No CSP on SPA HTML | Open — recommend dashboard/CSP later |
| L3 | Low | Integration secrets can live in D1 | Documented — prefer Wrangler secrets |
| L4 | Low | PBKDF2 100k iterations | Open — acceptable; raise later |
| L5 | Low | Turnstile off by default | Ops — enable in production |
| I1 | Info | `dist/**/.dev.vars` build copy | Documented — do not publish `dist/` |
| I2 | Info | Frontend XSS via MarkdownLite | **OK** — text nodes only |

### Evidence (pre-fix)

```typescript
// worker/otp.ts (before)
const code = String(Math.floor(100000 + Math.random() * 900000));
```

```typescript
// worker/index.ts (before)
app.use('/api/*', cors({ origin: (origin) => origin || '*', credentials: true }));
```

```typescript
// Public TV refreshed WeatherLink when stale (abuse amplification)
if (stale) { await refreshStation(c.env, station); }
```

### Recommended fixes (implemented)

- `worker/rateLimit.ts`, `worker/security.ts`
- CSPRNG OTP + attempt column (`migrations/0007_security_hardening.sql`)
- CORS allowlist, headers, body size limit
- Session destroy-all on login/password change
- Public TV cache-only + rate limit
- Settings key allowlist; wlPlan not user-writable
- Docs: `SECURITY.md`, `docs/security/*`, Dependabot, tests

---

## Cloudflare dashboard / WAF recommendations

See [docs/security/cloudflare-hardening.md](docs/security/cloudflare-hardening.md).

Priority:

1. WAF managed rules + Bot Fight Mode  
2. Rate limiting rules for `/api/auth/*`, `/api/public/tv/*`, admin API  
3. Keep Access OTP on `admin.wwebconsole.com`  
4. Enable Turnstile + Resend in production  
5. Alerts on Worker errors / auth 401 spikes  

---

## D1 recommendations

- Continue **prepared statements only** (current pattern)
- Purge expired sessions/OTPs on cron (**added**)
- Prefer Worker secrets over `app_settings` for Turnstile/Resend secrets
- Enable D1 backups / time travel where plan allows
- Cap admin user list queries (LIMIT 100 — present)

---

## Final prioritized checklist

- [x] Rate limit auth/OTP/share/TV in Worker  
- [x] CSPRNG OTP + attempt lockout  
- [x] Block admin-email self-registration  
- [x] Gate `devCode` to development  
- [x] CORS allowlist + security headers + body limit  
- [x] Remove user `wlPlan` write  
- [x] Public TV cache-only  
- [x] Longer share slugs + per-user cap  
- [x] Session rotation  
- [x] Admin settings allowlist  
- [x] SECURITY.md + hardening + IR docs  
- [x] Dependabot + security unit tests  
- [ ] Enable Cloudflare WAF rate-limit rules (manual)  
- [ ] Enable Turnstile/Resend in production (manual)  
- [ ] Rotate secrets if `.dev.vars` ever leaked (manual)  
- [ ] Move `ADMIN_EMAILS` fully to secrets (optional)  
- [ ] Add SPA Content-Security-Policy (follow-up)  

---

## Implementation status

| Control | Location |
|---------|----------|
| Rate limiting | `worker/rateLimit.ts`, `worker/security.ts` |
| Headers / CORS / body limit | `worker/security.ts`, `worker/index.ts` |
| OTP CSPRNG | `worker/crypto.ts`, `worker/otp.ts`, `worker/auth.ts` |
| Session rotation | `worker/auth.ts` |
| Public TV hardening | `worker/index.ts` |
| Docs / Dependabot / tests | `SECURITY.md`, `docs/security/`, `.github/dependabot.yml`, `worker/__tests__/` |
