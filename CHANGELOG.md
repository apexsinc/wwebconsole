# Changelog

All notable changes to WWebConsole are documented in this file.

## [1.4.2] - 2026-07-09

### Changed
- Single `.env` workflow: commented `.env.example`, `npm run env:sync-dev`, `npm run secrets:push`
- `ADMIN_EMAIL` / `ADMIN_EMAILS` moved to Worker secrets (removed from `wrangler.jsonc` vars)
- Turnstile enabled in production via secrets + D1; Resend stays off until `RESEND_API_KEY` is set
- WAF helper supports Free-plan (1 rule) vs Pro+; documents Zone WAF token permission

## [1.4.1] - 2026-07-09

### Security
- Close remaining audit items: SPA CSP, HMAC session cookies, anti-enumeration register, PBKDF2 310k, strip `.dev.vars` from dist
- WAF rate-limit helper script + updated `SECURITY_AUDIT.md` checklist

## [1.4.0] - 2026-07-09

### Security
- Full security audit (`SECURITY_AUDIT.md`) with Worker rate limits, CORS allowlist, security headers
- CSPRNG OTPs, OTP attempt lockout, session rotation on login/password change
- Block self-registration of allowlisted admin emails; `devCode` only in local/dev
- Public TV serves cached weather only; longer share slugs; settings key allowlist
- Docs: `SECURITY.md`, Cloudflare hardening + incident response; Dependabot; unit tests

## [1.3.1] - 2026-07-09

### Changed
- Admin subdomain is login-only (no registration); register API blocked on admin host
- Cloudflare Access email OTP protects `admin.wwebconsole.com` (allowlist: apexsinc / it / ts)

## [1.3.0] - 2026-07-09

### Added
- Public marketing site: Home, Features, Pricing, About, Contact, Privacy, Terms, Changelog
- Admin **Site & SEO** tab: brand, hero, pricing copy, legal bodies, meta titles/descriptions
- `GET /api/public/site`, `/robots.txt`, `/sitemap.xml`; HTML meta injection for crawlers
- Console moved to `/app` so `/` is the marketing landing page

### Changed
- Auth success redirects to `/app` (admin host still lands on admin UI)

## [1.2.0] - 2026-07-09

### Added
- Cloudflare Access OTP policy script for `admin.wwebconsole.com` (allowlist: it/ts/apexsinc)
- Light theme by default with dark-mode toggle
- Account settings: change email, change password, schedule deletion (15-day grace)
- Cron purge of accounts past the deletion grace period

### Changed
- WeatherLink credentials are exclusive: choose **V1 or V2** (not both secret sets)

## [1.1.1] - 2026-07-09

### Changed
- Admin allowlist via `ADMIN_EMAILS` (comma-separated) for production, staging, and local `.dev.vars`
- Allowlisted admins auto-promote on login, skip email verification, and bypass subscription gates
- Removed unused local `davis-console` clone (run root cleanup script if still present)

## [1.1.0] - 2026-07-09

### Added
- Admin subdomain (`admin.wwebconsole.com`) to manage users, suspend accounts, and configure integrations
- Cloudflare Turnstile support for registration and password-reset forms
- Resend email integration for registration verification OTP and forgot-password OTP
- Free tier: 1 month access from registration
- Paid tier: yearly subscription **per device** (requires WeatherLink Pro on that station)
- WeatherLink plan-aware polling: Basic → 15 minutes; Pro / paid → faster refresh
- `CHANGELOG.md` in the repository

### Changed
- Sunrise/sunset now use WeatherLink station `latitude`, `longitude`, and `time_zone` automatically (no manual coordinates)
- Auth flow requires email verification when Resend is configured

### Security
- Suspended users cannot sign in or refresh weather data
- Integration secrets (Turnstile, Resend) managed from admin settings / Workers secrets

## [1.0.0] - 2026-07-09

### Added
- Cloudflare Workers + D1 migration from Express/Node davis-console
- User registration and cookie-session auth
- Encrypted WeatherLink Cloud credentials (v1/v2) in D1
- Live console dashboard (React + Vite + Tailwind)
- Public TV broadcast URLs (`/tv/:slug`) for big-screen monitors
- Cron-based WeatherLink polling
- Custom domains: `wwebconsole.com`, `www.wwebconsole.com`
