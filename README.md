# WWebConsole

Davis WeatherLink web console on **Cloudflare Workers + D1**, with user auth and public TV share URLs.

**Domain:** [https://wwebconsole.com](https://wwebconsole.com)

## Stack (free → paid upgrade path)

| Layer | Choice | Why |
|-------|--------|-----|
| Edge API | Cloudflare Workers + Hono | Free tier, global, scales with Workers Paid |
| Database | Cloudflare D1 (SQLite) | Free tier; upgrade storage/queries later |
| Frontend | React 19 + Vite + Tailwind | Same console UI, SPA on Workers Assets |
| Auth | Cookie sessions (PBKDF2) | No third-party auth cost on free tier |
| Secrets | AES-GCM in D1 + Workers secrets | WeatherLink keys never returned to browser |
| Polling | Cron Triggers (every 2 min) | Keeps TV displays fresh without client load |

**Not on Workers:** Local LAN / UDP WeatherLink Live. Use WeatherLink Cloud (v1/v2).

## Features

- Register / login
- Store WeatherLink Cloud credentials (encrypted)
- Live console dashboard
- Public TV URLs: `https://wwebconsole.com/tv/<slug>` for big monitors

## Develop

```bash
npm install
npx wrangler d1 migrations apply wwebconsole-db --local
npm run dev
```

## Deploy

```bash
npx wrangler d1 create wwebconsole-db   # once — paste database_id into wrangler.jsonc
npx wrangler d1 migrations apply wwebconsole-db --remote
npx wrangler secret put SESSION_SECRET
npx wrangler secret put CREDENTIALS_KEY
npm run deploy
npx wrangler domains add wwebconsole.com
```

`SESSION_SECRET` and `CREDENTIALS_KEY` must be 32+ byte hex strings (64 hex chars for the AES key).
