# Changelog

All notable changes to WWebConsole are documented in this file.

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
