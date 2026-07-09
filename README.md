# WWebConsole

Davis WeatherLink web console on **Cloudflare Workers + D1**, with user auth, billing tiers, and public TV share URLs.

**Domain:** [https://wwebconsole.com](https://wwebconsole.com) · **Admin:** [https://admin.wwebconsole.com](https://admin.wwebconsole.com)

## Stack (free → paid upgrade path)

| Layer | Choice | Why |
|-------|--------|-----|
| Edge API | Cloudflare Workers + Hono | Free tier, global, scales with Workers Paid |
| Database | Cloudflare D1 (SQLite) | Free tier; upgrade storage/queries later |
| Frontend | React 19 + Vite + Tailwind | Same console UI, SPA on Workers Assets |
| Auth | Cookie sessions (PBKDF2) + optional Turnstile/Resend | No third-party auth cost on free tier |
| Secrets | AES-GCM in D1 + Workers secrets | WeatherLink keys never returned to browser |
| Polling | Cron Triggers (plan-aware) | Basic 15 min · Pro faster |

**Not on Workers:** Local LAN / UDP WeatherLink Live. Use WeatherLink Cloud (v1/v2).

## Features

- Marketing site (Home, Features, Pricing, About, Contact, Privacy, Terms, Changelog) — copy & SEO editable from admin **Site & SEO**
- Register / login with optional Turnstile + Resend OTP (verify + forgot password)
- Free users: 1 month access; paid: yearly subscription **per device** (WeatherLink Pro required)
- Polling: WeatherLink Basic → 15 min; Pro → faster (admin-configurable)
- Admin subdomain: users, Site & SEO, Turnstile/Resend; `/robots.txt` + `/sitemap.xml`
- Encrypted WeatherLink Cloud credentials (v1 **or** v2)
- Live console at `/app` + public TV URLs (`/tv/<slug>`)
- See `CHANGELOG.md` for release notes

## Develop

```bash
npm install
npx wrangler d1 migrations apply wwebconsole-db --local
npm run dev
```

## Deploy

```bash
npx wrangler d1 migrations apply wwebconsole-db --remote
npx wrangler secret put SESSION_SECRET
npx wrangler secret put CREDENTIALS_KEY
# optional overrides:
# npx wrangler secret put TURNSTILE_SECRET_KEY
# npx wrangler secret put RESEND_API_KEY
npm run deploy
```

Set `ADMIN_EMAILS` (comma-separated) in `wrangler.jsonc` and `.dev.vars` so those accounts are admins in **production, staging, and local**. They auto-promote on login.

**Local admin:** `npm run dev` → open http://localhost:5173/admin and sign in with an allowlisted email.

### Cloudflare Access OTP for admin.wwebconsole.com

The API token used for Workers deploy may lack Access **Edit**. Create the policy in the dashboard (or with an Access-edit token):

1. Zero Trust → Access → Applications → Add self-hosted app  
2. Domain: `admin.wwebconsole.com`  
3. Identity provider: **One-time PIN**  
4. Policy allow emails: `it.apexsinc@gmail.com`, `ts.apexsinc@gmail.com`, `apexsinc@gmail.com`  
5. Require login method: One-time PIN  

Or run: `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… bash scripts/setup-admin-access.sh`

**Remove old davis-console (root-owned):** as root run `bash /home/wwebconsole/remove-davis-console.sh`
